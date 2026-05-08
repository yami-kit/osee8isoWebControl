/**
 * OSEE 导播台协议引擎
 * 
 * 设备: OSEE GoStream (GOTISO EC系列)
 * 协议: 基于TCP的JSON-RPC变体，端口19010
 * 
 * 协议帧结构:
 * [eb:a6] [len_hi:len_lo] [00] [JSON payload] [0a] [crc_lo:crc_hi]
 * 
 * - 魔术字节: eb a6 (2字节)
 * - 长度: 2字节大端序，值 = JSON字节数(含尾部0a) + 2(CRC)，不含分隔符
 * - 分隔符: 00 (1字节，大数据响应如audioMeter可能为04)
 * - JSON: UTF-8编码，4空格缩进，LF换行
 * - 尾部LF: 0a (1字节，属于JSON body)
 * - CRC-16/MODBUS: 2字节，低字节在前，覆盖从eb到末尾0a的所有字节(不含CRC本身)
 * 
 * 消息类型:
 * - get: 控制器查询设备状态
 * - res: 设备回复get查询
 * - set: 控制器发送控制命令(设备会回复pus确认)
 * - pus: 设备主动推送的状态变更通知
 */

// ============================================================
// CRC-16/MODBUS 算法
// 标准CRC-16/MODBUS实现
// 多项式: 0xA001 (0x8005的反射形式)
// 初始值: 0xFFFF
// 输入反转: 是(反射)
// 输出反转: 是(反射)
// 无最终异或
// ============================================================
function crc16Modbus(data) {
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
}

// ============================================================
// 构建协议帧
// 输入: JSON对象 { id, type, value }
// 输出: Buffer (完整的协议帧，包含魔术字节、长度、分隔符、JSON、CRC)
// ============================================================
function buildFrame(jsonObj) {
  // 构建JSON字符串（与设备格式保持一致：4空格缩进，LF换行，空数组展开）
  let jsonStr = JSON.stringify(jsonObj, null, '    ') + '\n';
  
  // 设备的JSON格式中，空数组 [] 被展开为 [\n    ]
  jsonStr = jsonStr.replace(/\[\]/g, '[\n    ]');
  
  // 移除末尾多余的换行符（帧构建器会添加尾部0a）
  jsonStr = jsonStr.replace(/\n+$/, '');
  
  const jsonBytes = Buffer.from(jsonStr, 'utf8');
  
  // 长度字段值 = JSON字节数(含尾部0a) + 2(CRC)
  // 注意：长度字段不含分隔符(00)
  const lenValue = jsonBytes.length + 1 + 2;
  
  // 构建帧体（不含CRC）
  // [eb:a6] [len_hi:len_lo] [00] [JSON] [0a]
  const frameBody = Buffer.alloc(2 + 2 + 1 + jsonBytes.length + 1);
  let offset = 0;
  
  // 魔术字节
  frameBody[offset++] = 0xEB;
  frameBody[offset++] = 0xA6;
  
  // 长度（大端序）
  frameBody[offset++] = (lenValue >> 8) & 0xFF;
  frameBody[offset++] = lenValue & 0xFF;
  
  // 分隔符
  frameBody[offset++] = 0x00;
  
  // JSON payload
  jsonBytes.copy(frameBody, offset);
  offset += jsonBytes.length;
  
  // 尾部LF
  frameBody[offset++] = 0x0A;
  
  // 计算CRC-16/MODBUS
  const crc = crc16Modbus(frameBody);
  
  // 组装完整帧：帧体 + CRC（低字节在前）
  const fullFrame = Buffer.alloc(frameBody.length + 2);
  frameBody.copy(fullFrame, 0);
  fullFrame[frameBody.length] = crc & 0xFF;        // CRC低字节
  fullFrame[frameBody.length + 1] = (crc >> 8) & 0xFF; // CRC高字节
  
  return fullFrame;
}

