# Hardware Notes

## Devices

- Panel ESP32: keypad and LCD user interface
- Door ESP32: lock control, RFID reader, buzzer, LEDs, Wi-Fi access point

## Door ESP32 Pin Mapping

| Component | Pin |
| --- | --- |
| Red LED | GPIO 26 |
| Green LED | GPIO 25 |
| Buzzer | GPIO 27 |
| Servo | GPIO 13 |
| RFID SS/SDA | GPIO 5 |
| RFID RST | GPIO 22 |
| RFID SCK | GPIO 18 |
| RFID MISO | GPIO 19 |
| RFID MOSI | GPIO 23 |

## Panel ESP32 Pin Mapping

| Component | Pin |
| --- | --- |
| Unsafe mode button | GPIO 19 |
| Safe mode button | GPIO 15 |
| Keypad row 1 | GPIO 32 |
| Keypad row 2 | GPIO 33 |
| Keypad row 3 | GPIO 25 |
| Keypad row 4 | GPIO 18 |
| Keypad column 1 | GPIO 27 |
| Keypad column 2 | GPIO 14 |
| Keypad column 3 | GPIO 13 |

## Required Arduino Libraries

- `WiFi`
- `Preferences`
- `Keypad`
- `LiquidCrystal_I2C`
- `ESP32Servo`
- `SPI`
- `MFRC522`

## Configuration

Before uploading the firmware, replace placeholder credentials in both ESP32 sketches:

```cpp
const char* ssid = "CHANGE_ME_DOOR_AP_SSID";
const char* password = "CHANGE_ME_DOOR_AP_PASSWORD";
```

In the door firmware, replace:

```cpp
String dogruKart = "CHANGE_ME_RFID_UID";
```
