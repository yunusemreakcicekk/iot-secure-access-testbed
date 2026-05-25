#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <WiFi.h>
#include <Preferences.h>

// LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Wi-Fi
const char* ssid = "CHANGE_ME_DOOR_AP_SSID";
const char* password = "CHANGE_ME_DOOR_AP_PASSWORD";
const char* host = "192.168.4.1";
const int port = 80; // Fiziksel panel port 80 üzerinden baglanir

// true ise panel resetlenince/kapatilip acilinca kayitli sifre unutulur.
// false yaparsan panel kayitli sifreyi kalici hafizada saklar.
const bool RESET_PANEL_ON_BOOT = true;

// Butonlar
#define BUTTON_UNSAFE 19
#define BUTTON_SAFE   15

// Keypad
const byte ROWS = 4;
const byte COLS = 3;

char keys[ROWS][COLS] = {
  {'1','2','3'},
  {'4','5','6'},
  {'7','8','9'},
  {'*','0','#'}
};

byte rowPins[ROWS] = {32, 33, 25, 18};
byte colPins[COLS] = {27, 14, 13};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
Preferences prefs;

// State
enum SystemState {
  HOME_SCREEN,
  SETTINGS_SCREEN,
  CREATE_AUTH_SCREEN,
  CREATE_MODE_SELECT,
  PIN_CREATE,
  LOGIN_SCREEN,
  CHANGE_CURRENT_PIN,
  CHANGE_MODE_SELECT,
  CHANGE_NEW_PIN
};

SystemState state = HOME_SCREEN;

// Değişkenler
bool sifreVar = false;
bool guvenliMod = false;

String kayitliPIN = "";
String girilenPIN = "";
int hedefPinUzunlugu = 0;

// Prototipler
void homeEkrani();
void settingsEkrani();
void mesajGoster(String satir1, String satir2, int bekle = 2000);
void panelKayitKaydet();
bool wifiBaglan(unsigned long timeoutMs = 15000);
bool pinDogrulaKapida(String pin);
bool pinUzunluguTamam(String pin);
bool kapiSifreVarMi();

// Çalışan tuşlar
bool gecerliTusMu(char key) {
  return (key >= '0' && key <= '9');
}

bool geriTusMu(char key) {
  return (key == '*');
}

// XOR şifreleme
String sifreleVeri(String veri) {
  String sonuc = "";
  const char* hexChars = "0123456789ABCDEF";

  for (int i = 0; i < veri.length(); i++) {
    uint8_t x = ((uint8_t)veri[i]) ^ 0x5A;
    sonuc += hexChars[(x >> 4) & 0x0F];
    sonuc += hexChars[x & 0x0F];
  }

  return sonuc;
}

void yildizGoster(String veri) {
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) lcd.print(" ");
  lcd.setCursor(0, 1);

  for (int i = 0; i < veri.length(); i++) {
    lcd.print("*");
  }
}

void mesajGoster(String satir1, String satir2, int bekle) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(satir1);
  lcd.setCursor(0, 1);
  lcd.print(satir2);
  delay(bekle);
}

void homeEkrani() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("2:Sifre Gir");
  lcd.setCursor(0, 1);
  lcd.print("3:Ayarlar");
}

void settingsEkrani() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("2:Degistir");
  lcd.setCursor(0, 1);
  lcd.print("3:Olustur");
}

// Kapı onayı bekleyen komut gönderme fonksiyonu
bool komutGonder(String komutTip, String mod, String pin) {
  WiFiClient client;

  if (WiFi.status() != WL_CONNECTED && !wifiBaglan(7000)) {
    mesajGoster("WIFI HATASI", "Kapi AP Yok");
    return false;
  }

  if (!client.connect(host, port)) {
    mesajGoster("BAGLANTI HATASI", "Kapiya Erismedi");
    return false;
  }

  String paket = "";

  if (mod == "SAFE") {
    paket = komutTip + ";MODE=SAFE;DATA=" + sifreleVeri(pin);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("KAPIDA KARTI");
    lcd.setCursor(0, 1);
    lcd.print("OKUTUNUZ...");
  } 
  else {
    paket = komutTip + ";MODE=UNSAFE;PIN=" + pin;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Gonderiliyor...");
  }

  client.println(paket);
  Serial.println("Gonderilen: " + paket);

  unsigned long baslangic = millis();
  bool basarili = false;

  while (client.connected() && millis() - baslangic < 20000) {
    if (client.available()) {
      String cevap = client.readStringUntil('\n');
      cevap.trim();

      Serial.println("Kapidan Cevap: " + cevap);

      if (cevap.indexOf("OK;") != -1) {
        mesajGoster("ISLEM BASARILI", mod == "SAFE" ? "Kart Onaylandi" : "Tamamlandi");
        basarili = true;
        break;
      } 
      else if (cevap.indexOf("NO_PIN") != -1) {
        mesajGoster("Sifre Yok", "Once Olustur");
        break;
      }
      else if (cevap.indexOf("ERROR;") != -1) {
        mesajGoster("HATA!", "Kapi Reddetti");
        break;
      }
    }

    delay(50);
  }

  if (!basarili && millis() - baslangic >= 20000) {
    mesajGoster("ZAMAN ASIMI", "Kart Okunmadi");
  }

  client.stop();

  state = HOME_SCREEN;
  girilenPIN = "";
  homeEkrani();

  return basarili;
}

