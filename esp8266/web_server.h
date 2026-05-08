#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include "tcp_client.h"

class WebServer {
public:
  WebServer(TcpClient* tcpClient);
  void begin();
  void loop();
  void broadcast(const char* message);
  void broadcastState(ConnectionState state, const char* ip, int port);

private:
  void handleRoot();
  void handleConfig();
  void handleNotFound();
  void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length);
  void sendConfigToWs(uint8_t num);
  void sendStateToWs(uint8_t num);
  void handleWsConnect(uint8_t num, const char* payload);
  void handleWsDisconnect(uint8_t num);
  void handleWsCommand(uint8_t num, const char* payload);
  void handleWsCmd(uint8_t num, const char* payload);
  void handleWsRaw(uint8_t num, const char* payload);

  ESP8266WebServer* _server;
  WebSocketsServer* _ws;
  TcpClient* _tcp;
  bool _started = false;
  bool _pendingConnect = false;
  char _pendingIp[16] = {0};
  int _pendingPort = DEVICE_PORT;
};

#endif
