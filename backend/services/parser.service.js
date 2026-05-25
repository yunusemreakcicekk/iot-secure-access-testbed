const StateService = require('./state.service');
const crypto = require('crypto');

/**
 * ParserService takes raw serial strings and transforms them into structured events.
 * Handles Turkish ESP32 output for the GUARD_PROTOCOL door system.
 */
class ParserService {
    constructor() {
        this.mappings = [
            // --- Hardware Status Sync ---
            { 
                pattern: /(?:\[HACKED DATA\]\s*)?STATUS;DEVICE=DOOR;RFID=([^;]+);CARD=([^;]+);DOOR=([^;]+);MODE=([^;]+);VER=([^;\n\r]+)/i, 
                type: 'STATUS_UPDATE', 
                msg: 'System state synchronized from hardware', 
                severity: 'INFO', 
                action: (match) => {
                    const [_, rfid, card, door, mode, ver] = match;
                    const isCardRegistered = card === 'REGISTERED' || card === 'TRUE' || card === '1';
                    
                    // Gelen verilere göre panelin durumunu güncelle
                    StateService.updateState({
                        rfidStatus: rfid === 'OK' || rfid === 'READY' ? 'READY' : rfid,
                        rfidVersion: ver,
                        cardStatus: isCardRegistered ? 'REGISTERED' : 'NONE',
                        cardRegistered: isCardRegistered,
                        doorState: (door === 'LOCKED' || door === 'KAPALI') ? 'LOCKED' : 'OPEN',
                        mode: (mode === 'UNSAFE' || mode === 'INSECURE' || mode === 'PIN_ONLY') ? 'INSECURE' : 'SECURE',
                        rfidRequired: !(mode === 'UNSAFE' || mode === 'INSECURE' || mode === 'PIN_ONLY'),
                        networkStatus: 'CONNECTED' // Status geldiyse bağlıyız demektir
                    });
                } 
            },

            // --- Mode Changes & System Info ---
            { pattern: /Mod:\s*SAFE/i,   type: 'MODE_SAFE',   msg: 'System operating in SECURE mode (MFA)',   severity: 'INFO',    action: () => StateService.updateState({ mode: 'SECURE',   rfidRequired: true  }) },
            { pattern: /Mod:\s*UNSAFE/i, type: 'MODE_UNSAFE', msg: 'System operating in INSECURE mode (PIN only)', severity: 'WARNING', action: () => StateService.updateState({ mode: 'INSECURE', rfidRequired: false }) },

            // --- WiFi / Network Status ---
            { pattern: /WIFI:(CONNECTED|BAGLANDI)/i,    type: 'WIFI_OK',   msg: 'WiFi connection established',  severity: 'SUCCESS', action: () => StateService.updateState({ networkStatus: 'CONNECTED' }) },
            { pattern: /WIFI:(DISCONNECTED|KOPDU)/i,    type: 'WIFI_FAIL', msg: 'WiFi connection lost',         severity: 'DANGER',  action: () => StateService.updateState({ networkStatus: 'DISCONNECTED' }) },
            { pattern: /WIFI:(CONNECTING|BAGLANILIYOR)/i, type: 'WIFI_WAIT', msg: 'WiFi connecting...',           severity: 'INFO',    action: () => StateService.updateState({ networkStatus: 'CONNECTING' }) },

            // --- RFID / Card Events ---
            { pattern: /(?:\[HACKED DATA\]\s*)?KART OKUTUN/i,           type: 'CARD_WAIT', msg: 'Waiting for RFID card swipe...',    severity: 'INFO',    action: () => StateService.updateState({ isWaitingForCard: true }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?Kart UID:\s*([A-Z0-9]+)/i, type: 'CARD_READ', msg: 'RFID Card Detected',              severity: 'INFO',    action: (m) => StateService.updateState({ lastCardUid: m[1] }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?KART TANIMLANDI/i,        type: 'CARD_OK',   msg: 'RFID Authentication Successful',   severity: 'SUCCESS', action: () => StateService.updateState({ isWaitingForCard: false }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?KART HATALI/i,           type: 'CARD_FAIL', msg: 'Invalid RFID Card Detected',      severity: 'WARNING', action: () => {} },

            // --- Access Control ---
            { pattern: /(?:\[HACKED DATA\]\s*)?ERISIM VERILDI/i,                      type: 'ACCESS_GRANTED', msg: 'Door Unlocked: Access Granted', severity: 'SUCCESS', action: () => {
                const state = StateService.getState();
                const verifiedPin = state.pendingPin;
                StateService.updateState({ 
                    doorState: 'OPEN',   
                    failedAttempts: 0,
                    actualPin: verifiedPin || state.actualPin,
                    lastSniffedPin: verifiedPin || state.lastSniffedPin,
                    isSniffedPinValid: verifiedPin ? true : state.isSniffedPinValid,
                    pendingPin: null
                });
            }},
            { pattern: /(?:\[HACKED DATA\]\s*)?ERISIM REDDEDILDI/i,  type: 'ACCESS_DENIED',  msg: 'Access Denied',                 severity: 'WARNING', action: () => {
                const state = StateService.getState();
                const wrongPin = state.pendingPin;
                
                // Eğer daha önce doğru bir şifre yakaladıysak, yanlış denemelerin onu ezmesine izin verme!
                if (state.isSniffedPinValid) {
                    StateService.updateState({ 
                        doorState: 'LOCKED',
                        pendingPin: null
                    });
                } else {
                    StateService.updateState({ 
                        doorState: 'LOCKED',
                        lastSniffedPin: wrongPin || state.lastSniffedPin,
                        isSniffedPinValid: wrongPin ? false : state.isSniffedPinValid,
                        pendingPin: null
                    });
                }
            }},
            { pattern: /(?:\[HACKED DATA\]\s*)?KAPI KAPANDI/i,       type: 'DOOR_CLOSED',    msg: 'Door Secured Automatically',    severity: 'INFO',    action: () => StateService.updateState({ doorState: 'LOCKED' }) },

            // --- Alarm & Lockout ---
            { pattern: /(?:\[HACKED DATA\]\s*)?ALARM AKTIF/i,                                            type: 'ALARM_ON',  msg: 'SECURITY BREACH: Alarm Triggered!',              severity: 'DANGER',  action: () => StateService.updateState({ alarmStatus: 'ACTIVE' }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?ALARM\s*(?:DURDURULDU|KAPANDI|RESET|DEVRE DISI)/i,       type: 'ALARM_OFF', msg: 'Alarm deactivated',                               severity: 'INFO',    action: () => StateService.updateState({ alarmStatus: 'IDLE', lockout: false }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?LOCKOUT/i,                                                type: 'LOCKOUT',   msg: 'System Lockout engaged due to brute force',       severity: 'DANGER',  action: () => StateService.updateState({ lockout: true }) },

            // --- PIN Intercept / Sniff ---
            { pattern: /(?:\[HACKED DATA\]\s*)?PIN_SET;PIN=([0-9]+)/i, type: 'PIN_UPDATE', msg: 'System PIN configuration active', severity: 'INFO', action: (m) => {
                const rawPin = m[1];
                const isSecure = rawPin.length >= 6;
                const displayPin = isSecure ? crypto.createHash('sha256').update(rawPin).digest('hex').substring(0, 16) + "..." : "***";
                
                const state = StateService.getState();
                const isChangeSuccess = state.pendingPin === rawPin;
                
                StateService.updateState({ 
                    actualPin: rawPin,
                    lastSniffedPin: isChangeSuccess ? rawPin : state.lastSniffedPin,
                    isSniffedPinValid: isChangeSuccess ? true : state.isSniffedPinValid,
                    lastDisplayPin: displayPin,
                    mode: isSecure ? 'SECURE' : 'INSECURE',
                    rfidRequired: isSecure,
                    pendingPin: null
                });
            }},
            { pattern: /(?:\[HACKED DATA\]\s*)?PIN_SET;HASH=([A-F0-9]{8,64})/i, type: 'PIN_HASH_UPDATE', msg: 'Secure PIN hash configuration active', severity: 'INFO', action: (m) => {
                StateService.updateState({
                    lastSniffedPin: null,
                    lastDisplayPin: `${m[1].substring(0, 16)}...`,
                    mode: 'SECURE',
                    rfidRequired: true
                });
            }},
            { pattern: /(?:\[HACKED DATA\]\s*)?PIN_CLEARED/i, type: 'PIN_CLEARED', msg: 'System PIN cleared', severity: 'INFO', action: () => {
                StateService.updateState({ actualPin: null, lastSniffedPin: null, lastDisplayPin: null });
            }},
            { pattern: /PIN=([0-9]{3,9})/i, type: 'PIN_SNIFFED', msg: 'PIN sequence intercepted over serial!', severity: 'WARNING', action: (m) => {
                const rawPin = m[1];
                const isSecure = rawPin.length >= 6;
                const displayPin = isSecure ? crypto.createHash('sha256').update(rawPin).digest('hex').substring(0, 16) + "..." : "***";
                
                StateService.updateState({ 
                    pendingPin: rawPin,
                    lastDisplayPin: displayPin
                });
            }},
            { pattern: /DATA=([0-9A-F]+)/i, type: 'DATA_SNIFFED', msg: 'Encrypted DATA sequence intercepted over serial!', severity: 'WARNING', action: (m) => {
                const rawData = m[1];
                const displayData = rawData.substring(0, 16) + '...';
                
                // Güçlü ve kırılması imkansız 64 karakterli SHA-256 hash üretimi
                const sha256Hash = crypto.createHash('sha256').update(rawData).digest('hex').toUpperCase();
                
                StateService.updateState({ 
                    lastDisplayPin: displayData
                });
                
                StateService.addLog(`GÜVENLİ PAKET YAKALANDI: [HASH: ${sha256Hash}] - Kırılması imkansız benzersiz siber güvenlik karması (SHA-256)!`, 'WARNING', 'DOOR_ESP32_WIFI', { eventType: 'DATA_SNIFFED' });
            }},

            // --- Password Change & Commands Flow ---
            { pattern: /SISTEM GUNCEL/i,     type: 'PIN_CHANGED',      msg: 'System Configuration Updated Successfully!',    severity: 'SUCCESS', action: () => {} },
            { pattern: /Komut: (CFGNEW|CFGCHG|PIN_SET) \| Mod:/i, type: 'CONFIG_CHANGE', msg: 'Configuration / Password Change Initiated', severity: 'WARNING', action: () => {} },
            { pattern: /Komut: (AUTH|LOGIN|VERIFY) \| Mod:/i, type: 'AUTH_ATTEMPT', msg: 'Authentication Attempt Detected', severity: 'INFO', action: () => {} },
            { pattern: /PIN_SET_FAIL/i, type: 'PIN_CHANGE_FAIL', msg: 'Configuration Update Rejected by Hardware', severity: 'DANGER', action: () => {} },

            // --- PIN OK / FAIL (exact ESP32 output) ---
            { pattern: /(?:\[HACKED DATA\]\s*)?^PIN OK$/i,   type: 'PIN_OK',   msg: 'PIN validation successful', severity: 'SUCCESS', action: () => StateService.updateState({ doorState: 'OPEN', failedAttempts: 0 }) },
            { pattern: /(?:\[HACKED DATA\]\s*)?^PIN FAIL$/i, type: 'PIN_FAIL', msg: 'Invalid PIN attempt',        severity: 'WARNING', action: () => StateService.updateState({ failedAttempts: StateService.getState().failedAttempts + 1 }) },

            // --- Network Information & General Parsing from Hack ---
            { pattern: /(?:\[HACKED DATA\]\s*)?Gelen Veri:\s*(.*)/i, type: 'HACKED_COMMAND', msg: 'Intercepted Command Over Network', severity: 'WARNING', action: (m) => {
                StateService.addLog(`INTERCEPTED: ${m[1]}`, 'WARNING', 'DOOR_ESP32_WIFI');
            }},

            // --- System Boot / Ready ---
            { pattern: /(?:\[HACKED DATA\]\s*)?SYSTEM BOOT/i,                                type: 'BOOT',      msg: 'Hardware system initialized', severity: 'INFO', action: () => StateService.reset() },
            { pattern: /(?:\[HACKED DATA\]\s*)?(?:SISTEM\s*HAZIR|^HAZIR$|^READY$)/i,       type: 'SYS_READY', msg: 'System ready',                severity: 'INFO', action: () => {} },
        ];
    }

    normalizeLine(line) {
        return line
            .replace(/[\u0130I\u0131]/g, 'I')
            .replace(/[\u015E\u015F]/g, 'S')
            .replace(/[\u011E\u011F]/g, 'G')
            .replace(/[\u00DC\u00FC]/g, 'U')
            .replace(/[\u00D6\u00F6]/g, 'O')
            .replace(/[\u00C7\u00E7]/g, 'C');
    }

    parse(line) {
        if (!line || typeof line !== 'string') return;

        // Strip \r leftover from \r\n in case delimiter mismatch
        const trimmed = line.replace(/\r/g, '').trim();
        if (!trimmed) return;
        const normalized = this.normalizeLine(trimmed);

        let matched = false;
        for (const mapping of this.mappings) {
            const match = normalized.match(mapping.pattern);
            if (match) {
                try {
                    mapping.action(match);
                } catch (e) {
                    console.error(`[PARSER] Action error for ${mapping.type}:`, e.message);
                }

                // Silence periodic STATUS_UPDATE and DATA_SNIFFED from the log timeline (handled customly)
                if (mapping.type !== 'STATUS_UPDATE' && mapping.type !== 'DATA_SNIFFED') {
                    StateService.addLog(mapping.msg, mapping.severity, 'DOOR_ESP32', { eventType: mapping.type, raw: trimmed });
                }
                matched = true;
                break;
            }
        }

        // Catch-all: any unrecognized line still appears in Security Logs
        if (!matched) {
            StateService.addLog(`[RAW] ${trimmed}`, 'INFO', 'DOOR_ESP32', { eventType: 'GENERIC', raw: trimmed });
        }
    }
}

module.exports = new ParserService();