void setup() {
  Serial.begin(115200);
  prefs.begin("panel", false);
  if (RESET_PANEL_ON_BOOT) {
    prefs.clear();
    kayitliPIN = "";
    sifreVar = false;
    guvenliMod = false;
    Serial.println("PANEL_BOOT_RESET");
  } else {
    kayitliPIN = prefs.getString("pin", "");
    sifreVar = prefs.getBool("sifreVar", kayitliPIN.length() > 0);
    guvenliMod = prefs.getBool("guvenliMod", false);
  }

  lcd.init();
  lcd.backlight();

  pinMode(BUTTON_UNSAFE, INPUT_PULLUP);
  pinMode(BUTTON_SAFE, INPUT_PULLUP);

  if (digitalRead(BUTTON_UNSAFE) == LOW && digitalRead(BUTTON_SAFE) == LOW) {
    prefs.clear();
    kayitliPIN = "";
    sifreVar = false;
    guvenliMod = false;
    mesajGoster("PANEL RESET", "Kayitlar Silindi", 2500);
  }

  lcd.clear();
  lcd.print("WiFi Baglaniyor");

  if (wifiBaglan(15000)) {
    mesajGoster("WiFi Baglandi", WiFi.localIP().toString());
  } else {
    mesajGoster("WiFi Yok", "Kapiyi Acin", 2500);
  }
  homeEkrani();
}

