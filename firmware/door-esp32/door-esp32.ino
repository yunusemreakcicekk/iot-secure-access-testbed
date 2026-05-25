#include <WiFi.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Preferences.h>

const char* ssid = "CHANGE_ME_DOOR_AP_SSID";
const char* password = "CHANGE_ME_DOOR_AP_PASSWORD";

WiFiServer server(80); // Fiziksel panel icin
WiFiServer monitorServer(81); // Hacker paneli (Siber Sızma) icin

// true ise ESP32 resetlenince/kapatilip acilinca PIN tekrar 123 olur.
// false yaparsan degistirilen PIN kalici hafizada saklanir.
const bool RESET_PIN_ON_BOOT = true;

// Donanim pinleri
#define RED_LED 26
#define GREEN_LED 25
#define BUZZER 27
#define SERVO_PIN 13

// RFID pinleri
#define SS_PIN 5
#define RST_PIN 22

Servo kapiServo;
MFRC522 rfid(SS_PIN, RST_PIN);
Preferences prefs;

// Dogru bilgiler
String dogruPIN = "000";
String dogruKart = "CHANGE_ME_RFID_UID";
String aktifMod = "UNSAFE";
bool sifreVar = false;

// Guvenlik degiskenleri
int yanlisDeneme = 0;
int maxDeneme = 3;
bool sistemKilitli = false;
unsigned long lockoutStartTime = 0;

// Aktif Hacker (Monitor) baglantisi
WiFiClient activeMonitorClient;

// Fonksiyon prototipleri
String veriyiIsle(String gelenVeri);
void erisimVer();
void erisimRed();
String kartOku();
void alarmCal();
String sifreCoz(String veri);
void pinKaydet(String yeniPin);
void handleSerialCommand();
void sistemResetle(bool fabrikaAyari = false);
bool pinUzunluguGecerli(String pin, String mode);
bool pinRakamMi(String pin);
String pinHashGoster(String pin);
void pinDurumYazdir();
void sendToMonitor(String message); // Hacker paneline veri yolla

void setup() {
  Serial.begin(115200);
  prefs.begin("kapi", false);
  if (RESET_PIN_ON_BOOT) {
    dogruPIN = "000";
    dogruKart = "CHANGE_ME_RFID_UID";
    aktifMod = "UNSAFE";
    sifreVar = false;
    prefs.putString("pin", dogruPIN);
    prefs.putString("kart", dogruKart);
    prefs.putString("mode", aktifMod);
    prefs.putBool("sifreVar", sifreVar);
    Serial.println("BOOT_RESET;PIN_CLEARED");
  } else {
    dogruPIN = prefs.getString("pin", "000");
    dogruKart = prefs.getString("kart", dogruKart);
    aktifMod = prefs.getString("mode", "UNSAFE");
    sifreVar = prefs.getBool("sifreVar", false);
  }

  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(BUZZER, LOW);

  kapiServo.setPeriodHertz(50);
  kapiServo.attach(SERVO_PIN, 500, 2400);
  kapiServo.write(0); // kapi kapali

  SPI.begin(18, 19, 23, 5);   // SCK, MISO, MOSI, SS
  rfid.PCD_Init();
  
  // RFID Ready check
  byte v = rfid.PCD_ReadRegister(rfid.VersionReg);
  bool rfidReady = (v != 0x00 && v != 0xFF);

  WiFi.mode(WIFI_AP);
  bool apStarted = WiFi.softAP(ssid, password);

  Serial.println("Access Point Hazir");
  Serial.print("AP_STATUS: ");
  Serial.println(apStarted ? "OK" : "FAIL");
  Serial.print("IP: ");
  Serial.println(WiFi.softAPIP());
  pinDurumYazdir();

  // RFID Version Check for Diagnostics
  v = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.print("RFID_VERSION: 0x");
  Serial.println(v, HEX);

  // Initial Status Report
  String initStatus = "STATUS;DEVICE=DOOR;RFID=";
  initStatus += ((v != 0x00 && v != 0xFF) ? "READY" : "ERROR");
  initStatus += ";CARD=NONE;DOOR=LOCKED;MODE=";
  initStatus += aktifMod;
  initStatus += ";VER=0x";
  initStatus += String(v, HEX);
  Serial.println(initStatus);

  server.begin();
  monitorServer.begin(); // Hacker dinleme portunu ac
}

