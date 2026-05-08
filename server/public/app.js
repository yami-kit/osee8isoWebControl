/**
 * OSEE 导播台 - 前端控制逻辑
 */
(function() {
'use strict';

const S = {
  ws: null, cmds: {}, cmdNames: {}, sources: [],
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

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  S.ws = new WebSocket(`${proto}://${location.host}`);
  S.ws.onopen = () => log('info', '已连接服务器');
  S.ws.onclose = () => { log('warn', '断开，3秒后重连...'); setTimeout(connectWS, 3000); };
  S.ws.onmessage = e => { try { handleMsg(JSON.parse(e.data)); } catch(err){} };
}

function send(msg) { if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(msg)); }

function handleMsg(msg) {
  switch (msg.type) {
    case 'state': handleState(msg.data); break;
    case 'config': handleConfig(msg.data); break;
    case 'tx': handleTx(msg.data); break;
    case 'rx': handleRx(msg.data); break;
    case 'push': handlePush(msg.data); break;
    case 'error': if (msg.data) log('error', msg.data); break;
  }
}

function handleState(d) {
  if (!d.state) return;
  dom.connDot.className = 'dot ' + d.state;
  dom.btnConnect.textContent = d.state === 'connected' ? '断开' : '连接';
  dom.inputIp.disabled = d.state === 'connected';
  if (d.state === 'connected' && d.ip) dom.deviceName.textContent = `${d.ip}:${d.port||19010}`;
  if (d.state === 'disconnected') dom.deviceName.textContent = 'OSEE 导播台';
}

function handleConfig(d) {
  S.cmds = d.commands || {};
  S.cmdNames = d.commandNames || {};
  S.sources = d.sources || [];
  buildSourceButtons();
}

function handleTx(d) {
  if (d.type === 'heartbeat') return;
  const nm = S.cmdNames[d.json?.id] || d.json?.id;
  if (!nm) return;
  const v = d.json?.value?.length ? ` ${JSON.stringify(d.json.value)}` : '';
  log('tx', `→ ${nm}${v}`);
}

function handleRx(d) {
  if (d.type === 'heartbeat') return;
  const nm = S.cmdNames[d.json?.id] || d.json?.id;
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
          const c = S.cmds[b.dataset.cmd];
          b.classList.toggle('active', c?.value?.[0] === d.value[0]);
        });
      } break;
  }
}

function buildSourceButtons() {
  dom.pgmButtons.innerHTML = '';
  dom.pvwButtons.innerHTML = '';
  S.sources.forEach(src => {
    const pb = document.createElement('button');
    pb.className = 'src-btn'; pb.textContent = src.name; pb.dataset.sid = src.id;
    pb.addEventListener('click', () => send({ type:'command', id:'pgmIndex', cmdType:'set', value:[src.id] }));
    dom.pgmButtons.appendChild(pb);
    const vb = document.createElement('button');
    vb.className = 'src-btn'; vb.textContent = src.name; vb.dataset.sid = src.id;
    vb.addEventListener('click', () => send({ type:'command', id:'pvwIndex', cmdType:'set', value:[src.id] }));
    dom.pvwButtons.appendChild(vb);
  });
}

function hlSrc(bus, sid) {
  (bus === 'pgm' ? dom.pgmButtons : dom.pvwButtons)
    ?.querySelectorAll('.src-btn').forEach(b => b.classList.toggle('active', +b.dataset.sid === sid));
}

function updRec() {
  const m = { 0:'待机', 1:'录制中', 2:'停止中' };
  dom.recStatus.textContent = m[S.recStatus] || '未知';
  dom.recStatus.classList.toggle('active', S.recStatus === 1);
  $$('.rec-btn,.rec-iso-btn').forEach(b => b.classList.toggle('active', S.recStatus === 1));
}

function updPlay(pi) {
  const st = S.playStatus[pi], m = { 0:'停止', 1:'播放中', 2:'暂停' };
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
    if (b.classList.contains('live-btn')) b.textContent = S.streamLive[gi] ? 'STOP' : `L${gi+1}`;
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
  e.textContent = `${new Date().toLocaleTimeString('zh-CN',{hour12:false})} ${msg}`;
  dom.logContent.appendChild(e);
  while (dom.logContent.children.length > 200) dom.logContent.removeChild(dom.logContent.firstChild);
  dom.logContent.scrollTop = dom.logContent.scrollHeight;
}

