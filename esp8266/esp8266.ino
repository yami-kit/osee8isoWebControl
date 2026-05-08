#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include "config.h"
#include "protocol.h"
#include "tcp_client.h"
#include "wifi_manager.h"
#include "web_server.h"

WifiManager wifiManager;
TcpClient tcpClient;
WebServer* webServer = nullptr;

unsigned long lastMDNSUpdate = 0;
bool webServerStarted = false;
char serialBuf[128];
int serialBufPos = 0;

void handleSerialCommand() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBufPos > 0) {
        serialBuf[serialBufPos] = '\0';
        if (strncmp(serialBuf, "WIFI:", 5) == 0) {
          char* ssid = serialBuf + 5;
          char* pass = strchr(ssid, ':');
          if (pass) {
            *pass = '\0';
            pass++;
            Serial.printf("[Serial] 配置WiFi: %s\n", ssid);
            wifiManager.saveConfig(ssid, pass);
            Serial.println("[Serial] 配置已保存，重启中...");
            delay(500);
            ESP.restart();
          }
        } else if (strcmp(serialBuf, "RESET") == 0) {
          Serial.println("[Serial] 重置配置...");
          wifiManager.resetConfig();
          delay(500);
          ESP.restart();
        } else if (strcmp(serialBuf, "INFO") == 0) {
          Serial.printf("[Info] WiFi: %s\n", wifiManager.isConnected() ? "已连接" : "未连接");
          Serial.printf("[Info] IP: %s\n", wifiManager.getIP().c_str());
          Serial.printf("[Info] Heap: %d\n", ESP.getFreeHeap());
          Serial.printf("[Info] ConfigMode: %s\n", wifiManager.isConfigMode() ? "是" : "否");
        }
        serialBufPos = 0;
      }
    } else if (serialBufPos < (int)sizeof(serialBuf) - 1) {
      serialBuf[serialBufPos++] = c;
    }
  }
}

void onTcpState(ConnectionState state, const char* ip, int port) {
  Serial.printf("[TCP] 状态: %d IP:%s Port:%d\n", state, ip, port);
  if (webServer) webServer->broadcastState(state, ip, port);
}

void onTcpData(const char* json, bool isPush) {
  if (!webServer) return;

  size_t jsonLen = strlen(json);
  if (jsonLen > 500) return;

  char msg[540];
  if (isPush) {
    snprintf(msg, sizeof(msg), "{\"type\":\"push\",\"data\":%s}", json);
  } else {
    snprintf(msg, sizeof(msg), "{\"type\":\"rx\",\"data\":%s}", json);
  }
  webServer->broadcast(msg);
}

void onTcpError(const char* error) {
  Serial.printf("[TCP] 错误: %s\n", error);
  if (webServer) {
    char msg[256];
    snprintf(msg, sizeof(msg), "{\"type\":\"error\",\"message\":\"%s\"}", error);
    webServer->broadcast(msg);
  }
}

void onWifiTimeout() {
  Serial.println("[WiFi] 配网超时");
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(100);
  Serial.println("\n\n=== OSEE 导播台 ESP8266 控制器 ===");
  Serial.printf("SDK: %s\nFree heap: %d\n", ESP.getSdkVersion(), ESP.getFreeHeap());

  wifiManager.begin();
  wifiManager.onTimeout(onWifiTimeout);

  tcpClient.onState(onTcpState);
  tcpClient.onData(onTcpData);
  tcpClient.onError(onTcpError);

  if (!wifiManager.isConfigMode() && wifiManager.isConnected()) {
    webServer = new WebServer(&tcpClient);
    webServer->begin();
    webServerStarted = true;

    MDNS.begin("osee-controller");
    MDNS.addService("http", "tcp", WEB_SERVER_PORT);
    MDNS.addService("ws", "tcp", WS_SERVER_PORT);
    Serial.printf("[mDNS] osee-controller.local\n");
    Serial.printf("[Web] http://%s\n", WiFi.localIP().toString().c_str());
  }

  Serial.println("[Setup] 完成");
}

void loop() {
  handleSerialCommand();
  wifiManager.loop();

  if (!wifiManager.isConfigMode() && wifiManager.isConnected() && !webServerStarted) {
    webServer = new WebServer(&tcpClient);
    webServer->begin();
    webServerStarted = true;

    MDNS.begin("osee-controller");
    MDNS.addService("http", "tcp", WEB_SERVER_PORT);
    MDNS.addService("ws", "tcp", WS_SERVER_PORT);
    Serial.printf("[Web] http://%s\n", WiFi.localIP().toString().c_str());
  }

  if (webServerStarted && webServer) {
    webServer->loop();
  }

  if (!wifiManager.isConfigMode() && wifiManager.isConnected()) {
    tcpClient.loop();
  }

  if (webServerStarted && millis() - lastMDNSUpdate > 3000) {
    lastMDNSUpdate = millis();
    MDNS.update();
  }

  yield();
}
