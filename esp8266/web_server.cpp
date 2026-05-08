#include "web_server.h"
#include "config.h"

WebServer::WebServer(TcpClient* tcpClient) : _tcp(tcpClient) {
  _server = new ESP8266WebServer(WEB_SERVER_PORT);
  _ws = new WebSocketsServer(WS_SERVER_PORT);
}

void WebServer::begin() {
  if (!LittleFS.begin()) {
    Serial.println("[Web] LittleFS挂载失败! 尝试格式化...");
    if (LittleFS.format()) {
      Serial.println("[Web] 格式化成功，重新挂载...");
      LittleFS.begin();
    } else {
      Serial.println("[Web] 格式化失败!");
    }
  }

  FSInfo fs_info;
  if (LittleFS.info(fs_info)) {
    Serial.printf("[Web] LittleFS: 总空间=%d 已用=%d\n", fs_info.totalBytes, fs_info.usedBytes);
  }

  Dir dir = LittleFS.openDir("/");
  while (dir.next()) {
    Serial.printf("[Web] 文件: %s (%d bytes)\n", dir.fileName().c_str(), dir.fileSize());
  }

  _server->on("/", HTTP_GET, std::bind(&WebServer::handleRoot, this));
  _server->on("/api/config", HTTP_GET, std::bind(&WebServer::handleConfig, this));
  _server->onNotFound(std::bind(&WebServer::handleNotFound, this));
  _server->begin();

  _ws->begin();
  _ws->onEvent(std::bind(&WebServer::webSocketEvent, this,
    std::placeholders::_1, std::placeholders::_2,
    std::placeholders::_3, std::placeholders::_4));

  _started = true;
  Serial.printf("[Web] HTTP:%d WS:%d\n", WEB_SERVER_PORT, WS_SERVER_PORT);
}

void WebServer::loop() {
  if (!_started) return;

  if (_pendingConnect) {
    _pendingConnect = false;
    Serial.printf("[Web] 执行延迟连接: %s:%d\n", _pendingIp, _pendingPort);
    broadcastState(CONN_CONNECTING, _pendingIp, _pendingPort);
    _ws->loop();
    yield();
    _tcp->connect(_pendingIp, _pendingPort);
  }

  _server->handleClient();
  _ws->loop();
  yield();
}

void WebServer::broadcast(const char* message) {
  _ws->broadcastTXT(message);
}

void WebServer::broadcastState(ConnectionState state, const char* ip, int port) {
  char msg[128];
  const char* stateStr = state == CONN_CONNECTED ? "connected" :
                         state == CONN_CONNECTING ? "connecting" : "disconnected";
  snprintf(msg, sizeof(msg), "{\"type\":\"state\",\"state\":\"%s\",\"ip\":\"%s\",\"port\":%d}", stateStr, ip, port);
  broadcast(msg);
}

void WebServer::handleRoot() {
  File f = LittleFS.open("/index.html", "r");
  if (f) {
    _server->streamFile(f, "text/html");
    f.close();
  } else {
    _server->send(200, "text/html", "<h1>OSEE Ctrl - FS not found</h1><p>Upload data files</p>");
  }
}

void WebServer::handleConfig() {
  String json = "{\"sources\":[";
  for (int i = 0; i < sourceCount; i++) {
    if (i > 0) json += ",";
    json += "{\"id\":" + String(sources[i].id) + ",\"name\":\"" + sources[i].name + "\",\"group\":\"" + sources[i].group + "\"}";
  }
  json += "],\"commands\":{";
  for (int i = 0; i < commandCount; i++) {
    if (i > 0) json += ",";
    json += "\"" + String(commands[i].cmdName) + "\":{\"id\":\"" + String(commands[i].id) +
            "\",\"type\":\"" + String(commands[i].cmdType) + "\",\"value\":[";
    for (int j = 0; j < commands[i].valueCount; j++) {
      if (j > 0) json += ",";
      json += String(commands[i].value[j]);
    }
    json += "]}";
  }
  json += "}}";
  _server->send(200, "application/json", json);
}

void WebServer::handleNotFound() {
  String path = _server->uri();
  if (path == "/style.css") {
    File f = LittleFS.open("/style.css", "r");
    if (f) { _server->streamFile(f, "text/css"); f.close(); return; }
  } else if (path == "/app.js") {
    File f = LittleFS.open("/app.js", "r");
    if (f) { _server->streamFile(f, "application/javascript"); f.close(); return; }
  }
  _server->send(404, "text/plain", "Not Found");
}

void WebServer::webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      break;
    case WStype_CONNECTED:
      sendConfigToWs(num);
      sendStateToWs(num);
      break;
    case WStype_TEXT: {
      if (length > 600) return;
      char msg[608];
      memcpy(msg, payload, length);
      msg[length] = '\0';

      if (strncmp(msg, "{\"action\":\"connect\"", 18) == 0) {
        handleWsConnect(num, msg);
      } else if (strncmp(msg, "{\"action\":\"disconnect\"", 20) == 0) {
        handleWsDisconnect(num);
      } else if (strncmp(msg, "{\"action\":\"command\"", 18) == 0) {
        handleWsCommand(num, msg);
      } else if (strncmp(msg, "{\"action\":\"cmd\"", 14) == 0) {
        handleWsCmd(num, msg);
      } else if (strncmp(msg, "{\"action\":\"raw\"", 13) == 0) {
        handleWsRaw(num, msg);
      }
      break;
    }
    default:
      break;
  }
}