void loop() {
  int unsafeState = digitalRead(BUTTON_UNSAFE);
  int safeState = digitalRead(BUTTON_SAFE);
  char key = keypad.getKey();

  if (state == HOME_SCREEN) {
    if (key == '2') {
      if (!kapiSifreVarMi()) {
        mesajGoster("Sifre Yok", "Once Olustur");
        homeEkrani();
      } else {
        hedefPinUzunlugu = guvenliMod ? 9 : 3;
        girilenPIN = "";
        state = LOGIN_SCREEN;

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Sifre Giriniz");
      }
    } 
    else if (key == '3') {
      state = SETTINGS_SCREEN;
      settingsEkrani();
    }
  }

  else if (state == SETTINGS_SCREEN) {
    if (key == '2') {
      if (!kapiSifreVarMi()) {
        mesajGoster("Sifre Yok", "Once Olustur");
        settingsEkrani();
      } else {
        hedefPinUzunlugu = guvenliMod ? 9 : 3;
        girilenPIN = "";
        state = CHANGE_CURRENT_PIN;

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Mevcut Sifre?");
      }
    } 
    else if (key == '3') {
      if (!kapiSifreVarMi()) {
        state = CREATE_MODE_SELECT;

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("1/19:Unsf");
        lcd.setCursor(0, 1);
        lcd.print("2/15:Safe");
      } 
      else {
        hedefPinUzunlugu = guvenliMod ? 9 : 3;
        girilenPIN = "";
        state = CREATE_AUTH_SCREEN;

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Mevcut Sifre?");
      }
    } 
    else if (geriTusMu(key)) {
      state = HOME_SCREEN;
      homeEkrani();
    }
  }

  else if (state == CREATE_AUTH_SCREEN) {
    if (key) {
      if (gecerliTusMu(key) && girilenPIN.length() < 9) {
        girilenPIN += key;
        yildizGoster(girilenPIN);
      } 
      else if (key == '*' && girilenPIN.length() > 0) {
        girilenPIN.remove(girilenPIN.length() - 1);
        yildizGoster(girilenPIN);
      } 
      else if (key == '#' && pinUzunluguTamam(girilenPIN)) {
        if (pinDogrulaKapida(girilenPIN)) {
          girilenPIN = "";
          state = CREATE_MODE_SELECT;

          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("1/19:Unsf");
          lcd.setCursor(0, 1);
          lcd.print("2/15:Safe");
        } 
        else {
          mesajGoster("Yanlis Sifre", "Tekrar Dene");
          girilenPIN = "";

          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Mevcut Sifre?");
        }
      } 
      else if (geriTusMu(key)) {
        state = SETTINGS_SCREEN;
        settingsEkrani();
      }
    }
  }

  else if (state == CREATE_MODE_SELECT) {
    if (unsafeState == LOW || key == '1') {
      guvenliMod = false;
      hedefPinUzunlugu = 3;
      girilenPIN = "";
      state = PIN_CREATE;

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("3 Haneli Sifre");
      delay(250);
    }

    if (safeState == LOW || key == '2') {
      guvenliMod = true;
      hedefPinUzunlugu = 9;
      girilenPIN = "";
      state = PIN_CREATE;

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("9 Haneli Sifre");
      delay(250);
    }

    if (geriTusMu(key)) {
      state = SETTINGS_SCREEN;
      settingsEkrani();
    }
  }

  else if (state == PIN_CREATE) {
    if (key) {
      if (gecerliTusMu(key) && girilenPIN.length() < hedefPinUzunlugu) {
        girilenPIN += key;
        yildizGoster(girilenPIN);
      } 
      else if (key == '*' && girilenPIN.length() > 0) {
        girilenPIN.remove(girilenPIN.length() - 1);
        yildizGoster(girilenPIN);
      } 
      else if (key == '#' && girilenPIN.length() == hedefPinUzunlugu) {

        // KRITIK DUZELTME:
        // Sifre sadece kapi OK cevabi verirse panelde kaydedilir.
        String yeniPIN = girilenPIN;
        if (komutGonder("CFGNEW", guvenliMod ? "SAFE" : "UNSAFE", yeniPIN)) {
          kayitliPIN = yeniPIN;
          sifreVar = true;
          panelKayitKaydet();
        }
      } 
      else if (geriTusMu(key)) {
        state = SETTINGS_SCREEN;
        girilenPIN = "";
        settingsEkrani();
      }
    }
  }

  else if (state == LOGIN_SCREEN) {
    if (key) {
      if (gecerliTusMu(key) && girilenPIN.length() < 9) {
        girilenPIN += key;
        yildizGoster(girilenPIN);
      } 
      else if (key == '*' && girilenPIN.length() > 0) {
        girilenPIN.remove(girilenPIN.length() - 1);
        yildizGoster(girilenPIN);
      } 
      else if (key == '#' && pinUzunluguTamam(girilenPIN)) {
        guvenliMod = girilenPIN.length() == 9;
        komutGonder("AUTH", guvenliMod ? "SAFE" : "UNSAFE", girilenPIN);
      } 
      else if (geriTusMu(key)) {
        state = HOME_SCREEN;
        girilenPIN = "";
        homeEkrani();
      }
    }
  }

  else if (state == CHANGE_CURRENT_PIN) {
    if (key) {
      if (gecerliTusMu(key) && girilenPIN.length() < 9) {
        girilenPIN += key;
        yildizGoster(girilenPIN);
      } 
      else if (key == '*' && girilenPIN.length() > 0) {
        girilenPIN.remove(girilenPIN.length() - 1);
        yildizGoster(girilenPIN);
      } 
      else if (key == '#' && pinUzunluguTamam(girilenPIN)) {
        if (pinDogrulaKapida(girilenPIN)) {
          girilenPIN = "";
          state = CHANGE_MODE_SELECT;

          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Yeni Mod Sec");
          lcd.setCursor(0, 1);
          lcd.print("1/19:Unsf 2/15:S");
        } 
        else {
          mesajGoster("Yanlis Sifre", "Tekrar Dene");
          girilenPIN = "";

          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Mevcut Sifre?");
        }
      } 
      else if (geriTusMu(key)) {
        state = SETTINGS_SCREEN;
        girilenPIN = "";
        settingsEkrani();
      }
    }
  }

  else if (state == CHANGE_MODE_SELECT) {
    if (unsafeState == LOW || key == '1') {
      guvenliMod = false;
      hedefPinUzunlugu = 3;
      girilenPIN = "";
      state = CHANGE_NEW_PIN;

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("3 Haneli Sifre");
      delay(250);
    }

    if (safeState == LOW || key == '2') {
      guvenliMod = true;
      hedefPinUzunlugu = 9;
      girilenPIN = "";
      state = CHANGE_NEW_PIN;

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("9 Haneli Sifre");
      delay(250);
    }

    if (geriTusMu(key)) {
      state = SETTINGS_SCREEN;
      girilenPIN = "";
      settingsEkrani();
    }
  }

  else if (state == CHANGE_NEW_PIN) {
    if (key) {
      if (gecerliTusMu(key) && girilenPIN.length() < hedefPinUzunlugu) {
        girilenPIN += key;
        yildizGoster(girilenPIN);
      } 
      else if (key == '*' && girilenPIN.length() > 0) {
        girilenPIN.remove(girilenPIN.length() - 1);
        yildizGoster(girilenPIN);
      } 
      else if (key == '#' && girilenPIN.length() == hedefPinUzunlugu) {

        // Sifre degistirme de sadece kapi OK verirse kaydedilir.
        String yeniPIN = girilenPIN;
        if (komutGonder("CFGCHG", guvenliMod ? "SAFE" : "UNSAFE", yeniPIN)) {
          kayitliPIN = yeniPIN;
          sifreVar = true;
          panelKayitKaydet();
        }
      } 
      else if (geriTusMu(key)) {
        state = SETTINGS_SCREEN;
        girilenPIN = "";
        settingsEkrani();
      }
    }
  }
}

