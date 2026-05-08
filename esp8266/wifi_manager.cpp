#include "wifi_manager.h"
#include "config.h"

static const char CONFIG_PAGE[] PROGMEM = R"rawliteral(<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>OSEE WiFi配置</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#f5f5f7;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:#1c1c1e;border-radius:16px;padding:32px;width:340px;max-width:90vw;border:1px solid rgba(255,255,255,0.08)}
h1{font-size:20px;text-align:center;margin-bottom:24px;color:#0a84ff}
label{display:block;font-size:13px;color:#98989d;margin-bottom:6px;margin-top:16px}
input,select{width:100%;padding:12px;border-radius:8px;background:#2c2c2e;border:1px solid rgba(255,255,255,0.12);color:#f5f5f7;font-size:14px;outline:none}
input:focus,select:focus{border-color:#0a84ff}
.btn{width:100%;padding:14px;border-radius:10px;border:none;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;transition:0.2s}
.btn-primary{background:#0a84ff;color:#fff}
.btn-primary:active{background:#409cff}
.btn-danger{background:#ff453a;color:#fff;margin-top:10px}
.btn-danger:active{background:#ff6961}
.status{text-align:center;font-size:13px;color:#98989d;margin-top:16px}
.scan-list{margin-top:8px;max-height:200px;overflow-y:auto}
.scan-item{padding:10px 12px;margin:4px 0;border-radius:8px;background:#2c2c2e;cursor:pointer;font-size:14px}
.scan-item:active{background:#0a84ff;color:#fff}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
.dot-on{background:#30d158}.dot-off{background:#ff453a}
.ip-box{background:#30d158;color:#000;padding:16px;border-radius:12px;text-align:center;margin-top:16px;font-size:15px;font-weight:700;display:none}
.ip-box a{color:#000;text-decoration:underline}
.countdown{font-size:24px;font-weight:700;color:#ffd60a;margin-top:8px}
</style></head><body><div class="card">
<h1>OSEE WiFi配置</h1>
<div id="statusArea"></div>
<label>WiFi名称</label>
<input id="ssid" placeholder="输入或扫描WiFi名称">
<label>WiFi密码</label>
<input id="password" type="password" placeholder="输入WiFi密码">
<button id="saveBtn" class="btn btn-primary" onclick="saveWifi()">连接</button>
<button class="btn btn-danger" onclick="resetWifi()">重置配置</button>
<div id="scanResult" class="scan-list"></div>
<div class="status" id="msg"></div>
<div id="ipBox" class="ip-box"></div>
</div>
<script>
function scan(){fetch('/scan').then(r=>r.json()).then(d=>{let h='';d.forEach(n=>{h+='<div class="scan-item" onclick="pick(\''+n+'\')">'+n+'</div>'});document.getElementById('scanResult').innerHTML=h}).catch(e=>{})}
function pick(s){document.getElementById('ssid').value=s;document.getElementById('password').focus()}
function saveWifi(){let s=document.getElementById('ssid').value.trim();let p=document.getElementById('password').value;if(!s){document.getElementById('msg').textContent='请输入WiFi名称';return}
document.getElementById('saveBtn').disabled=true;
document.getElementById('msg').textContent='正在连接路由器...';
fetch('/save',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ssid='+encodeURIComponent(s)+'&password='+encodeURIComponent(p)})
.then(r=>r.json()).then(d=>{
  if(d.ok&&d.ip){
    document.getElementById('msg').textContent='连接成功!';
    let box=document.getElementById('ipBox');
    box.style.display='block';
    box.innerHTML='设备IP: <a href="http://'+d.ip+'">'+d.ip+'</a><br><span class="countdown" id="cd"></span>秒后可访问';
    let sec=8;
    document.getElementById('cd').textContent=sec;
    let t=setInterval(()=>{sec--;document.getElementById('cd').textContent=sec;if(sec<=0){clearInterval(t);box.innerHTML='正在切换模式...<br>请访问 <a href="http://'+d.ip+'">'+d.ip+'</a>'}},1000);
  }else if(d.error){
    document.getElementById('msg').textContent=d.error;
    document.getElementById('saveBtn').disabled=false;
  }else{
    document.getElementById('msg').textContent='连接失败';
    document.getElementById('saveBtn').disabled=false;
  }
}).catch(e=>{document.getElementById('msg').textContent='请求失败';document.getElementById('saveBtn').disabled=false})}
function resetWifi(){fetch('/reset',{method:'POST'}).then(r=>r.text()).then(t=>{document.getElementById('msg').textContent=t}).catch(e=>{})}
function checkStatus(){fetch('/status').then(r=>r.json()).then(d=>{let h='<span class="dot '+(d.connected?'dot-on':'dot-off')+'"></span>';h+=d.connected?'已连接 '+d.ip:'未连接';document.getElementById('statusArea').innerHTML=h}).catch(e=>{})}
scan();checkStatus();setInterval(checkStatus,3000);
</script></body></html>)rawliteral";

void WifiManager::begin() {
  EEPROM.begin(EEPROM_SIZE);
  if (loadConfig()) {
    Serial.printf("[WiFi] 已保存配置: %s\n", _storedSSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(_storedSSID, _storedPass);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
      delay(500);
      Serial.print(".");
      yield();
    }

    if (WiFi.status() == WL_CONNECTED) {
      _connected = true;
      Serial.printf("\n[WiFi] 已连接, IP: %s\n", WiFi.localIP().toString().c_str());
      return;
    }
    Serial.println("\n[WiFi] 连接失败，进入配网模式");
  }

  startConfigMode();
}

void WifiManager::loop() {
  if (_configMode) {
    if (_dnsServer) _dnsServer->processNextRequest();
    if (_configServer) _configServer->handleClient();

    if (_configStart > 0 && millis() - _configStart > WIFI_CONFIG_TIMEOUT) {
      Serial.println("[WiFi] 配网超时，重启");
      if (_timeoutCb) _timeoutCb();
      ESP.restart();
    }
    return;
  }

  if (!_connected && WiFi.status() == WL_CONNECTED) {
    _connected = true;
    _disconnectStart = 0;
    Serial.printf("[WiFi] 重新连接, IP: %s\n", WiFi.localIP().toString().c_str());
  } else if (_connected && WiFi.status() != WL_CONNECTED) {
    _connected = false;
    _disconnectStart = millis();
    Serial.println("[WiFi] 连接丢失");
  }

  if (!_connected && !_configMode && _disconnectStart > 0 && millis() - _disconnectStart > 30000) {
    Serial.println("[WiFi] 连接丢失超过30秒，进入配网模式");
    startConfigMode();
  }
}

bool WifiManager::isConnected() const { return _connected; }
bool WifiManager::isConfigMode() const { return _configMode; }
String WifiManager::getIP() const { return _connected ? WiFi.localIP().toString() : WiFi.softAPIP().toString(); }

void WifiManager::onTimeout(WifiTimeoutCallback cb) { _timeoutCb = cb; }

void WifiManager::startConfigMode() {
  _configMode = true;
  _configStart = millis();

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
  Serial.printf("[WiFi] AP模式: SSID=%s, IP=%s\n", WIFI_AP_SSID, WiFi.softAPIP().toString().c_str());

  _dnsServer = new DNSServer();
  _dnsServer->start(53, "*", WiFi.softAPIP());

  _configServer = new ESP8266WebServer(80);

  _configServer->on("/", HTTP_GET, std::bind(&WifiManager::handleConfigPage, this));
  _configServer->on("/save", HTTP_POST, std::bind(&WifiManager::handleSave, this));
  _configServer->on("/reset", HTTP_POST, std::bind(&WifiManager::handleReset, this));
  _configServer->on("/status", HTTP_GET, std::bind(&WifiManager::handleStatus, this));
  _configServer->on("/scan", HTTP_GET, std::bind(&WifiManager::handleScan, this));
  _configServer->onNotFound(std::bind(&WifiManager::handleConfigPage, this));

  _configServer->begin();
}

void WifiManager::stopConfigMode() {
  _configMode = false;
  if (_configServer) { _configServer->stop(); delete _configServer; _configServer = nullptr; }
  if (_dnsServer) { _dnsServer->stop(); delete _dnsServer; _dnsServer = nullptr; }
}

void WifiManager::handleConfigPage() {
  _configServer->send_P(200, "text/html", CONFIG_PAGE);
}

void WifiManager::handleSave() {
  String ssid = _configServer->arg("ssid");
  String password = _configServer->arg("password");

  if (ssid.length() == 0) {
    _configServer->send(200, "application/json", "{\"ok\":false,\"error\":\"SSID不能为空\"}");
    return;
  }

  saveConfig(ssid.c_str(), password.c_str());

  Serial.printf("[WiFi] 配网: %s, 尝试连接...\n", ssid.c_str());

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
    yield();
  }

  if (WiFi.status() == WL_CONNECTED) {
    _connected = true;
    String ip = WiFi.localIP().toString();
    Serial.printf("\n[WiFi] 配网成功, IP: %s\n", ip.c_str());

    String json = "{\"ok\":true,\"ip\":\"" + ip + "\"}";
    _configServer->send(200, "application/json", json);

    delay(8000);

    stopConfigMode();
    WiFi.mode(WIFI_STA);
  } else {
    _connected = false;
    Serial.println("\n[WiFi] 配网连接失败");
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);

    _configServer->send(200, "application/json", "{\"ok\":false,\"error\":\"连接失败，请检查密码\"}");
  }
}

void WifiManager::handleReset() {
  resetConfig();
  _configServer->send(200, "text/plain", "配置已重置，即将重启...");
  delay(500);
  ESP.restart();
}

void WifiManager::handleStatus() {
  String json = "{\"connected\":";
  json += WiFi.status() == WL_CONNECTED ? "true" : "false";
  json += ",\"ip\":\"";
  json += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  json += "\"}";
  _configServer->send(200, "application/json", json);
}

void WifiManager::handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n && i < 15; i++) {
    if (i > 0) json += ",";
    json += "\"";
    json += WiFi.SSID(i);
    json += "\"";
  }
  json += "]";
  _configServer->send(200, "application/json", json);
  WiFi.scanDelete();
}

void WifiManager::saveConfig(const char* ssid, const char* password) {
  EEPROM.write(EEPROM_ADDR_MAGIC, EEPROM_MAGIC);

  for (int i = 0; i < SSID_MAX_LEN; i++) {
    EEPROM.write(EEPROM_ADDR_SSID + i, i < (int)strlen(ssid) ? ssid[i] : 0);
  }

  for (int i = 0; i < PASS_MAX_LEN; i++) {
    EEPROM.write(EEPROM_ADDR_PASS + i, i < (int)strlen(password) ? password[i] : 0);
  }

  EEPROM.commit();
  strlcpy(_storedSSID, ssid, sizeof(_storedSSID));
  strlcpy(_storedPass, password, sizeof(_storedPass));
  Serial.printf("[WiFi] 配置已保存: %s\n", ssid);
}

bool WifiManager::loadConfig() {
  if (EEPROM.read(EEPROM_ADDR_MAGIC) != EEPROM_MAGIC) return false;

  memset(_storedSSID, 0, sizeof(_storedSSID));
  memset(_storedPass, 0, sizeof(_storedPass));

  for (int i = 0; i < SSID_MAX_LEN; i++) {
    _storedSSID[i] = (char)EEPROM.read(EEPROM_ADDR_SSID + i);
  }
  for (int i = 0; i < PASS_MAX_LEN; i++) {
    _storedPass[i] = (char)EEPROM.read(EEPROM_ADDR_PASS + i);
  }

  return strlen(_storedSSID) > 0;
}

void WifiManager::resetConfig() {
  for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
  EEPROM.commit();
  memset(_storedSSID, 0, sizeof(_storedSSID));
  memset(_storedPass, 0, sizeof(_storedPass));
  Serial.println("[WiFi] 配置已重置");
}