// ============================================================
// 解析接收到的数据
// 一个TCP包可能包含多个OSEE帧，需要按魔术字节分割
// 输入: Buffer (原始TCP数据)
// 输出: 数组，每个元素是 { hex, json, raw }
// ============================================================
function parseFrames(buffer) {
  const frames = [];
  let pos = 0;
  
  while (pos < buffer.length - 1) {
    // 查找魔术字节 eb:a6
    if (buffer[pos] === 0xEB && buffer[pos + 1] === 0xA6) {
      // 读取长度字段（大端序）
      if (pos + 4 > buffer.length) break;
      const lenValue = (buffer[pos + 2] << 8) | buffer[pos + 3];
      
      // 完整帧长度 = 2(魔术) + 2(长度) + 1(分隔符) + lenValue
      // 注意：长度字段不含分隔符，分隔符是额外的1字节
      // 分隔符可以是 0x00（普通命令）或 0x04（audioMeter等大数据响应）
      const frameLen = 2 + 2 + 1 + lenValue;
      
      if (pos + frameLen > buffer.length) {
        // 数据不完整，等待更多数据
        break;
      }
      
      // 提取完整帧
      const frameData = buffer.slice(pos, pos + frameLen);
      
      // 提取JSON部分（跳过 eb:a6:len:XX，到末尾0a+CRC之前）
      const jsonStart = 5; // eb(1) + a6(1) + len(2) + separator(1)
      const jsonEnd = frameLen - 3; // 减去 0a(1) + CRC(2)
      
      if (jsonEnd > jsonStart) {
        const jsonBytes = frameData.slice(jsonStart, jsonEnd);
        const jsonStr = jsonBytes.toString('utf8').trim();
        
        let jsonObj = null;
        try {
          jsonObj = JSON.parse(jsonStr);
        } catch (e) {
          // JSON解析失败，保留原始数据
        }
        
        frames.push({
          hex: frameData.toString('hex').match(/.{2}/g).join(':'),
          json: jsonObj,
          raw: frameData
        });
      }
      
      pos += frameLen;
    } else {
      // 跳过非魔术字节（可能是0x00心跳包或其他数据）
      if (buffer[pos] === 0x00 && (pos + 1 >= buffer.length || buffer[pos + 1] !== 0xEB)) {
        frames.push({
          hex: '00',
          json: { _type: 'heartbeat' },
          raw: Buffer.from([0x00])
        });
      }
      pos++;
    }
  }
  
  return frames;
}

// ============================================================
// 从JSON对象构建命令（便捷函数）
// 输入: { id, type, value }
// 输出: Buffer
// ============================================================
function buildCommand(id, type, value) {
  return buildFrame({ id, type, value: value || [] });
}

// ============================================================
// 构建心跳包（audioMeter GET）
// 输出: Buffer
// ============================================================
function buildHeartbeat() {
  return buildCommand('audioMeter', 'get', []);
}

// ============================================================
// 构建初始握手包
// 输出: 包含pcTimeSecs和version的Buffer
// ============================================================
function buildHandshake() {
  const now = Math.floor(Date.now() / 1000);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  
  // pcTimeSecs set
  const timeCmd = buildFrame({
    id: 'pcTimeSecs',
    type: 'set',
    value: [now, timezone]
  });
  
  // version get
  const verCmd = buildCommand('version', 'get', []);
  
  // 拼接两个命令
  return Buffer.concat([timeCmd, verCmd]);
}

// ============================================================
// 工具函数：Buffer转HEX字符串（带冒号分隔）
// ============================================================
function bufferToHex(buffer) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(':');
}

// ============================================================
// 工具函数：HEX字符串转Buffer
// ============================================================
function hexToBuffer(hexStr) {
  const bytes = hexStr.replace(/[^0-9a-fA-F]/g, '').match(/.{2}/g);
  return Buffer.from(bytes.map(b => parseInt(b, 16)));
}

module.exports = {
  crc16Modbus,
  buildFrame,
  buildCommand,
  buildHeartbeat,
  buildHandshake,
  parseFrames,
  bufferToHex,
  hexToBuffer
};
