/**
 * OSEE 导播台 - 配置文件
 * 
 * ★★★ 用户扩展区 ★★★
 * 修改本文件即可添加新功能按钮、更改设备参数
 */

// ============================================================
// 设备连接配置
// ============================================================
const device = {
  defaultIp: '192.168.0.140',
  port: 19010,
  heartbeatInterval: 500,
  scanTimeout: 3000,
  scanConcurrency: 20,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  connectTimeout: 5000,
};

// ============================================================
// Web服务器配置
// ============================================================
const server = {
  port: 3000,
  autoOpenBrowser: false,
};

// ============================================================
// 通道源码映射表
// ============================================================
const sources = [
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
];

// ============================================================
// 命令定义库
// ============================================================
const commands = {
  // ---- 通道切换 ----
  pgmIndex: { id: 'pgmIndex', type: 'set', label: 'PGM切换' },
  pvwIndex: { id: 'pvwIndex', type: 'set', label: 'PVW切换' },

  // ---- 转场 ----
  cutTransition:     { id: 'cutTransition',     type: 'set', value: [], label: 'CUT' },
  autoTransition:    { id: 'autoTransition',     type: 'set', value: [], label: 'AUTO' },
  transitionStyleMix:  { id: 'transitionStyle', type: 'set', value: ['Mix'],  label: 'MIX' },
  transitionStyleDip:  { id: 'transitionStyle', type: 'set', value: ['Dip'],  label: 'DIP' },
  transitionStyleWipe: { id: 'transitionStyle', type: 'set', value: ['Wipe'], label: 'WIPE' },

  // ---- Next Transition ----
  nextTransitionBG:    { id: 'nextTransition', type: 'set', value: ['Background'],       label: 'BG' },
  nextTransitionBGKey: { id: 'nextTransition', type: 'set', value: ['Background', 'Key'], label: 'BG+KEY' },

  // ---- Key / DSK On Air ----
  keyOnAir0On:  { id: 'keyOnAir', type: 'set', value: [0, 1], label: 'KEY ON' },
  keyOnAir0Off: { id: 'keyOnAir', type: 'set', value: [0, 0], label: 'KEY OFF' },
  dsk1OnAirOn:  { id: 'dskOnAir', type: 'set', value: [0, 1], label: 'DSK1 ON' },
  dsk1OnAirOff: { id: 'dskOnAir', type: 'set', value: [0, 0], label: 'DSK1 OFF' },
  dsk2OnAirOn:  { id: 'dskOnAir', type: 'set', value: [1, 1], label: 'DSK2 ON' },
  dsk2OnAirOff: { id: 'dskOnAir', type: 'set', value: [1, 0], label: 'DSK2 OFF' },

  // ---- Key / DSK Enable ----
  keyEnable0On:  { id: 'keyEnable', type: 'set', value: [0, 1], label: 'KEY EN' },
  keyEnable0Off: { id: 'keyEnable', type: 'set', value: [0, 0], label: 'KEY DIS' },
  dskEnable0On:  { id: 'dskEnable', type: 'set', value: [0, 1], label: 'DSK1 EN' },
  dskEnable0Off: { id: 'dskEnable', type: 'set', value: [0, 0], label: 'DSK1 DIS' },
  dskEnable1On:  { id: 'dskEnable', type: 'set', value: [1, 1], label: 'DSK2 EN' },
  dskEnable1Off: { id: 'dskEnable', type: 'set', value: [1, 0], label: 'DSK2 DIS' },

  // ---- 录制 ----
  recordStart:    { id: 'recordStart', type: 'set', value: [0], label: 'REC' },
  recordStartISO: { id: 'recordStart', type: 'set', value: [1], label: 'ISO REC' },
  recordStop:     { id: 'recordStop',  type: 'set', value: [],  label: 'STOP REC' },

  // ---- FTB ----
  ftb: { id: 'ftb', type: 'set', value: [], label: 'FTB' },

  // ---- 媒体播放器 (playPause是切换模式: value[1]=1表示切换) ----
  playToggle0: { id: 'playPause', type: 'set', value: [0, 1], label: 'P1 切换播放/暂停' },
  playToggle1: { id: 'playPause', type: 'set', value: [1, 1], label: 'P2 切换播放/暂停' },
  playPrev0:   { id: 'playPrev',  type: 'set', value: [0], label: 'P1 上一个' },
  playNext0:   { id: 'playNext',  type: 'set', value: [0], label: 'P1 下一个' },
  playPrev1:   { id: 'playPrev',  type: 'set', value: [1], label: 'P2 上一个' },
  playNext1:   { id: 'playNext',  type: 'set', value: [1], label: 'P2 下一个' },
  playOpen:    { id: 'playOpen',  type: 'set', label: '打开文件播放' },
  playGroups:  { id: 'playGroups', type: 'get', value: [0], label: '获取播放组' },
  playCount:   { id: 'playCount',  type: 'get', value: [],  label: '获取文件数' },
  playFileName:{ id: 'playFileName', type: 'get', label: '获取文件名' },
  playStatus:  { id: 'playStatus',  type: 'get', label: '播放状态' },
  playbackMode:{ id: 'playbackMode', type: 'set', label: '播放模式' },

  // ---- 推流 (3组: 0, 1, 2) ----
  liveStreamEnable0On:  { id: 'liveStreamOutputEnable', type: 'set', value: [0, 1], label: '推流1 启用' },
  liveStreamEnable0Off: { id: 'liveStreamOutputEnable', type: 'set', value: [0, 0], label: '推流1 禁用' },
  liveStreamEnable1On:  { id: 'liveStreamOutputEnable', type: 'set', value: [1, 1], label: '推流2 启用' },
  liveStreamEnable1Off: { id: 'liveStreamOutputEnable', type: 'set', value: [1, 0], label: '推流2 禁用' },
  liveStreamEnable2On:  { id: 'liveStreamOutputEnable', type: 'set', value: [2, 1], label: '推流3 启用' },
  liveStreamEnable2Off: { id: 'liveStreamOutputEnable', type: 'set', value: [2, 0], label: '推流3 禁用' },
  liveStreamUrl0: { id: 'liveStreamOutputUrl', type: 'set', label: '推流1 URL' },
  liveStreamUrl1: { id: 'liveStreamOutputUrl', type: 'set', label: '推流2 URL' },
  liveStreamUrl2: { id: 'liveStreamOutputUrl', type: 'set', label: '推流3 URL' },
  liveStreamKey0: { id: 'liveStreamOutputKey', type: 'set', label: '推流1 Key' },
  liveStreamKey1: { id: 'liveStreamOutputKey', type: 'set', label: '推流2 Key' },
  liveStreamKey2: { id: 'liveStreamOutputKey', type: 'set', label: '推流3 Key' },
  liveGo:    { id: 'live', type: 'set', value: [], label: 'GO LIVE' },
  liveStop0: { id: 'liveStreamOutputEnable', type: 'set', value: [0, 0], label: '停止推流1' },
  liveStop1: { id: 'liveStreamOutputEnable', type: 'set', value: [1, 0], label: '停止推流2' },
  liveStop2: { id: 'liveStreamOutputEnable', type: 'set', value: [2, 0], label: '停止推流3' },

  // ---- 图片上传 ----
  stillBegin: { id: 'stillBegin', type: 'set', label: '上传图片' },
  still:      { id: 'still',      type: 'get', label: '查询图片' },

  // ---- 查询 ----
  version:    { id: 'version',    type: 'get', value: [], label: '版本' },
  buildInfo:  { id: 'buildInfo',  type: 'get', value: [], label: '构建信息' },
  deviceId:   { id: 'deviceId',   type: 'get', value: [], label: '设备ID' },
  deviceType: { id: 'deviceType', type: 'get', value: [], label: '设备类型' },
  deviceName: { id: 'deviceName', type: 'get', value: [], label: '设备名称' },
  shortName:  { id: 'shortName',  type: 'get', label: '短名称' },
  audioMeter: { id: 'audioMeter', type: 'get', value: [], label: '音频电平' },
  pgmTally:   { id: 'pgmTally',   type: 'get', value: [], label: 'PGM Tally' },
  pvwTally:   { id: 'pvwTally',   type: 'get', value: [], label: 'PVW Tally' },
};

