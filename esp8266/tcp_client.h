#ifndef TCP_CLIENT_H
#define TCP_CLIENT_H

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include "protocol.h"
#include "config.h"

enum ConnectionState { CONN_DISCONNECTED, CONN_CONNECTING, CONN_CONNECTED };

typedef void (*TcpStateCallback)(ConnectionState state, const char* ip, int port);
typedef void (*TcpDataCallback)(const char* json, bool isPush);
typedef void (*TcpErrorCallback)(const char* error);

class TcpClient {
public:
  TcpClient();
  bool connect(const char* ip, int port);
  void disconnect();
  bool sendCommand(const char* id, const char* cmdType, const int* value, int valueCount);
  bool sendRaw(const uint8_t* data, size_t len);
  bool sendStringCommand(const char* id, const char* cmdType, const char* strValue);
  void loop();
  void onState(TcpStateCallback cb) { _stateCb = cb; }
  void onData(TcpDataCallback cb) { _dataCb = cb; }
  void onError(TcpErrorCallback cb) { _errorCb = cb; }
  ConnectionState getState() const { return _state; }
  bool isConnected() const { return _state == CONN_CONNECTED; }

private:
  void _setState(ConnectionState s);
  void _sendHandshake();
  void _processData();
  bool _isPushEvent(const char* id);
  void _sendStatusQueries();

  WiFiClient _client;
  ConnectionState _state = CONN_DISCONNECTED;
  char _targetIp[16] = {0};
  int _targetPort = DEVICE_PORT;

  uint8_t _rxBuffer[1024];
  size_t _rxLen = 0;
  char _jsonBuf[512];

  unsigned long _lastHeartbeat = 0;
  unsigned long _lastReconnect = 0;
  unsigned long _reconnectDelay = RECONNECT_BASE_DELAY;
  bool _handshakeDone = false;
  int _handshakeStep = 0;
  unsigned long _lastHandshakeStep = 0;

  TcpStateCallback _stateCb = nullptr;
  TcpDataCallback _dataCb = nullptr;
  TcpErrorCallback _errorCb = nullptr;
};

#endif
