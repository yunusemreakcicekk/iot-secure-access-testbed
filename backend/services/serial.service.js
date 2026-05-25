const net = require('net');
const ParserService = require('./parser.service');
const StateService = require('./state.service');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * SerialService handles the communication with the ESP32 hardware.
 * It also includes a simulation mode for development without the board.
 */
class SerialService {
    constructor() {
        // TCP Sızma (Hacking) Ayarları
        this.targetIp = process.env.TARGET_IP || '192.168.4.1';
        this.targetPort = parseInt(process.env.TARGET_PORT || '81');
        
        this.simulation = process.env.SIMULATION_MODE === 'true';
        this.client = null;
        this.reconnectTimeout = 3000;
        this.isConnected = false;
        this.dataBuffer = '';
    }

    start() {
        if (this.simulation) {
            console.log("Starting in SIMULATION MODE. Hardware connection bypassed.");
            StateService.updateState({ serialConnected: true, networkStatus: 'CONNECTED', rfidVersion: '0x00', activePort: null });
            this.startSimulation();
            return;
        }

        this.connect();
        this.startPortScanner();
    }

    startPortScanner() {
        // Wi-Fi sızma senaryosunda port taraması yok, sadece hedefe bağlanmayı deneyeceğiz.
        this.refreshPorts();
    }

    async refreshPorts() {
        // UI'daki port listesini kandırmak için sadece "Wi-Fi Hedef" yazısını göstereceğiz
        StateService.updateState({ availablePorts: [{ path: `Wi-Fi Sızma (${this.targetIp})` }] });
    }

    connect() {
        console.log(`[SİBER SIZMA] Hedefe Bağlanılıyor... ${this.targetIp}:${this.targetPort}`);
        
        try {
            this.client = new net.Socket();
            this.client.setKeepAlive(true, 2000);

            this.client.connect(this.targetPort, this.targetIp, () => {
                console.log(`[SİBER SIZMA] Hedef ağa (${this.targetIp}) başarıyla sızıldı!`);
                this.isConnected = true;
                this.dataBuffer = ''; // Bağlantı kurulunca tamponu temizle
                
                StateService.updateState({ 
                    networkStatus: 'CONNECTED', 
                    serialConnected: true,
                    activePort: `Wi-Fi (${this.targetIp})` 
                });
                StateService.addLog(`Sistem hedef cihaza başarıyla bağlandı! IP: ${this.targetIp}`, 'SUCCESS', 'WIFI_HACK_SERVICE');
            });

            this.client.on('data', (data) => {
                const raw = data.toString();
                this.dataBuffer += raw;

                // Satır satır (newline) parçalama işlemi
                let newlineIndex;
                while ((newlineIndex = this.dataBuffer.indexOf('\n')) !== -1) {
                    let line = this.dataBuffer.substring(0, newlineIndex).trim(); // \r'leri temizler
                    this.dataBuffer = this.dataBuffer.substring(newlineIndex + 1);

                    if (line.length > 0) {
                        // Konsola sadece işlenebilir veri yazdıralım
                        console.log(`[HACKED DATA] ${line}`);
                        ParserService.parse(line);
                    }
                }
            });

            this.client.on('close', () => {
                if (this.isConnected) {
                    console.warn(`[SİBER SIZMA] Hedefle bağlantı koptu! (${this.targetIp})`);
                    this.isConnected = false;
                    StateService.updateState({ networkStatus: 'DISCONNECTED', serialConnected: false });
                    StateService.addLog(`Hedef (${this.targetIp}) ile bağlantı kesildi. Tekrar deneniyor...`, 'WARNING', 'WIFI_HACK_SERVICE');
                }
                this.scheduleReconnect();
            });

            this.client.on('error', (err) => {
                console.error(`[SİBER SIZMA HATASI] Bağlantı Hatası: ${err.message}`);
                // Hata olduğunda close event'i de tetiklenir, scheduleReconnect oradan çağrılır.
            });

        } catch (error) {
            console.error(`[SİBER SIZMA HATASI] Kritik Hata: ${error.message}`);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.simulation) return;
        
        console.log(`Attempting to reconnect in ${this.reconnectTimeout / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectTimeout);
    }

    // Simulation logic to help testing the UI
    startSimulation() {
        console.log("[SIMULATION] Generating periodic hardware telemetry...");
        
        // Initial sync
        ParserService.parse("STATUS;DEVICE=DOOR;RFID=OK;CARD=NONE;DOOR=LOCKED;MODE=SECURE;VER=SIM_1.0");
        ParserService.parse("WIFI:CONNECTED");

        setInterval(() => {
            if (StateService.getState().lockout) return;
            
            const rand = Math.random();
            if (rand > 0.8) {
                // Occasionally simulate a status heart-beat from the board
                const door = StateService.getState().doorState;
                const mode = StateService.getState().mode;
                const card = StateService.getState().cardStatus;
                ParserService.parse(`STATUS;DEVICE=DOOR;RFID=OK;CARD=${card};DOOR=${door};MODE=${mode};VER=SIM_1.0`);
            }
        }, 5000);
    }

    // New: Send data TO the ESP32 hardware
    sendCommand(command) {
        const normalizedCommand = typeof command === 'string' ? command.trim() : '';
        const pinUpdateMatch = normalizedCommand.match(/^(?:PIN|SET_PIN)=([0-9]{3}|[0-9]{9})$/i);

        if (!normalizedCommand) {
            StateService.addLog('Rejected empty hardware command', 'WARNING', 'SERIAL_SERVICE');
            return false;
        }

        if (pinUpdateMatch && StateService.getState().mode === 'SECURE') {
            StateService.addLog('Remote PIN update rejected: secure mode is active', 'WARNING', 'SERIAL_SERVICE');
            return false;
        }

        if (pinUpdateMatch && this.simulation) {
            ParserService.parse(`PIN_SET;PIN=${pinUpdateMatch[1]}`);
            StateService.addLog(`Simulation PIN updated: ${pinUpdateMatch[1]}`, 'SUCCESS', 'SERIAL_SERVICE');
            return true;
        }

        if (!this.isConnected || !this.client) {
            console.error("[SİBER SIZMA] Komut gönderilemedi: Hedefe bağlı değiliz.");
            return false;
        }
        
        // Komutu gönderirken \n ekle (TCP soket haberleşmesi için)
        this.client.write(normalizedCommand + '\n', (err) => {
            if (err) {
                console.error(`[SİBER SIZMA] Komut gönderme hatası: ${err.message}`);
                StateService.addLog(`Saldırı komutu gönderilemedi: ${err.message}`, 'DANGER', 'WIFI_HACK_SERVICE');
            } else {
                console.log(`[SİBER SIZMA] Komut Gönderildi: ${normalizedCommand}`);
                StateService.addLog(`Ağ üzerinden hedefe komut gönderildi: ${normalizedCommand}`, 'INFO', 'WIFI_HACK_SERVICE');
            }
        });
        return true;
    }

    // Manual parser trigger for testing from the dashboard/scripts
    testEvent(line) {
        console.log(`[TEST_EVENT] ${line}`);
        ParserService.parse(line);
    }
}

module.exports = new SerialService();