// ============================================================
// 握手序列
// ============================================================
const handshakeSequence = [
  'version', 'buildInfo', 'deviceId', 'deviceType', 'deviceName',
];

// ============================================================
// 状态订阅
// ============================================================
const statusQueries = [
  'pgmTally', 'pvwTally', 'recordStatus', 'playStatus',
  'liveStreamOutputStatus', 'transitionStyle',
];

// ============================================================
// 设备下发消息中需要转发到前端的事件
// ============================================================
const pushEvents = [
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
];

// ============================================================
// 命令中文映射表（用于日志显示）
// ============================================================
const commandNames = {
  pgmIndex: 'PGM切换',
  pvwIndex: 'PVW切换',
  pgmTally: 'PGM Tally',
  pvwTally: 'PVW Tally',
  cutTransition: '硬切',
  autoTransition: '自动转场',
  transitionStyle: '转场样式',
  transitionStatus: '转场状态',
  nextTransition: '下一转场',
  previewTransition: '预览转场',
  keyOnAir: 'Key上线',
  keyEnable: 'Key启用',
  dskOnAir: 'DSK上线',
  dskEnable: 'DSK启用',
  recordStart: '开始录制',
  recordStop: '停止录制',
  recordStatus: '录制状态',
  recordDuration: '录制时长',
  recordFree: '录制空间',
  ftb: '黑屏',
  ftbStatus: '黑屏状态',
  playPause: '播放/暂停',
  playPrev: '上一个',
  playNext: '下一个',
  playOpen: '打开文件',
  playGroups: '播放组',
  playCount: '文件数',
  playFileName: '文件名',
  playStatus: '播放状态',
  playProgress: '播放进度',
  playbackMode: '播放模式',
  playbackCutLogic: '播放切逻辑',
  liveStreamOutputEnable: '推流开关',
  liveStreamOutputUrl: '推流URL',
  liveStreamOutputKey: '推流Key',
  liveStreamOutputServiceName: '推流服务名',
  liveStreamOutputStatus: '推流状态',
  liveStreamOutputBitrate: '推流码率',
  live: '开始推流',
  stillBegin: '上传图片',
  stillDataProgress: '上传进度',
  still: '图片',
  stillEnd: '上传完成',
  audioMeter: '音频电平',
  version: '版本',
  buildInfo: '构建信息',
  deviceId: '设备ID',
  deviceType: '设备类型',
  deviceName: '设备名称',
  shortName: '短名称',
  pcTimeSecs: '时间同步',
  ndiInputSearch: 'NDI搜索',
  buildInfo: '构建信息',
};

module.exports = {
  device, server, sources, commands,
  handshakeSequence, statusQueries, pushEvents, commandNames,
};
