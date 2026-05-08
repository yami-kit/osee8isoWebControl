#include "tcp_client.h"

TcpClient::TcpClient() {
  _rxLen = 0;
  _state = CONN_DISCONNECTED;
}

void TcpClient::_setState(ConnectionState s) {
  _state = s;
  if (_stateCb) _stateCb(s, _targetIp, _targetPort);
}

bool TcpClient::connect(const char* ip, int port) {
  if (_state == CONN_CONNECTED || _state == CONN_CONNECTING) {
    _client.stop();
    _state = CONN_DISCONNECTED;
  }

  strlcpy(_targetIp, ip, sizeof(_targetIp));
  _targetPort = port;
  _rxLen = 0;
  _handshakeDone = false;
  _handshakeStep = 0;
  _reconnectDelay = RECONNECT_BASE_DELAY;

  _setState(CONN_CONNECTING);
  Serial.printf("[TCP] 连接 %s:%d\n", ip, port);

  _client.stop();
  delay(10);

  _client.setTimeout(2000);
  int result = _client.connect(ip, port);

  if (result) {
    _client.setNoDelay(true);
    _client.setTimeout(3000);
    _setState(CONN_CONNECTED);
    Serial.println("[TCP] 已连接");

    uint8_t ping = 0x00;
    _client.write(&ping, 1);

    _lastHeartbeat = millis();
    _lastHandshakeStep = millis();
    _reconnectDelay = RECONNECT_BASE_DELAY;
    return true;
  } else {
    Serial.println("[TCP] 连接失败");
    _setState(CONN_DISCONNECTED);
    _lastReconnect = millis();
    return false;
  }
}

void TcpClient::disconnect() {
  _targetIp[0] = '\0';
  _client.stop();
  _rxLen = 0;
  _handshakeDone = false;
  _handshakeStep = 0;
  _setState(CONN_DISCONNECTED);
  Serial.println("[TCP] 已断开");
}

bool TcpClient::sendCommand(const char* id, const char* cmdType, const int* value, int valueCount) {
  if (!_client.connected() || _state != CONN_CONNECTED) return false;

  uint8_t buf[400];
  size_t len = Protocol::buildCommand(id, cmdType, value, valueCount, buf, sizeof(buf));
  if (len == 0) return false;

  size_t written = _client.write(buf, len);
  return written == len;
}

bool TcpClient::sendRaw(const uint8_t* data, size_t len) {
  if (!_client.connected() || _state != CONN_CONNECTED) return false;
  size_t written = _client.write(data, len);
  return written == len;
}

bool TcpClient::sendStringCommand(const char* id, const char* cmdType, const char* strValue) {
  if (!_client.connected() || _state != CONN_CONNECTED) return false;

  char json[300];
  snprintf(json, sizeof(json), "{\"id\":\"%s\",\"type\":\"%s\",\"value\":[%s]}", id, cmdType, strValue);

  uint8_t buf[400];
  size_t len = Protocol::buildFrame(json, buf, sizeof(buf));
  if (len == 0) return false;

  size_t written = _client.write(buf, len);
  return written == len;
}