void panelKayitKaydet() {
  prefs.putString("pin", kayitliPIN);
  prefs.putBool("sifreVar", sifreVar);
  prefs.putBool("guvenliMod", guvenliMod);
}

bool pinUzunluguTamam(String pin) {
  return pin.length() == 3 || pin.length() == 9;
}

bool pinDogrulaKapida(String pin) {
  WiFiClient client;

  if (WiFi.status() != WL_CONNECTED && !wifiBaglan(7000)) {
    mesajGoster("WIFI HATASI", "Kapi AP Yok");
    return false;
  }

  if (!client.connect(host, port)) {
    mesajGoster("BAGLANTI HATASI", "Kapiya Erismedi");
    return false;
  }

  bool secureVerify = pin.length() == 9;
  String paket = secureVerify
    ? "VERIFY;MODE=SAFE;DATA=" + sifreleVeri(pin)
    : "VERIFY;MODE=UNSAFE;PIN=" + pin;

  if (secureVerify) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("KAPIDA KARTI");
    lcd.setCursor(0, 1);
    lcd.print("OKUTUNUZ...");
  }

  client.println(paket);
  Serial.println("Dogrulama: " + paket);

  unsigned long baslangic = millis();
  bool basarili = false;

  while (client.connected() && millis() - baslangic < 20000) {
    if (client.available()) {
      String cevap = client.readStringUntil('\n');
      cevap.trim();
      Serial.println("Dogrulama Cevap: " + cevap);

      basarili = cevap.indexOf("OK;") != -1;
      if (cevap.indexOf("NO_PIN") != -1) {
        mesajGoster("Sifre Yok", "Once Olustur");
      }
      break;
    }
    delay(50);
  }

  client.stop();
  return basarili;
}

bool kapiSifreVarMi() {
  WiFiClient client;

  if (WiFi.status() != WL_CONNECTED && !wifiBaglan(7000)) {
    mesajGoster("WIFI HATASI", "Kapi AP Yok");
    return false;
  }

  if (!client.connect(host, port)) {
    mesajGoster("BAGLANTI HATASI", "Kapiya Erismedi");
    return false;
  }

  client.println("HAS_PIN");
  Serial.println("Sifre Durumu Soruldu");

  unsigned long baslangic = millis();
  bool varMi = false;

  while (client.connected() && millis() - baslangic < 5000) {
    if (client.available()) {
      String cevap = client.readStringUntil('\n');
      cevap.trim();
      Serial.println("Sifre Durumu: " + cevap);

      if (cevap.indexOf("OK;PIN_SET") != -1) {
        varMi = true;
        sifreVar = true;
        guvenliMod = cevap.indexOf("MODE=SAFE") != -1;
        hedefPinUzunlugu = guvenliMod ? 9 : 3;
      } else {
        sifreVar = false;
      }
      break;
    }
    delay(50);
  }

  client.stop();
  return varMi;
}

bool wifiBaglan(unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(ssid, password);

  unsigned long baslangic = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - baslangic < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  return WiFi.status() == WL_CONNECTED;
}
