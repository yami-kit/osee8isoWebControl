#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>

#define EEPROM_SIZE 128
#define EEPROM_MAGIC 0xA5
#define EEPROM_ADDR_MAGIC 0
#define EEPROM_ADDR_SSID 1
#define EEPROM_ADDR_PASS 34
#define SSID_MAX_LEN 32
#define PASS_MAX_LEN 64

typedef void (*WifiTimeoutCallback)();

class WifiManager {
public:
  void begin();
  void loop();
  bool isConnected() const;
  bool isConfigMode() const;
  String getIP() const;
  void saveConfig(const char* ssid, const char* password);
  bool loadConfig();
  void resetConfig();
  void onTimeout(WifiTimeoutCallback cb);

private:
  void startConfigMode();
  void stopConfigMode();
  void handleConfigPage();
  void handleSave();
  void handleReset();
  void handleStatus();
  void handleScan();

  ESP8266WebServer* _configServer = nullptr;
  DNSServer* _dnsServer = nullptr;
  bool _configMode = false;
  bool _connected = false;
  unsigned long _disconnectStart = 0;
  unsigned long _configStart = 0;
  WifiTimeoutCallback _timeoutCb = nullptr;
  char _storedSSID[SSID_MAX_LEN + 1] = {0};
  char _storedPass[PASS_MAX_LEN + 1] = {0};
};

#endif