void TcpClient::loop() {
  if (_state == CONN_DISCONNECTED) {
    if (_targetIp[0] != '\0' && millis() - _lastReconnect > _reconnectDelay) {
      _lastReconnect = millis();
      Serial.printf("[TCP] 重连 %s:%d\n", _targetIp, _targetPort);

      _client.stop();
      delay(10);
      _client.setTimeout(1000);
      _setState(CONN_CONNECTING);

      if (_client.connect(_targetIp, _targetPort)) {
        _client.setNoDelay(true);
        _client.setTimeout(3000);
        _setState(CONN_CONNECTED);
        Serial.println("[TCP] 重连成功");

        uint8_t ping = 0x00;
        _client.write(&ping, 1);

        _lastHeartbeat = millis();
        _lastHandshakeStep = millis();
        _rxLen = 0;
        _handshakeDone = false;
        _handshakeStep = 0;
        _reconnectDelay = RECONNECT_BASE_DELAY;
      } else {
        Serial.println("[TCP] 重连失败");
        _setState(CONN_DISCONNECTED);
        _reconnectDelay = min((unsigned long)RECONNECT_MAX_DELAY, _reconnectDelay * 2);
      }
    }
    return;
  }

  if (_state == CONN_CONNECTED && !_client.connected()) {
    Serial.println("[TCP] 连接丢失");
    _setState(CONN_DISCONNECTED);
    _lastReconnect = millis();
    _reconnectDelay = RECONNECT_BASE_DELAY;
    return;
  }

  if (!_handshakeDone && _state == CONN_CONNECTED) {
    if (_handshakeStep == 0 && millis() - _lastHandshakeStep > 300) {
      time_t now = time(nullptr);
      char tzVal[64];
      snprintf(tzVal, sizeof(tzVal), "%d,\"Asia/Shanghai\"", (int)now);
      sendStringCommand("pcTimeSecs", "set", tzVal);
      _handshakeStep = 1;
      _lastHandshakeStep = millis();
    } else if (_handshakeStep > 0 && _handshakeStep <= handshakeCount) {
      if (millis() - _lastHandshakeStep > 200) {
        int idx = _handshakeStep - 1;
        sendCommand(handshakeSequence[idx], "get", nullptr, 0);
        _handshakeStep++;
        _lastHandshakeStep = millis();
      }
    } else if (_handshakeStep > handshakeCount) {
      _handshakeDone = true;
      _sendStatusQueries();
      Serial.println("[TCP] 握手完成");
    }
    _processData();
    return;
  }

  if (_state == CONN_CONNECTED && _handshakeDone) {
    if (millis() - _lastHeartbeat > HEARTBEAT_INTERVAL) {
      uint8_t hb[64];
      size_t hbLen = Protocol::buildHeartbeat(hb, sizeof(hb));
      if (hbLen > 0) {
        _client.write(hb, hbLen);
      }
      _lastHeartbeat = millis();
    }
  }

  _processData();
}

void TcpClient::_processData() {
  while (_client.available() && _rxLen < sizeof(_rxBuffer) - 1) {
    _rxBuffer[_rxLen++] = _client.read();
    yield();
  }

  if (_rxLen == 0) return;

  size_t consumed = 0;
  int result = Protocol::parseFrames(_rxBuffer, _rxLen, _jsonBuf, sizeof(_jsonBuf), &consumed);

  if (result > 0 && consumed > 0) {
    if (_rxLen > consumed) {
      memmove(_rxBuffer, _rxBuffer + consumed, _rxLen - consumed);
      _rxLen -= consumed;
    } else {
      _rxLen = 0;
    }

    if (strstr(_jsonBuf, "\"_type\":\"heartbeat\"") == nullptr) {
      bool isPush = false;
      const char* typeStart = strstr(_jsonBuf, "\"type\":\"");
      if (typeStart) {
        typeStart += 8;
        if (strncmp(typeStart, "pus", 3) == 0) isPush = true;
      }

      if (!isPush) {
        const char* idStart = strstr(_jsonBuf, "\"id\":\"");
        if (idStart) {
          idStart += 6;
          char idBuf[32] = {0};
          int i = 0;
          while (idStart[i] && idStart[i] != '"' && i < 31) {
            idBuf[i] = idStart[i];
            i++;
          }
          isPush = _isPushEvent(idBuf);
        }
      }

      if (_dataCb) _dataCb(_jsonBuf, isPush);
    }
  } else if (_rxLen >= sizeof(_rxBuffer) - 1) {
    _rxLen = 0;
  }
}

void TcpClient::_sendStatusQueries() {
  for (int i = 0; i < statusQueryCount; i++) {
    sendCommand(statusQueries[i], "get", nullptr, 0);
    delay(50);
    yield();
  }
}

bool TcpClient::_isPushEvent(const char* id) {
  for (int i = 0; i < pushEventCount; i++) {
    if (strcmp(id, pushEvents[i]) == 0) return true;
  }
  return false;
}