function fmtDur(s) {
  if (typeof s !== 'number') return '';
  return [Math.floor(s/3600),Math.floor((s%3600)/60),Math.floor(s%60)].map(v=>String(v).padStart(2,'0')).join(':');
}

function bindEvents() {
  // 设置面板
  dom.btnSettings.addEventListener('click', () => toggleSet(true));
  dom.btnSettingsClose.addEventListener('click', () => toggleSet(false));
  dom.settingsOverlay.addEventListener('click', () => toggleSet(false));

  // 日志
  dom.btnLog.addEventListener('click', () => { S.logOpen = !S.logOpen; dom.logPanel.classList.toggle('open', S.logOpen); });
  dom.btnLogClose.addEventListener('click', () => { S.logOpen = false; dom.logPanel.classList.remove('open'); });
  dom.btnLogClear.addEventListener('click', () => { dom.logContent.innerHTML = ''; });

  // 连接/断开
  dom.btnConnect.addEventListener('click', () => {
    if (dom.connDot.classList.contains('connected')) {
      send({ type: 'disconnect' });
    } else {
      const ip = dom.inputIp.value.trim();
      if (ip) send({ type: 'connect', ip, port: 19010 });
    }
  });

  // Enter连接
  dom.inputIp.addEventListener('keydown', e => { if (e.key==='Enter') dom.btnConnect.click(); });

  // 命令按钮
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd]');
    if (btn) send({ type:'cmd', name: btn.dataset.cmd });
  });

  // Toggle按钮
  document.addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) send({ type:'cmd', name: btn.classList.contains('active') ? btn.dataset.off : btn.dataset.on });
  });

  // 播放/暂停
  document.addEventListener('click', e => {
    const btn = e.target.closest('.play-toggle');
    if (btn) {
      const pi = +btn.dataset.player;
      send({ type:'command', id:'playPause', cmdType:'set', value: [pi, S.playStatus[pi] === 2 ? 1 : 0] });
    }
  });

  // GO LIVE
  document.addEventListener('click', e => {
    const btn = e.target.closest('.live-btn,.live-btn-settings');
    if (btn) {
      const gi = +btn.dataset.group;
      if (S.streamLive[gi]) {
        send({ type:'command', id:'liveStreamOutputEnable', cmdType:'set', value: [gi, 0] });
        log('info', `推流${gi+1} 停止`);
      } else {
        send({ type:'command', id:'liveStreamOutputEnable', cmdType:'set', value: [gi, 1] });
        setTimeout(() => { send({ type:'command', id:'live', cmdType:'set', value: [] }); log('info', `推流${gi+1} GO LIVE`); }, 300);
      }
    }
  });

  // 推流开关
  document.addEventListener('change', e => {
    const cb = e.target.closest('.stream-enable');
    if (cb) send({ type:'command', id:'liveStreamOutputEnable', cmdType:'set', value:[+cb.dataset.group, cb.checked?1:0] });
  });

  // 推流保存
  document.addEventListener('click', e => {
    const btn = e.target.closest('.stream-save');
    if (btn) {
      const gi = +btn.dataset.group;
      const url = $(`.stream-url[data-group="${gi}"]`)?.value?.trim();
      const key = $(`.stream-key[data-group="${gi}"]`)?.value?.trim();
      if (url) send({ type:'command', id:'liveStreamOutputUrl', cmdType:'set', value:[gi, url] });
      if (key) send({ type:'command', id:'liveStreamOutputKey', cmdType:'set', value:[gi, key] });
      log('info', `推流${gi+1} 配置已保存`);
    }
  });
}

function toggleSet(open) {
  dom.settingsPanel.classList.toggle('open', open);
  dom.settingsOverlay.classList.toggle('open', open);
}

function init() { cacheDom(); bindEvents(); connectWS(); log('info', 'OSEE 导播台控制台已就绪'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
