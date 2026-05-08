/**
 * OSEE 导播台 - Web服务器
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const ConnectionManager = require('./connection');
const config = require('./config');

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

app.get('/api/config', (req, res) => {
  res.json({
    device: config.device,
    sources: config.sources,
    commands: Object.keys(config.commands).reduce((acc, key) => {
      const cmd = config.commands[key];
      acc[key] = { id: cmd.id, type: cmd.type, label: cmd.label };
      return acc;
    }, {}),
  });
});

app.get('/api/local-ips', (req, res) => {
  const conn = new ConnectionManager();
  res.json(conn.getLocalIPs());
});

const wss = new WebSocketServer({ server });
const conn = new ConnectionManager();

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data);
  });
}

// TCP事件 → WebSocket广播
conn.on('state', (info) => broadcast({ type: 'state', data: info }));

conn.on('rx', (info) => {
  // 过滤心跳包不发给前端
  if (info.type === 'heartbeat') return;
  broadcast({ type: 'rx', data: info });
});

conn.on('tx', (info) => {
  // 过滤心跳包不发给前端
  if (info.type === 'heartbeat') return;
  broadcast({ type: 'tx', data: info });
});

conn.on('push', (data) => {
  // 过滤audioMeter推送（太频繁）
  if (data.id === 'audioMeter') return;
  broadcast({ type: 'push', data: data });
});

conn.on('error', (msg) => broadcast({ type: 'error', data: msg }));
conn.on('log', (msg) => broadcast({ type: 'log', data: msg }));

// WebSocket客户端消息处理
wss.on('connection', (ws) => {
  console.log('[WS] 客户端已连接');
  
  ws.send(JSON.stringify({ type: 'state', data: conn.getStatus() }));
  ws.send(JSON.stringify({
    type: 'config',
    data: {
      sources: config.sources,
      commands: config.commands,
      commandNames: config.commandNames,
    },
  }));
  
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    
    switch (msg.type) {
      case 'connect':
        conn.connect(msg.ip, msg.port);
        break;
      
      case 'disconnect':
        conn.disconnect();
        break;
      
      case 'scan': {
        const ips = conn.getLocalIPs();
        if (ips.length === 0) {
          ws.send(JSON.stringify({ type: 'error', data: '未找到内网网卡' }));
          break;
        }
        const localIp = ips[0];
        const prefix = conn.getNetworkPrefix(localIp.address, localIp.netmask);
        conn.state = 'scanning';
        broadcast({ type: 'state', data: { state: 'scanning', prefix } });
        
        conn.scanNetwork(prefix, (progress) => {
          broadcast({ type: 'scanProgress', data: progress });
        }).then((devices) => {
          broadcast({ type: 'scanResult', data: { devices, prefix } });
          if (devices.length > 0) {
            conn.connect(devices[0], config.device.port);
          } else {
            conn.state = 'disconnected';
            broadcast({ type: 'state', data: { state: 'disconnected', reason: 'scan_no_device' } });
          }
        }).catch((err) => {
          broadcast({ type: 'error', data: `扫描失败: ${err.message}` });
          conn.state = 'disconnected';
        });
        break;
      }
      
      // 按名称查找命令并发送
      case 'cmd':
        if (msg.name) {
          const cmd = config.commands[msg.name];
          if (cmd) {
            conn.sendCommand(cmd.id, cmd.type, cmd.value);
          }
        }
        break;
      
      // 直接发送命令（指定id, cmdType, value）
      case 'command':
        if (msg.id && msg.cmdType) {
          conn.sendCommand(msg.id, msg.cmdType, msg.value);
        }
        break;
      
      // 发送原始HEX
      case 'raw':
        if (msg.hex) conn.sendRaw(msg.hex);
        break;
      
      // 查询播放文件列表
      case 'queryPlayList':
        // 先获取组数，再逐个获取文件名
        conn.sendCommand('playGroups', 'get', [0]);
        conn.sendCommand('playCount', 'get', []);
        break;
      
      // 查询推流配置
      case 'queryStreamConfig':
        for (let i = 0; i < 3; i++) {
          conn.sendCommand('liveStreamOutputEnable', 'get', [i]);
          conn.sendCommand('liveStreamOutputUrl', 'get', [i]);
          conn.sendCommand('liveStreamOutputKey', 'get', [i]);
          conn.sendCommand('liveStreamOutputStatus', 'get', [i]);
        }
        break;
      
      case 'getStatus':
        ws.send(JSON.stringify({ type: 'state', data: conn.getStatus() }));
        break;
    }
  });
  
  ws.on('close', () => console.log('[WS] 客户端已断开'));
});

server.listen(config.server.port, () => {
  console.log('============================================================');
  console.log('  OSEE 导播台 Web 控制台');
  console.log('============================================================');
  console.log(`  Web服务地址: http://localhost:${config.server.port}`);
  console.log(`  设备端口: ${config.device.port}`);
  console.log('============================================================');
});
