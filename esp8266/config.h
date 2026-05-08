#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define DEVICE_PORT 19010
#define HEARTBEAT_INTERVAL 500
#define RECONNECT_BASE_DELAY 1000
#define RECONNECT_MAX_DELAY 10000
#define WEB_SERVER_PORT 80
#define WS_SERVER_PORT 81
#define WIFI_AP_SSID "OSEE-Ctrl"
#define WIFI_AP_PASSWORD "12345678"
#define WIFI_CONFIG_TIMEOUT 180000
#define SERIAL_BAUD 115200

struct Source {
  int id;
  const char* name;
  const char* group;
};

struct Command {
  const char* cmdName;
  const char* id;
  const char* cmdType;
  int value[4];
  int valueCount;
};

extern const Source sources[];
extern const int sourceCount;
extern const Command commands[];
extern const int commandCount;
extern const char* const handshakeSequence[];
extern const int handshakeCount;
extern const char* const statusQueries[];
extern const int statusQueryCount;
extern const char* const pushEvents[];
extern const int pushEventCount;

#endif