void WebServer::sendConfigToWs(uint8_t num) {
  char msg[32];
  snprintf(msg, sizeof(msg), "{\"type\":\"config\",\"wsPort\":%d}", WS_SERVER_PORT);
  _ws->sendTXT(num, msg);
}

void WebServer::sendStateToWs(uint8_t num) {
  ConnectionState s = _tcp->getState();
  const char* stateStr = s == CONN_CONNECTED ? "connected" :
                         s == CONN_CONNECTING ? "connecting" : "disconnected";
  char msg[128];
  snprintf(msg, sizeof(msg), "{\"type\":\"state\",\"state\":\"%s\"}", stateStr);
  _ws->sendTXT(num, msg);
}

void WebServer::handleWsConnect(uint8_t num, const char* payload) {
  char ip[16] = {0};
  const char* ipStart = strstr(payload, "\"ip\":\"");
  if (ipStart) {
    ipStart += 6;
    int i = 0;
    while (ipStart[i] && ipStart[i] != '"' && i < 15) { ip[i] = ipStart[i]; i++; }
  }
  if (strlen(ip) > 0) {
    strlcpy(_pendingIp, ip, sizeof(_pendingIp));
    _pendingPort = DEVICE_PORT;
    _pendingConnect = true;
    Serial.printf("[Web] 延迟连接请求: %s:%d\n", ip, DEVICE_PORT);
  }
}

void WebServer::handleWsDisconnect(uint8_t num) {
  _tcp->disconnect();
}

void WebServer::handleWsCommand(uint8_t num, const char* payload) {
  char id[32] = {0};
  char cmdType[8] = {0};

  const char* p = strstr(payload, "\"id\":\"");
  if (p) { p += 6; int i = 0; while (p[i] && p[i] != '"' && i < 31) { id[i] = p[i]; i++; } }

  p = strstr(payload, "\"cmdType\":\"");
  if (p) { p += 11; int i = 0; while (p[i] && p[i] != '"' && i < 7) { cmdType[i] = p[i]; i++; } }

  p = strstr(payload, "\"value\":[");
  if (!p) return;
  p += 9;

  bool hasString = false;
  const char* strCheck = p;
  while (*strCheck && *strCheck != ']') {
    if (*strCheck == '"') { hasString = true; break; }
    strCheck++;
  }

  if (hasString) {
    char strVal[256] = {0};
    int pos = 0;
    bool needComma = false;
    while (*p && *p != ']' && pos < 245) {
      if (*p == '"') {
        if (needComma && pos < 255) strVal[pos++] = ',';
        strVal[pos++] = '"';
        p++;
        while (*p && *p != '"' && pos < 245) {
          strVal[pos++] = *p++;
        }
        if (*p == '"') { strVal[pos++] = '"'; p++; }
        needComma = true;
      } else if (*p == ',' || *p == ' ') {
        p++;
      } else {
        if (needComma && pos < 255) strVal[pos++] = ',';
        while (*p && *p != ',' && *p != ']' && *p != '"' && pos < 245) {
          strVal[pos++] = *p++;
        }
        needComma = true;
      }
    }
    strVal[pos] = '\0';
    _tcp->sendStringCommand(id, cmdType, strVal);
  } else {
    int values[4] = {0};
    int valCount = 0;
    while (*p && *p != ']' && valCount < 4) {
      if (*p == ',' || *p == ' ') { p++; continue; }
      values[valCount++] = atoi(p);
      while (*p && *p != ',' && *p != ']') p++;
    }
    _tcp->sendCommand(id, cmdType, values, valCount);
  }
}

void WebServer::handleWsCmd(uint8_t num, const char* payload) {
  char cmdName[48] = {0};
  const char* p = strstr(payload, "\"name\":\"");
  if (p) { p += 8; int i = 0; while (p[i] && p[i] != '"' && i < 47) { cmdName[i] = p[i]; i++; } }

  for (int i = 0; i < commandCount; i++) {
    if (strcmp(cmdName, commands[i].cmdName) == 0) {
      _tcp->sendCommand(commands[i].id, commands[i].cmdType, commands[i].value, commands[i].valueCount);
      break;
    }
  }
}

void WebServer::handleWsRaw(uint8_t num, const char* payload) {
  const char* p = strstr(payload, "\"hex\":\"");
  if (!p) return;
  p += 7;
  char hex[128] = {0};
  int i = 0;
  while (p[i] && p[i] != '"' && i < 127) { hex[i] = p[i]; i++; }

  uint8_t buf[64];
  size_t len = Protocol::hexToBuffer(hex, buf, sizeof(buf));
  if (len > 0) _tcp->sendRaw(buf, len);
}