unsigned long lastStatusUpdate = 0;

void loop() {
  handleSerialCommand();

  // Lockout 30 saniye otomatik kilit acma kontrolu
  if (sistemKilitli && (millis() - lockoutStartTime >= 30000)) {
    sistemKilitli = false;
    yanlisDeneme = 0;
    Serial.println("ALARM DURDURULDU;LOCKOUT_TIMEOUT");
    sendToMonitor("ALARM DURDURULDU;LOCKOUT_TIMEOUT");
  }

  // Hacker Paneli (Monitor) Baglanti Kontrolu
  if (!activeMonitorClient || !activeMonitorClient.connected()) {
    if (monitorServer.hasClient()) {
      if (activeMonitorClient) activeMonitorClient.stop();
      activeMonitorClient = monitorServer.accept();
      Serial.println("[HACKER PANEL] Baglandi!");
      pinDurumYazdir();
    }
  }

  // Hacker Panelinden Gelen Komutlari Dinle
  if (activeMonitorClient && activeMonitorClient.connected()) {
    if (activeMonitorClient.available()) {
      String hackerCmd = activeMonitorClient.readStringUntil('\n');
      hackerCmd.trim();
      if (hackerCmd.length() > 0) {
        Serial.println("[HACKER CMD] " + hackerCmd);
        String sonuc = veriyiIsle(hackerCmd);
        activeMonitorClient.println(sonuc);
      }
    }
  }

  // Periodic Status Report (Every 5 seconds)
  if (millis() - lastStatusUpdate > 5000) {
    lastStatusUpdate = millis();
    
    // Check RFID again for version (simple health check)
    byte v = rfid.PCD_ReadRegister(rfid.VersionReg);
    bool rfidReady = (v != 0x00 && v != 0xFF);
    
    String statusStr = "STATUS;DEVICE=DOOR;RFID=";
    statusStr += (rfidReady ? "READY" : "ERROR");
    statusStr += ";CARD=";
    statusStr += (yanlisDeneme == 0 ? "NONE" : "ATTEMPTING"); // Simple mapping
    statusStr += ";DOOR=";
    statusStr += (digitalRead(GREEN_LED) == HIGH ? "UNLOCKED" : "LOCKED");
    statusStr += ";MODE=";
    statusStr += aktifMod;
    statusStr += ";VER=0x";
    statusStr += String(v, HEX);
    
    Serial.println(statusStr);
    sendToMonitor(statusStr); // Hacker paneline gonder
  }

  // Standalone RFID Check (Dogrudan kartla giris icin)
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    String kartLog = "Stand-alone Kart UID: " + uid;
    Serial.println(kartLog);
    sendToMonitor(kartLog);
    
    if (uid == dogruKart) {
      Serial.println("KART TANIMLANDI (STANDALONE)");
      sendToMonitor("KART TANIMLANDI (STANDALONE)");
      digitalWrite(GREEN_LED, HIGH);
      delay(500);
      digitalWrite(GREEN_LED, LOW);
    } else {
      Serial.println("KART HATALI (STANDALONE)");
      sendToMonitor("KART HATALI (STANDALONE)");
      erisimRed();
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  WiFiClient client = server.available();

  if (client) {
    Serial.println("Client baglandi");

    String data = "";
    unsigned long startTime = millis();

    while (client.connected() && millis() - startTime < 3000) {
      while (client.available()) {
        char c = client.read();

        if (c == '\r') continue;

        if (c == '\n') {
          if (data.length() > 0) {
            String logMsg = "Gelen Veri: " + data;
            Serial.println(logMsg);
            sendToMonitor(logMsg);

            String sonuc = veriyiIsle(data);
            client.println(sonuc);
            client.flush();

            data = "";
            client.stop();
            Serial.println("Client ayrildi");
            return;
          }
        } else {
          data += c;
        }
      }
    }

    client.stop();
    Serial.println("Client ayrildi");
  }
}

void sendToMonitor(String message) {
  if (activeMonitorClient && activeMonitorClient.connected()) {
    activeMonitorClient.println(message);
  }
}

String sifreCoz(String veri) {
  String sonuc = "";
  for (int i = 0; i < veri.length(); i += 2) {
    // Hex to Char
    String hexByte = veri.substring(i, i + 2);
    char c = (char) strtol(hexByte.c_str(), NULL, 16);
    // XOR decode (Panel'deki 0x5A ile ayni)
    sonuc += char(c ^ 0x5A);
  }
  return sonuc;
}

String veriyiIsle(String gelenVeri) {
  gelenVeri.trim();
  Serial.print("Gelen Ham Veri: ");
  Serial.println(gelenVeri);

  // RESET komutu
  if (gelenVeri == "RESET") {
    sistemResetle(false);
    return "OK;RESET";
  }

  if (gelenVeri == "RESET_PIN" || gelenVeri == "FACTORY_RESET") {
    sistemResetle(true);
    return "OK;FACTORY_RESET";
  }

  if (gelenVeri == "MASTER_UNLOCK") {
    sistemKilitli = false;
    yanlisDeneme = 0;
    erisimVer();
    return "OK;MASTER_UNLOCK";
  }

  if (gelenVeri == "HAS_PIN") {
    if (!sifreVar) return "ERROR;NO_PIN";
    return "OK;PIN_SET;MODE=" + aktifMod;
  }

  if (gelenVeri.startsWith("PIN=")) {
    String yeniPin = gelenVeri.substring(4);
    yeniPin.trim();
    if (yeniPin.length() == 9) {
      aktifMod = "SAFE";
    } else if (yeniPin.length() == 3) {
      aktifMod = "UNSAFE";
    } else {
      Serial.println("PIN_SET_FAIL");
      return "ERROR;PIN_LENGTH";
    }
    if (!pinUzunluguGecerli(yeniPin, aktifMod)) {
      Serial.println("PIN_SET_FAIL");
      return "ERROR;PIN_FORMAT";
    }
    pinKaydet(yeniPin);
    sifreVar = true;
    prefs.putBool("sifreVar", sifreVar);
    prefs.putString("mode", aktifMod);
    pinDurumYazdir();
    return "OK;GUNCEL";
  }

  // Degiskenleri hazirla
  String cmd = "";
  String mode = "";
  String pin = "";
  String data = "";

  // Basit bir parcalama (Semicolon bazli)
  int firstSemi = gelenVeri.indexOf(';');
  if (firstSemi != -1) {
    cmd = gelenVeri.substring(0, firstSemi);
    String rest = gelenVeri.substring(firstSemi + 1);
    
    // Parametreleri ayikla
    while (rest.length() > 0) {
      int nextSemi = rest.indexOf(';');
      String pair = (nextSemi == -1) ? rest : rest.substring(0, nextSemi);
      
      if (pair.startsWith("MODE=")) mode = pair.substring(5);
      else if (pair.startsWith("PIN=")) pin = pair.substring(4);
      else if (pair.startsWith("DATA=")) data = pair.substring(5);
      
      if (nextSemi == -1) break;
      rest = rest.substring(nextSemi + 1);
    }
  } else {
    cmd = gelenVeri;
  }

  // Kilitliyse yeni istekleri alma
  if (sistemKilitli && cmd != "RESET") {
    Serial.println("SISTEM KILITLI!");
    alarmCal();
    return "ERROR;LOCKOUT";
  }

  String logInfo = "Komut: " + cmd + " | Mod: " + mode + " | PIN: " + (pin == "" ? "[DATA]" : "[HIDDEN]");
  Serial.println(logInfo);
  sendToMonitor(logInfo);

  // GUVENLI MOD KONTROLU (Sifre degistirme veya Giris)
  String okunanUID = "";
  if (mode == "SAFE") {
    Serial.println("KART OKUTUN");
    sendToMonitor("KART OKUTUN");
    okunanUID = kartOku();
    
    // Yalnızca giriş/doğrulama işlemlerinde (AUTH, LOGIN, VERIFY) kayıtlı kartı zorunlu kıl.
    // Şifre değiştirme veya yeni şifre oluşturma işlemlerinde (CFGNEW, CFGCHG) okunan yeni kartı kabul et ve kaydet.
    if (cmd != "CFGNEW" && cmd != "CFGCHG" && cmd != "PIN_SET" && okunanUID != dogruKart) { 
      Serial.println("KART HATALI! ISLEM REDDEDILDI");
      sendToMonitor("KART HATALI! ISLEM REDDEDILDI");
      erisimRed();
      return "ERROR;INVALID_CARD";
    }

    Serial.println("KART TANIMLANDI");
    sendToMonitor("KART TANIMLANDI");
  }

  // Islem Tipleri
  if (cmd == "CFGNEW" || cmd == "PIN_SET" || cmd == "CFGCHG") {
    String yeniPin = (pin != "") ? pin : (data != "") ? sifreCoz(data) : "";
    
    if (yeniPin != "") {
      if (!pinUzunluguGecerli(yeniPin, mode)) {
        Serial.println("PIN_SET_FAIL");
        return "ERROR;PIN_LENGTH";
      }

      pinKaydet(yeniPin);
      sifreVar = true;
      prefs.putBool("sifreVar", sifreVar);
      aktifMod = (mode == "SAFE") ? "SAFE" : "UNSAFE";
      prefs.putString("mode", aktifMod);
      
      // Eger SAFE moddaysa ve bir kart okunmussa, onu kaydet
      if (mode == "SAFE" && okunanUID != "") {
        dogruKart = okunanUID; 
        prefs.putString("kart", dogruKart);
        Serial.print("YENI KART KAYDEDILDI: ");
        Serial.println(dogruKart);
      }
      
      pinDurumYazdir();
      Serial.println("SISTEM GUNCEL");
      return "OK;GUNCEL";
    }
    return "ERROR;NO_PIN";
  } 
  else if (cmd == "AUTH" || cmd == "LOGIN" || cmd == "VERIFY" || cmd.length() == 0 || cmd == "PIN") {
    String girilenPin = (pin != "") ? pin : (data != "") ? sifreCoz(data) : "";

    if (!sifreVar) {
      Serial.println("SIFRE YOK");
      return "ERROR;NO_PIN";
    }
    
    if (girilenPin == dogruPIN) {
      if (cmd == "VERIFY") {
        return "OK;VERIFY";
      }
      yanlisDeneme = 0;
      erisimVer();
      return "OK;ERISIM_VERILDI";
    } else {
      if (aktifMod == "SAFE") {
        yanlisDeneme++;
        if (yanlisDeneme >= maxDeneme) {
          sistemKilitli = true;
          lockoutStartTime = millis();
          Serial.println("LOCKOUT;SISTEM KILITLENDI");
          sendToMonitor("LOCKOUT;SISTEM KILITLENDI");
          alarmCal();
          return "ERROR;LOCKOUT";
        } else {
          erisimRed();
          return "ERROR;YANLIS_PIN";
        }
      } else {
        // UNSAFE modda kitleme yok, sadece hata don!
        yanlisDeneme = 0;
        erisimRed();
        return "ERROR;YANLIS_PIN";
      }
    }
  }
  return "ERROR;BILINMEYEN_KOMUT";
}

void pinKaydet(String yeniPin) {
  yeniPin.trim();
  if (yeniPin.length() != 3 && yeniPin.length() != 9) {
    Serial.println("PIN_SET_FAIL");
    return;
  }
  for (int i = 0; i < yeniPin.length(); i++) {
    if (!isDigit(yeniPin[i])) {
      Serial.println("PIN_SET_FAIL");
      return;
    }
  }

  dogruPIN = yeniPin;
  prefs.putString("pin", dogruPIN);
}

String pinHashGoster(String pin) {
  uint32_t hash = 2166136261UL;
  for (int i = 0; i < pin.length(); i++) {
    hash ^= (uint8_t)pin[i];
    hash *= 16777619UL;
  }

  char buffer[9];
  snprintf(buffer, sizeof(buffer), "%08lX", (unsigned long)hash);
  return String(buffer);
}

void pinDurumYazdir() {
  String out = "";
  if (!sifreVar) {
    out = "PIN_CLEARED";
  } else if (aktifMod == "SAFE") {
    out = "PIN_SET;HASH=" + pinHashGoster(dogruPIN);
  } else {
    out = "PIN_SET;PIN=" + dogruPIN;
  }
  Serial.println(out);
  sendToMonitor(out);
}

bool pinUzunluguGecerli(String pin, String mode) {
  if (!pinRakamMi(pin)) return false;
  if (mode == "SAFE") return pin.length() == 9;
  return pin.length() == 3;
}

bool pinRakamMi(String pin) {
  for (int i = 0; i < pin.length(); i++) {
    if (!isDigit(pin[i])) return false;
  }
  return true;
}

void handleSerialCommand() {
  if (!Serial.available()) return;

  String komut = Serial.readStringUntil('\n');
  komut.trim();
  if (komut.length() == 0) return;

  Serial.print("SERIAL_CMD: ");
  Serial.println(komut);

  String sonuc = veriyiIsle(komut);
  Serial.print("SERIAL_RESULT: ");
  Serial.println(sonuc);
}

void sistemResetle(bool fabrikaAyari) {
  sistemKilitli = false;
  yanlisDeneme = 0;
  digitalWrite(BUZZER, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
  kapiServo.write(0);

  if (fabrikaAyari) {
    dogruPIN = "000";
    dogruKart = "CHANGE_ME_RFID_UID";
    aktifMod = "UNSAFE";
    sifreVar = false;
    prefs.putString("pin", dogruPIN);
    prefs.putString("kart", dogruKart);
    prefs.putString("mode", aktifMod);
    prefs.putBool("sifreVar", sifreVar);
    Serial.println("FABRIKA AYARINA DONDU");
    sendToMonitor("FABRIKA AYARINA DONDU");
    pinDurumYazdir();
  } else {
    Serial.println("SISTEM RESETLENDI");
    sendToMonitor("SISTEM RESETLENDI");
  }
}

String kartOku() {
  Serial.println("KART BEKLENIYOR...");
  unsigned long lastReset = millis();

  while (true) {
    yield();
    
    // Her 2 saniyede bir okuyucuyu tazele (Takilmalari onlemek icin)
    if (millis() - lastReset > 2000) {
      rfid.PCD_Init();
      lastReset = millis();
    }

    if (!rfid.PICC_IsNewCardPresent()) continue;
    if (!rfid.PICC_ReadCardSerial()) continue;

    // Kart okundu!
    digitalWrite(BUZZER, HIGH);
    delay(150);
    digitalWrite(BUZZER, LOW);

    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    Serial.print("Kart UID: ");
    Serial.println(uid);
    sendToMonitor("Kart UID: " + uid);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    return uid;
  }
}

void erisimVer() {
  Serial.println("ERISIM VERILDI");
  sendToMonitor("ERISIM VERILDI");

  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);

  digitalWrite(GREEN_LED, HIGH);
  kapiServo.write(90);

  delay(3000);

  kapiServo.write(0);
  digitalWrite(GREEN_LED, LOW);
  Serial.println("KAPI KAPANDI");
  sendToMonitor("KAPI KAPANDI");
}

void erisimRed() {
  Serial.println("ERISIM REDDEDILDI");
  sendToMonitor("ERISIM REDDEDILDI");

  digitalWrite(GREEN_LED, LOW);
  kapiServo.write(0);

  digitalWrite(RED_LED, HIGH);
  digitalWrite(BUZZER, HIGH);

  delay(2000);

  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);
}

void alarmCal() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(BUZZER, HIGH);
    digitalWrite(RED_LED, HIGH);
    delay(300);
    digitalWrite(BUZZER, LOW);
    digitalWrite(RED_LED, LOW);
    delay(300);
  }
}
