/**
 * OSEE 导播台 - 前端控制逻辑 (Capacitor版本)
 * 
 * 使用Capacitor TCP插件直接与设备通信
 */
(function() {
'use strict';

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  device: {
    defaultIp: '',
    port: 19010,
    heartbeatInterval: 500,
    connectTimeout: 5000,
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30000,
  },
  sources: [
    { id: 1,    name: 'IN1',    group: 'input' },
    { id: 2,    name: 'IN2',    group: 'input' },
    { id: 3,    name: 'IN3',    group: 'input' },
    { id: 4,    name: 'IN4',    group: 'input' },
    { id: 4001, name: 'IN5',    group: 'input' },
    { id: 4002, name: 'IN6',    group: 'input' },
    { id: 4003, name: 'IN7',    group: 'input' },
    { id: 4004, name: 'IN8',    group: 'input' },
    { id: 3010, name: 'MP1',    group: 'media' },
    { id: 3020, name: 'MP2',    group: 'media' },
    { id: 5001, name: 'M/SRC',  group: 'media' },
  ],
  commands: {
    pgmIndex: { id: 'pgmIndex', type: 'set', label: 'PGM切换' },
    pvwIndex: { id: 'pvwIndex', type: 'set', label: 'PVW切换' },
    cutTransition: { id: 'cutTransition', type: 'set', value: [], label: 'CUT' },
    autoTransition: { id: 'autoTransition', type: 'set', value: [], label: 'AUTO' },
    transitionStyleMix: { id: 'transitionStyle', type: 'set', value: ['Mix'], label: 'MIX' },
    transitionStyleDip: { id: 'transitionStyle', type: 'set', value: ['Dip'], label: 'DIP' },
    transitionStyleWipe: { id: 'transitionStyle', type: 'set', value: ['Wipe'], label: 'WIPE' },
    nextTransitionBG: { id: 'nextTransition', type: 'set', value: ['Background'], label: 'BG' },
    nextTransitionBGKey: { id: 'nextTransition', type: 'set', value: ['Background', 'Key'], label: 'BG+KEY' },
    keyOnAir0On: { id: 'keyOnAir', type: 'set', value: [0, 1], label: 'KEY ON' },
    keyOnAir0Off: { id: 'keyOnAir', type: 'set', value: [0, 0], label: 'KEY OFF' },
    dsk1OnAirOn: { id: 'dskOnAir', type: 'set', value: [0, 1], label: 'DSK1 ON' },
    dsk1OnAirOff: { id: 'dskOnAir', type: 'set', value: [0, 0], label: 'DSK1 OFF' },
    dsk2OnAirOn: { id: 'dskOnAir', type: 'set', value: [1, 1], label: 'DSK2 ON' },
    dsk2OnAirOff: { id: 'dskOnAir', type: 'set', value: [1, 0], label: 'DSK2 OFF' },
    recordStart: { id: 'recordStart', type: 'set', value: [0], label: 'REC' },
    recordStartISO: { id: 'recordStart', type: 'set', value: [1], label: 'ISO REC' },
    recordStop: { id: 'recordStop', type: 'set', value: [], label: 'STOP REC' },
    ftb: { id: 'ftb', type: 'set', value: [], label: 'FTB' },
    playToggle0: { id: 'playPause', type: 'set', value: [0, 1], label: 'P1 切换播放/暂停' },
    playToggle1: { id: 'playPause', type: 'set', value: [1, 1], label: 'P2 切换播放/暂停' },
    playPrev0: { id: 'playPrev', type: 'set', value: [0], label: 'P1 上一个' },
    playNext0: { id: 'playNext', type: 'set', value: [0], label: 'P1 下一个' },
    playPrev1: { id: 'playPrev', type: 'set', value: [1], label: 'P2 上一个' },
    playNext1: { id: 'playNext', type: 'set', value: [1], label: 'P2 下一个' },
    liveStreamEnable0On: { id: 'liveStreamOutputEnable', type: 'set', value: [0, 1], label: '推流1 启用' },
    liveStreamEnable0Off: { id: 'liveStreamOutputEnable', type: 'set', value: [0, 0], label: '推流1 禁用' },
    liveStreamEnable1On: { id: 'liveStreamOutputEnable', type: 'set', value: [1, 1], label: '推流2 启用' },
    liveStreamEnable1Off: { id: 'liveStreamOutputEnable', type: 'set', value: [1, 0], label: '推流2 禁用' },
    liveStreamEnable2On: { id: 'liveStreamOutputEnable', type: 'set', value: [2, 1], label: '推流3 启用' },
    liveStreamEnable2Off: { id: 'liveStreamOutputEnable', type: 'set', value: [2, 0], label: '推流3 禁用' },
    liveStreamUrl0: { id: 'liveStreamOutputUrl', type: 'set', label: '推流1 URL' },
    liveStreamUrl1: { id: 'liveStreamOutputUrl', type: 'set', label: '推流2 URL' },
    liveStreamUrl2: { id: 'liveStreamOutputUrl', type: 'set', label: '推流3 URL' },
    liveStreamKey0: { id: 'liveStreamOutputKey', type: 'set', label: '推流1 Key' },
    liveStreamKey1: { id: 'liveStreamOutputKey', type: 'set', label: '推流2 Key' },
    liveStreamKey2: { id: 'liveStreamOutputKey', type: 'set', label: '推流3 Key' },
    liveGo: { id: 'live', type: 'set', value: [], label: 'GO LIVE' },
    liveStop0: { id: 'liveStreamOutputEnable', type: 'set', value: [0, 0], label: '停止推流1' },
    liveStop1: { id: 'liveStreamOutputEnable', type: 'set', value: [1, 0], label: '停止推流2' },
    liveStop2: { id: 'liveStreamOutputEnable', type: 'set', value: [2, 0], label: '停止推流3' },
  },
  commandNames: {
    pgmIndex: 'PGM切换', pvwIndex: 'PVW切换', pgmTally: 'PGM Tally', pvwTally: 'PVW Tally',
    cutTransition: '硬切', autoTransition: '自动转场', transitionStyle: '转场样式',
    transitionStatus: '转场状态', nextTransition: '下一转场', keyOnAir: 'Key上线',
    dskOnAir: 'DSK上线', recordStart: '开始录制', recordStop: '停止录制',
    recordStatus: '录制状态', recordDuration: '录制时长', ftb: '黑屏', ftbStatus: '黑屏状态',
    playPause: '播放/暂停', playPrev: '上一个', playNext: '下一个', playStatus: '播放状态',
    liveStreamOutputEnable: '推流开关', liveStreamOutputUrl: '推流URL',
    liveStreamOutputKey: '推流Key', liveStreamOutputStatus: '推流状态',
    live: '开始推流', audioMeter: '音频电平', version: '版本', buildInfo: '构建信息',
    deviceId: '设备ID', deviceType: '设备类型', deviceName: '设备名称', shortName: '短名称',
    pcTimeSecs: '时间同步',
  },
  handshakeSequence: ['version', 'buildInfo', 'deviceId', 'deviceType', 'deviceName'],
  statusQueries: ['pgmTally', 'pvwTally', 'recordStatus', 'playStatus', 'liveStreamOutputStatus', 'transitionStyle'],
  pushEvents: [
    'pgmIndex', 'pvwIndex', 'pgmTally', 'pvwTally',
    'recordStatus', 'recordDuration', 'recordFree',
    'playStatus', 'playProgress', 'playFileName', 'playGroups', 'playCount',
    'liveStreamOutputStatus', 'liveStreamOutputProfile',
    'liveStreamOutputUrl', 'liveStreamOutputKey', 'liveStreamOutputServiceName',
    'transitionStatus', 'transitionStyle',
    'ftbStatus', 'keyOnAir', 'dskOnAir',
    'audioMeter',
    'version', 'buildInfo', 'deviceId', 'deviceType', 'deviceName', 'shortName',
    'playbackMode', 'playbackCutLogic',
    'still', 'stillDataProgress',
  ],
};

// ============================================================
// 协议引擎 (浏览器兼容版本)
// ============================================================
const Protocol = {
  // CRC-16/MODBUS算法
  crc16Modbus(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  },

  // 构建协议帧
  buildFrame(jsonObj) {
    let jsonStr = JSON.stringify(jsonObj, null, '    ') + '\n';
    jsonStr = jsonStr.replace(/\[\]/g, '[\n    ]');
    jsonStr = jsonStr.replace(/\n+$/, '');
    
    const encoder = new TextEncoder();
    const jsonBytes = encoder.encode(jsonStr);
    
    const lenValue = jsonBytes.length + 1 + 2;
    
    const frameBody = new Uint8Array(2 + 2 + 1 + jsonBytes.length + 1);
    let offset = 0;
    
    frameBody[offset++] = 0xEB;
    frameBody[offset++] = 0xA6;
    frameBody[offset++] = (lenValue >> 8) & 0xFF;
    frameBody[offset++] = lenValue & 0xFF;
    frameBody[offset++] = 0x00;
    
    frameBody.set(jsonBytes, offset);
    offset += jsonBytes.length;
    
    frameBody[offset++] = 0x0A;
    
    const crc = this.crc16Modbus(frameBody);
    
    const fullFrame = new Uint8Array(frameBody.length + 2);
    fullFrame.set(frameBody, 0);
    fullFrame[frameBody.length] = crc & 0xFF;
    fullFrame[frameBody.length + 1] = (crc >> 8) & 0xFF;
    
    return fullFrame;
  },

  // 解析接收到的数据
  parseFrames(buffer) {
    const frames = [];
    let pos = 0;
    
    while (pos < buffer.length - 1) {
      if (buffer[pos] === 0xEB && buffer[pos + 1] === 0xA6) {
        if (pos + 4 > buffer.length) break;
        const lenValue = (buffer[pos + 2] << 8) | buffer[pos + 3];
        
        const frameLen = 2 + 2 + 1 + lenValue;
        
        if (pos + frameLen > buffer.length) break;
        
        const frameData = buffer.slice(pos, pos + frameLen);
        
        const jsonStart = 5;
        const jsonEnd = frameLen - 3;
        
        if (jsonEnd > jsonStart) {
          const jsonBytes = frameData.slice(jsonStart, jsonEnd);
          const decoder = new TextDecoder('utf-8');
          const jsonStr = decoder.decode(jsonBytes).trim();
          
          let jsonObj = null;
          try {
            jsonObj = JSON.parse(jsonStr);
          } catch (e) {}
          
          frames.push({
            hex: Array.from(frameData).map(b => b.toString(16).padStart(2, '0')).join(':'),
            json: jsonObj,
            raw: frameData
          });
        }
        
        pos += frameLen;
      } else {
        if (buffer[pos] === 0x00 && (pos + 1 >= buffer.length || buffer[pos + 1] !== 0xEB)) {
          frames.push({
            hex: '00',
            json: { _type: 'heartbeat' },
            raw: new Uint8Array([0x00])
          });
        }
        pos++;
      }
    }
    
    return frames;
  },

  // 构建命令
  buildCommand(id, type, value) {
    return this.buildFrame({ id, type, value: value || [] });
  },

  // 构建心跳包
  buildHeartbeat() {
    return this.buildCommand('audioMeter', 'get', []);
  },

  // Buffer转HEX字符串
  bufferToHex(buffer) {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(':');
  },

  // HEX字符串转Buffer
  hexToBuffer(hexStr) {
    const bytes = hexStr.replace(/[^0-9a-fA-F]/g, '').match(/.{2}/g);
    return new Uint8Array(bytes.map(b => parseInt(b, 16)));
  }
};

// ============================================================
// TCP连接管理器 (使用Capacitor TCP插件)
// ============================================================
class TCPConnection {
  constructor() {
    this.clientId = null;
    this.state = 'disconnected';
    this.targetIp = CONFIG.device.defaultIp;
    this.targetPort = CONFIG.device.port;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.reconnectDelay = CONFIG.device.reconnectBaseDelay;
    this.rxBuffer = new Uint8Array(0);
    this.listeners = {};
    this.readLoopRunning = false;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  async connect(ip, port) {
    if (this.state === 'connected' || this.state === 'connecting') {
      await this.disconnect();
    }
    
    this.targetIp = ip || this.targetIp;
    this.targetPort = port || this.targetPort;
    this.state = 'connecting';
    this.reconnectDelay = CONFIG.device.reconnectBaseDelay;
    
    this.emit('state', {
      state: 'connecting',
      ip: this.targetIp,
      port: this.targetPort,
    });
    
    try {
      const { TcpSocket } = window.Capacitor.Plugins;
      
      const result = await TcpSocket.connect({
        ipAddress: this.targetIp,
        port: this.targetPort
      });
      
      this.clientId = result.client;
      this.state = 'connected';
      
      this.emit('state', {
        state: 'connected',
        ip: this.targetIp,
        port: this.targetPort,
      });
      
      // 发送初始ping字节
      await this.sendRaw('00');
      
      // 发送握手序列
      await this._sendHandshake();
      
      // 启动心跳
      this._startHeartbeat();
      
      // 启动读取循环
      this._startReadLoop();
      
    } catch (error) {
      this.emit('error', `连接失败: ${error.message || error}`);
      this.state = 'disconnected';
      this.emit('state', { state: 'disconnected', ip: this.targetIp, port: this.targetPort });
    }
  }

  async disconnect() {
    this._stopHeartbeat();
    this._stopReconnect();
    this.readLoopRunning = false;
    
    if (this.clientId !== null) {
      try {
        const { TcpSocket } = window.Capacitor.Plugins;
        await TcpSocket.disconnect({ client: this.clientId });
      } catch (e) {}
      this.clientId = null;
    }
    
    this.state = 'disconnected';
    this.emit('state', { state: 'disconnected', ip: this.targetIp, port: this.targetPort, reason: 'manual' });
  }

  async _sendHandshake() {
    const now = Math.floor(Date.now() / 1000);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
    await this.sendCommand('pcTimeSecs', 'set', [now, timezone]);
    
    const queries = CONFIG.handshakeSequence;
    for (let i = 0; i < queries.length; i++) {
      if (this.state !== 'connected') break;
      const cmdName = queries[i];
      const cmd = CONFIG.commands[cmdName];
      if (cmd) {
        await this.sendCommand(cmd.id, cmd.type, cmd.value || []);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setTimeout(async () => {
      if (this.state === 'connected') {
        for (const cmdName of CONFIG.statusQueries) {
          const cmd = CONFIG.commands[cmdName];
          if (cmd) {
            await this.sendCommand(cmd.id, cmd.type, cmd.value || []);
          }
        }
      }
    }, 100 * (queries.length + 1));
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.heartbeatTimer = setInterval(async () => {
      if (this.state === 'connected' && this.clientId !== null) {
        const heartbeat = Protocol.buildHeartbeat();
        try {
          await this._sendData(heartbeat);
          this.emit('tx', {
            hex: Protocol.bufferToHex(heartbeat),
            json: { id: 'audioMeter', type: 'get', value: [] },
            type: 'heartbeat',
          });
        } catch (err) {
          this._onDisconnect('send_error');
        }
      }
    }, CONFIG.device.heartbeatInterval);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async _startReadLoop() {
    this.readLoopRunning = true;
    
    while (this.readLoopRunning && this.state === 'connected' && this.clientId !== null) {
      try {
        const { TcpSocket } = window.Capacitor.Plugins;
        const result = await TcpSocket.read({
          client: this.clientId,
          expectLen: 4096,
          encoding: 'base64'
        });
        
        if (result && result.result) {
          const binaryString = atob(result.result);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          this.rxBuffer = new Uint8Array([...this.rxBuffer, ...bytes]);
          
          const frames = Protocol.parseFrames(this.rxBuffer);
          
          let consumed = 0;
          for (const frame of frames) {
            this.emit('rx', {
              hex: frame.hex,
              json: frame.json,
              type: frame.json?._type === 'heartbeat' ? 'heartbeat' : 'data',
            });
            
            if (frame.json && CONFIG.pushEvents.includes(frame.json.id)) {
              this.emit('push', frame.json);
            }
            
            consumed += frame.raw.length;
          }
          
          if (consumed > 0) {
            this.rxBuffer = this.rxBuffer.slice(consumed);
          }
          
          if (this.rxBuffer.length > 65536) {
            this.rxBuffer = new Uint8Array(0);
          }
        }
      } catch (error) {
        if (this.state === 'connected') {
          // 读取错误，可能是连接断开
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }

  async _onDisconnect(reason) {
    if (this.state === 'disconnected') return;
    
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this._stopHeartbeat();
    this.readLoopRunning = false;
    
    if (this.clientId !== null) {
      try {
        const { TcpSocket } = window.Capacitor.Plugins;
        await TcpSocket.disconnect({ client: this.clientId });
      } catch (e) {}
      this.clientId = null;
    }
    
    this.emit('state', {
      state: 'disconnected',
      ip: this.targetIp,
      port: this.targetPort,
      reason: reason,
    });
    
    if (wasConnected) {
      this.emit('log', `连接断开(${reason})，${this.reconnectDelay / 1000}秒后重连...`);
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.targetIp, this.targetPort);
      }, this.reconnectDelay);
      
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        CONFIG.device.reconnectMaxDelay
      );
    }
  }

  async sendCommand(id, type, value) {
    if (this.state !== 'connected' || this.clientId === null) {
      this.emit('error', '未连接设备');
      return false;
    }
    
    const frame = Protocol.buildCommand(id, type, value || []);
    
    try {
      await this._sendData(frame);
      this.emit('tx', {
        hex: Protocol.bufferToHex(frame),
        json: { id, type, value: value || [] },
        type: 'command',
      });
      return true;
    } catch (err) {
      this.emit('error', `发送失败: ${err.message}`);
      return false;
    }
  }

  async sendRaw(hexStr) {
    if (this.state !== 'connected' || this.clientId === null) {
      this.emit('error', '未连接设备');
      return false;
    }
    
    const buffer = Protocol.hexToBuffer(hexStr);
    
    try {
      await this._sendData(buffer);
      this.emit('tx', {
        hex: hexStr,
        json: null,
        type: 'raw',
      });
      return true;
    } catch (err) {
      this.emit('error', `发送失败: ${err.message}`);
      return false;
    }
  }

  async _sendData(data) {
    const { TcpSocket } = window.Capacitor.Plugins;
    const base64 = btoa(String.fromCharCode(...data));
    await TcpSocket.send({
      client: this.clientId,
      data: base64,
      encoding: 'base64'
    });
  }

  getStatus() {
    return {
      state: this.state,
      ip: this.targetIp,
      port: this.targetPort,
    };
  }
}

// ============================================================
// 应用状态
// ============================================================
const S = {
  conn: null,
  pgm: null, pvw: null, recStatus: 0,
  playStatus: [0, 0],
  streamLive: [false, false, false],
  ftbActive: false, keyOnAir: [false], dskOnAir: [false, false],
  logOpen: false,
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
let dom = {};

function cacheDom() {
  dom = {
    connDot: $('#connDot'), deviceName: $('#deviceName'),
    inputIp: $('#inputIp'), btnConnect: $('#btnConnect'),
    btnSettings: $('#btnSettings'), btnLog: $('#btnLog'),
    pgmButtons: $('#pgmButtons'), pvwButtons: $('#pvwButtons'),
    recStatus: $('#recStatus'), recDuration: $('#recDuration'),
    playStatus0: $('#playStatus0'), playStatus1: $('#playStatus1'),
    settingsPanel: $('#settingsPanel'), settingsOverlay: $('#settingsOverlay'),
    btnSettingsClose: $('#btnSettingsClose'),
    logPanel: $('#logPanel'), logContent: $('#logContent'),
    btnLogClear: $('#btnLogClear'), btnLogClose: $('#btnLogClose'),
    streamDots: [$('#streamDot0'), $('#streamDot1'), $('#streamDot2')],
  };
}

function connectDevice() {
  S.conn = new TCPConnection();
  
  S.conn.on('state', handleState);
  S.conn.on('tx', handleTx);
  S.conn.on('rx', handleRx);
  S.conn.on('push', handlePush);
  S.conn.on('error', msg => { if (msg) log('error', msg); });
  S.conn.on('log', msg => { if (msg) log('info', msg); });
  
  log('info', 'OSEE 导播台控制台已就绪');
}

function handleState(d) {
  if (!d.state) return;
  dom.connDot.className = 'dot ' + d.state;
  dom.btnConnect.textContent = d.state === 'connected' ? '断开' : '连接';
  dom.inputIp.disabled = d.state === 'connected';
  if (d.state === 'connected' && d.ip) dom.deviceName.textContent = `${d.ip}:${d.port || 19010}`;
  if (d.state === 'disconnected') dom.deviceName.textContent = 'OSEE 导播台';
}

function handleTx(d) {
  if (d.type === 'heartbeat') return;
  const nm = CONFIG.commandNames[d.json?.id] || d.json?.id;
  if (!nm) return;
  const v = d.json?.value?.length ? ` ${JSON.stringify(d.json.value)}` : '';
  log('tx', `→ ${nm}${v}`);
}

function handleRx(d) {
  if (d.type === 'heartbeat') return;
  const nm = CONFIG.commandNames[d.json?.id] || d.json?.id;
  if (!nm) return;
  const v = d.json?.value?.length ? ` ${JSON.stringify(d.json.value)}` : '';
  log('rx', `← ${nm}${v}`);
}

function handlePush(d) {
  if (!d?.id) return;
  switch (d.id) {
    case 'pgmTally': case 'pgmIndex':
      if (d.value?.length) { S.pgm = d.value[0]; hlSrc('pgm', S.pgm); } break;
    case 'pvwTally': case 'pvwIndex':
      if (d.value?.length) { S.pvw = d.value[0]; hlSrc('pvw', S.pvw); } break;
    case 'recordStatus':
      if (d.value?.length) { S.recStatus = d.value[0]; updRec(); } break;
    case 'recordDuration':
      if (d.value?.length) dom.recDuration.textContent = fmtDur(d.value[0]); break;
    case 'playStatus':
      if (d.value?.length >= 2) { S.playStatus[d.value[0]] = d.value[1]; updPlay(d.value[0]); } break;
    case 'liveStreamOutputStatus':
      if (d.value?.length >= 2) {
        const gi = d.value[0];
        S.streamLive[gi] = d.value[1] >= 2;
        updStreamUI(gi);
      } break;
    case 'liveStreamOutputUrl':
      if (d.value?.length >= 2) {
        const inp = $(`.stream-url[data-group="${d.value[0]}"]`);
        if (inp) inp.value = d.value[1] || '';
      } break;
    case 'liveStreamOutputKey':
      if (d.value?.length >= 2) {
        const inp = $(`.stream-key[data-group="${d.value[0]}"]`);
        if (inp) inp.value = d.value[1] || '';
      } break;
    case 'ftbStatus':
      if (d.value?.length) {
        S.ftbActive = d.value[0] === 1;
        $('[data-cmd="ftb"]')?.classList.toggle('active', S.ftbActive);
      } break;
    case 'keyOnAir':
      if (d.value?.length >= 2) { S.keyOnAir[d.value[0]] = d.value[1] === 1; updAir(); } break;
    case 'dskOnAir':
      if (d.value?.length >= 2) { S.dskOnAir[d.value[0]] = d.value[1] === 1; updAir(); } break;
    case 'transitionStyle':
      if (d.value?.length) {
        $$('.trans-btn').forEach(b => {
          const c = CONFIG.commands[b.dataset.cmd];
          b.classList.toggle('active', c?.value?.[0] === d.value[0]);
        });
      } break;
  }
}

function buildSourceButtons() {
  dom.pgmButtons.innerHTML = '';
  dom.pvwButtons.innerHTML = '';
  CONFIG.sources.forEach(src => {
    const pb = document.createElement('button');
    pb.className = 'src-btn'; pb.textContent = src.name; pb.dataset.sid = src.id;
    pb.addEventListener('click', () => S.conn.sendCommand('pgmIndex', 'set', [src.id]));
    dom.pgmButtons.appendChild(pb);
    const vb = document.createElement('button');
    vb.className = 'src-btn'; vb.textContent = src.name; vb.dataset.sid = src.id;
    vb.addEventListener('click', () => S.conn.sendCommand('pvwIndex', 'set', [src.id]));
    dom.pvwButtons.appendChild(vb);
  });
}

function hlSrc(bus, sid) {
  (bus === 'pgm' ? dom.pgmButtons : dom.pvwButtons)
    ?.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', +b.dataset.sid === sid));
}

function updRec() {
  const m = { 0: '待机', 1: '录制中', 2: '停止中' };
  dom.recStatus.textContent = m[S.recStatus] || '未知';
  dom.recStatus.classList.toggle('active', S.recStatus === 1);
  $$('.rec-btn,.rec-iso-btn').forEach(b => b.classList.toggle('active', S.recStatus === 1));
}

function updPlay(pi) {
  const st = S.playStatus[pi], m = { 0: '停止', 1: '播放中', 2: '暂停' };
  const tag = dom[`playStatus${pi}`];
  if (tag) { tag.textContent = m[st] || '未知'; tag.classList.toggle('active', st === 1); }
  const btn = $(`.play-toggle[data-player="${pi}"]`);
  if (btn) { btn.classList.toggle('playing', st === 1); btn.textContent = st === 1 ? '⏸' : '▶'; }
}

function updStreamUI(gi) {
  const dot = dom.streamDots[gi];
  if (dot) dot.className = 'stream-dot ' + (S.streamLive[gi] ? 'on' : 'off');
  $$(`.live-btn[data-group="${gi}"],.live-btn-settings[data-group="${gi}"]`).forEach(b => {
    b.classList.toggle('active', S.streamLive[gi]);
    if (b.classList.contains('live-btn')) b.textContent = S.streamLive[gi] ? 'STOP' : `L${gi + 1}`;
    else b.textContent = S.streamLive[gi] ? 'STOP' : 'GO LIVE';
  });
}

function updAir() {
  $$('.toggle-btn[data-on="keyOnAir0On"]').forEach(b => b.classList.toggle('active', S.keyOnAir[0]));
  $$('.toggle-btn[data-on="dsk1OnAirOn"]').forEach(b => b.classList.toggle('active', S.dskOnAir[0]));
  $$('.toggle-btn[data-on="dsk2OnAirOn"]').forEach(b => b.classList.toggle('active', S.dskOnAir[1]));
}

function log(type, msg) {
  if (!dom.logContent || !msg) return;
  const e = document.createElement('div');
  e.className = `log-entry log-${type}`;
  e.textContent = `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${msg}`;
  dom.logContent.appendChild(e);
  while (dom.logContent.children.length > 200) dom.logContent.removeChild(dom.logContent.firstChild);
  dom.logContent.scrollTop = dom.logContent.scrollHeight;
}

function fmtDur(s) {
  if (typeof s !== 'number') return '';
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map(v => String(v).padStart(2, '0')).join(':');
}

function bindEvents() {
  dom.btnSettings.addEventListener('click', () => toggleSet(true));
  dom.btnSettingsClose.addEventListener('click', () => toggleSet(false));
  dom.settingsOverlay.addEventListener('click', () => toggleSet(false));

  dom.btnLog.addEventListener('click', () => { S.logOpen = !S.logOpen; dom.logPanel.classList.toggle('open', S.logOpen); });
  dom.btnLogClose.addEventListener('click', () => { S.logOpen = false; dom.logPanel.classList.remove('open'); });
  dom.btnLogClear.addEventListener('click', () => { dom.logContent.innerHTML = ''; });

  dom.btnConnect.addEventListener('click', () => {
    if (dom.connDot.classList.contains('connected')) {
      S.conn.disconnect();
    } else {
      const ip = dom.inputIp.value.trim();
      if (ip) S.conn.connect(ip, 19010);
    }
  });

  dom.inputIp.addEventListener('keydown', e => { if (e.key === 'Enter') dom.btnConnect.click(); });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd]');
    if (btn) S.conn.sendCommand(CONFIG.commands[btn.dataset.cmd].id, CONFIG.commands[btn.dataset.cmd].type, CONFIG.commands[btn.dataset.cmd].value);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) S.conn.sendCommand(CONFIG.commands[btn.classList.contains('active') ? btn.dataset.off : btn.dataset.on].id, CONFIG.commands[btn.classList.contains('active') ? btn.dataset.off : btn.dataset.on].type, CONFIG.commands[btn.classList.contains('active') ? btn.dataset.off : btn.dataset.on].value);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.play-toggle');
    if (btn) {
      const pi = +btn.dataset.player;
      S.conn.sendCommand('playPause', 'set', [pi, S.playStatus[pi] === 2 ? 1 : 0]);
    }
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.live-btn,.live-btn-settings');
    if (btn) {
      const gi = +btn.dataset.group;
      if (S.streamLive[gi]) {
        S.conn.sendCommand('liveStreamOutputEnable', 'set', [gi, 0]);
        log('info', `推流${gi + 1} 停止`);
      } else {
        S.conn.sendCommand('liveStreamOutputEnable', 'set', [gi, 1]);
        setTimeout(() => { S.conn.sendCommand('live', 'set', []); log('info', `推流${gi + 1} GO LIVE`); }, 300);
      }
    }
  });

  document.addEventListener('change', e => {
    const cb = e.target.closest('.stream-enable');
    if (cb) S.conn.sendCommand('liveStreamOutputEnable', 'set', [+cb.dataset.group, cb.checked ? 1 : 0]);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.stream-save');
    if (btn) {
      const gi = +btn.dataset.group;
      const url = $(`.stream-url[data-group="${gi}"]`)?.value?.trim();
      const key = $(`.stream-key[data-group="${gi}"]`)?.value?.trim();
      if (url) S.conn.sendCommand('liveStreamOutputUrl', 'set', [gi, url]);
      if (key) S.conn.sendCommand('liveStreamOutputKey', 'set', [gi, key]);
      log('info', `推流${gi + 1} 配置已保存`);
    }
  });
}

function toggleSet(open) {
  dom.settingsPanel.classList.toggle('open', open);
  dom.settingsOverlay.classList.toggle('open', open);
}

function init() {
  cacheDom();
  bindEvents();
  buildSourceButtons();
  connectDevice();
  
  // 自动连接默认IP
  setTimeout(() => {
    if (S.conn && S.conn.state === 'disconnected') {
      S.conn.connect(CONFIG.device.defaultIp, CONFIG.device.port);
    }
  }, 500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
