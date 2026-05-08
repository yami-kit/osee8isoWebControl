/**
 * OSEE 导播台 - TCP连接管理器
 * 
 * 功能：
 * - 自动获取本机内网网卡，识别网段
 * - 自动扫描当前网段1~255的端口19010
 * - TCP长连接，断线自动重连（指数退避）
 * - 独立500ms定时器发送心跳包（不被其他任务阻塞）
 * - 连接后自动完成握手流程
 */

const net = require('net');
const os = require('os');
const { EventEmitter } = require('events');
const protocol = require('./protocol');
const config = require('./config');

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    
    // TCP socket
    this.socket = null;
    
    // 连接状态
    this.state = 'disconnected'; // disconnected | scanning | connecting | connected
    
    // 目标设备IP和端口
    this.targetIp = config.device.defaultIp;
    this.targetPort = config.device.port;
    
    // 心跳定时器
    this.heartbeatTimer = null;
    
    // 重连定时器
    this.reconnectTimer = null;
    this.reconnectDelay = config.device.reconnectBaseDelay;
    
    // 扫描状态
    this.scanAborted = false;
    
    // 接收缓冲区
    this.rxBuffer = Buffer.alloc(0);
    
    // 统计
    this.stats = {
      txCount: 0,
      rxCount: 0,
      lastTxTime: null,
      lastRxTime: null,
    };
  }

  // ============================================================
  // 获取本机内网IP地址列表
  // ============================================================
  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // 只取IPv4、非内部、非回环地址
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({
            address: iface.address,
            netmask: iface.netmask,
            name: name,
          });
        }
      }
    }
    
    return ips;
  }

  // ============================================================
  // 计算网段（基于IP和子网掩码）
  // ============================================================
  getNetworkPrefix(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const prefix = ipParts.map((part, i) => part & maskParts[i]);
    return prefix.join('.');
  }

  // ============================================================
  // 扫描指定网段的19010端口
  // 返回发现的设备IP列表
  // ============================================================
  async scanNetwork(prefix, onProgress) {
    const results = [];
    this.scanAborted = false;
    
    const ips = [];
    for (let i = 1; i <= 254; i++) {
      ips.push(`${prefix}.${i}`);
    }
    
    const timeout = config.device.scanTimeout;
    const port = config.device.port;
    const aborted = () => this.scanAborted;
    
    const checkPort = (ip) => {
      return new Promise((resolve) => {
        if (aborted()) { resolve(null); return; }
        
        const sock = new net.Socket();
        let done = false;
        
        const finish = (result) => {
          if (!done) { done = true; try { sock.destroy(); } catch(e){} resolve(result); }
        };
        
        sock.setTimeout(timeout);
        sock.on('connect', () => finish(ip));
        sock.on('timeout', () => finish(null));
        sock.on('error', () => finish(null));
        
        try {
          sock.connect(port, ip);
        } catch(e) {
          finish(null);
        }
      });
    };
    
    // 并发扫描，每批10个
    const batchSize = 10;
    for (let i = 0; i < ips.length; i += batchSize) {
      if (this.scanAborted) break;
      
      const batch = ips.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(checkPort));
      
      batchResults.forEach(ip => { if (ip) results.push(ip); });
      
      if (onProgress) {
        onProgress({
          scanned: Math.min(i + batchSize, ips.length),
          total: ips.length,
          found: results.length,
          devices: results,
        });
      }
    }
    
    return results;
  }

  // ============================================================
  // 停止扫描
  // ============================================================
  abortScan() {
    this.scanAborted = true;
  }

  // ============================================================
  // 连接到指定设备
  // ============================================================
  connect(ip, port) {
    if (this.socket) {
      this.disconnect();
    }
    
    this.targetIp = ip || this.targetIp;
    this.targetPort = port || this.targetPort;
    this.state = 'connecting';
    this.reconnectDelay = config.device.reconnectBaseDelay;
    
    this.emit('state', {
      state: 'connecting',
      ip: this.targetIp,
      port: this.targetPort,
    });
    
    this._createSocket();
  }

  // ============================================================
  // 创建TCP Socket并连接
  // ============================================================
  _createSocket() {
    this.socket = new net.Socket();
    this.rxBuffer = Buffer.alloc(0);
    
    // 设置连接超时
    this.socket.setTimeout(config.device.connectTimeout);
    
    // 连接成功
    this.socket.on('connect', () => {
      this.state = 'connected';
      this.reconnectDelay = config.device.reconnectBaseDelay;
      
      this.emit('state', {
        state: 'connected',
        ip: this.targetIp,
        port: this.targetPort,
      });
      
      // 发送初始ping字节
      this.socket.write(Buffer.from([0x00]));
      
      // 发送握手序列
      this._sendHandshake();
      
      // 启动心跳
      this._startHeartbeat();
    });
    
    // 接收数据
    this.socket.on('data', (data) => {
      this._onData(data);
    });
    
    // 连接关闭
    this.socket.on('close', () => {
      this._onDisconnect('closed');
    });
    
    // 连接错误
    this.socket.on('error', (err) => {
      this.emit('error', err.message);
    });
    
    // 超时
    this.socket.on('timeout', () => {
      this.socket.destroy();
    });
    
    // 连接
    this.socket.connect(this.targetPort, this.targetIp);
  }

  // ============================================================
  // 发送握手序列
  // ============================================================
  _sendHandshake() {
    // 发送时间同步
    const now = Math.floor(Date.now() / 1000);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
    this.sendCommand('pcTimeSecs', 'set', [now, timezone]);
    
    // 延迟发送查询命令（避免拥塞）
    const queries = config.handshakeSequence;
    queries.forEach((cmdName, index) => {
      setTimeout(() => {
        if (this.state === 'connected') {
          const cmd = config.commands[cmdName];
          if (cmd) {
            this.sendCommand(cmd.id, cmd.type, cmd.value || []);
          }
        }
      }, 100 * (index + 1));
    });
    
    // 状态查询
    setTimeout(() => {
      if (this.state === 'connected') {
        config.statusQueries.forEach((cmdName) => {
          const cmd = config.commands[cmdName];
          if (cmd) {
            this.sendCommand(cmd.id, cmd.type, cmd.value || []);
          }
        });
      }
    }, 100 * (queries.length + 1));
  }

  // ============================================================
  // 启动心跳定时器
  // ============================================================
  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.socket && !this.socket.destroyed) {
        const heartbeat = protocol.buildHeartbeat();
        try {
          this.socket.write(heartbeat);
          this.stats.txCount++;
          this.stats.lastTxTime = Date.now();
          this.emit('tx', {
            hex: protocol.bufferToHex(heartbeat),
            json: { id: 'audioMeter', type: 'get', value: [] },
            type: 'heartbeat',
          });
        } catch (err) {
          // 发送失败，触发断线处理
          this._onDisconnect('send_error');
        }
      }
    }, config.device.heartbeatInterval);
  }

  // ============================================================
  // 停止心跳定时器
  // ============================================================
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ============================================================
  // 处理接收到的数据
  // ============================================================
  _onData(data) {
    // 追加到缓冲区
    this.rxBuffer = Buffer.concat([this.rxBuffer, data]);
    
    // 解析帧
    const frames = protocol.parseFrames(this.rxBuffer);
    
    // 计算已消费的字节数
    let consumed = 0;
    
    for (const frame of frames) {
      // 统计
      this.stats.rxCount++;
      this.stats.lastRxTime = Date.now();
      
      // 发射接收事件
      this.emit('rx', {
        hex: frame.hex,
        json: frame.json,
        type: frame.json?._type === 'heartbeat' ? 'heartbeat' : 'data',
      });
      
      // 如果是推送消息，发射push事件
      if (frame.json && config.pushEvents.includes(frame.json.id)) {
        this.emit('push', frame.json);
      }
      
      // 计算消费的字节数
      consumed += frame.raw.length;
    }
    
    // 从缓冲区移除已消费的数据
    if (consumed > 0) {
      this.rxBuffer = this.rxBuffer.slice(consumed);
    }
    
    // 防止缓冲区过大（超过64KB时清空）
    if (this.rxBuffer.length > 65536) {
      this.rxBuffer = Buffer.alloc(0);
    }
  }

  // ============================================================
  // 断线处理
  // ============================================================
  _onDisconnect(reason) {
    if (this.state === 'disconnected') return;
    
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this._stopHeartbeat();
    
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
      this.socket = null;
    }
    
    this.emit('state', {
      state: 'disconnected',
      ip: this.targetIp,
      port: this.targetPort,
      reason: reason,
    });
    
    // 自动重连（指数退避）
    if (wasConnected) {
      this.emit('log', `连接断开(${reason})，${this.reconnectDelay / 1000}秒后重连...`);
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.targetIp, this.targetPort);
      }, this.reconnectDelay);
      
      // 指数退避
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        config.device.reconnectMaxDelay
      );
    }
  }

  // ============================================================
  // 断开连接
  // ============================================================
  disconnect() {
    this._stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.state = 'disconnected';
    
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
      this.socket = null;
    }
    
    this.emit('state', {
      state: 'disconnected',
      ip: this.targetIp,
      port: this.targetPort,
      reason: 'manual',
    });
  }

  // ============================================================
  // 发送命令
  // ============================================================
  sendCommand(id, type, value) {
    if (this.state !== 'connected' || !this.socket || this.socket.destroyed) {
      this.emit('error', '未连接设备');
      return false;
    }
    
    const frame = protocol.buildCommand(id, type, value || []);
    
    try {
      console.log(`[TCP TX] ${id} ${type} ${JSON.stringify(value || [])} -> ${protocol.bufferToHex(frame).substring(0, 40)}...`);
      this.socket.write(frame);
      this.stats.txCount++;
      this.stats.lastTxTime = Date.now();
      
      this.emit('tx', {
        hex: protocol.bufferToHex(frame),
        json: { id, type, value: value || [] },
        type: 'command',
      });
      
      return true;
    } catch (err) {
      this.emit('error', `发送失败: ${err.message}`);
      return false;
    }
  }

  // ============================================================
  // 发送原始HEX数据
  // ============================================================
  sendRaw(hexStr) {
    if (this.state !== 'connected' || !this.socket || this.socket.destroyed) {
      this.emit('error', '未连接设备');
      return false;
    }
    
    const buffer = protocol.hexToBuffer(hexStr);
    
    try {
      this.socket.write(buffer);
      this.stats.txCount++;
      this.stats.lastTxTime = Date.now();
      
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

  // ============================================================
  // 获取连接状态
  // ============================================================
  getStatus() {
    return {
      state: this.state,
      ip: this.targetIp,
      port: this.targetPort,
      stats: { ...this.stats },
    };
  }
}

module.exports = ConnectionManager;
