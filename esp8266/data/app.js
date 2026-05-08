(function(){
'use strict';
var SRC=[
  {id:1,n:'IN1'},{id:2,n:'IN2'},{id:3,n:'IN3'},{id:4,n:'IN4'},
  {id:4001,n:'IN5'},{id:4002,n:'IN6'},{id:4003,n:'IN7'},{id:4004,n:'IN8'},
  {id:3010,n:'MP1'},{id:3020,n:'MP2'},{id:5001,n:'M/S'}
];
var CMD={
  pgmIndex:{id:'pgmIndex',t:'set'},pvwIndex:{id:'pvwIndex',t:'set'},
  cutTransition:{id:'cutTransition',t:'set',v:[]},
  recordStart:{id:'recordStart',t:'set',v:[0]},recordStartISO:{id:'recordStart',t:'set',v:[1]},recordStop:{id:'recordStop',t:'set',v:[]},
  liveStreamEnable0On:{id:'liveStreamOutputEnable',t:'set',v:[0,1]},liveStreamEnable0Off:{id:'liveStreamOutputEnable',t:'set',v:[0,0]},
  liveStreamEnable1On:{id:'liveStreamOutputEnable',t:'set',v:[1,1]},liveStreamEnable1Off:{id:'liveStreamOutputEnable',t:'set',v:[1,0]},
  liveStreamEnable2On:{id:'liveStreamOutputEnable',t:'set',v:[2,1]},liveStreamEnable2Off:{id:'liveStreamOutputEnable',t:'set',v:[2,0]},
  liveStreamUrl0:{id:'liveStreamOutputUrl',t:'set'},liveStreamUrl1:{id:'liveStreamOutputUrl',t:'set'},liveStreamUrl2:{id:'liveStreamOutputUrl',t:'set'},
  liveStreamKey0:{id:'liveStreamOutputKey',t:'set'},liveStreamKey1:{id:'liveStreamOutputKey',t:'set'},liveStreamKey2:{id:'liveStreamOutputKey',t:'set'},
  liveGo:{id:'live',t:'set',v:[]}
};
var S={cs:'disconnected',pgm:null,pvw:null,rs:0,sl:[false,false,false],wp:81};
var ws=null,rt=null;
var $=function(s){return document.querySelector(s)};
var $$=function(s){return document.querySelectorAll(s)};
var D={};

function init(){
  D={dot:$('#connDot'),dn:$('#deviceName'),ip:$('#inputIp'),bc:$('#btnConnect'),
     pvw:$('#pvwB'),pgm:$('#pgmB'),rst:$('#recSt'),rdu:$('#recDur'),
     sp:$('#setP'),so:$('#setO'),bsc:$('#btnSC'),bs:$('#btnSet'),
     sd:[$('#sd0'),$('#sd1'),$('#sd2')]};
  bindEvt();
  buildSrc();
  connWS();
}

function connWS(){
  if(ws&&ws.readyState===1)return;
  var u='ws://'+location.hostname+':'+S.wp+'/';
  try{
    ws=new WebSocket(u);
    ws.onclose=function(){ws=null;clearTimeout(rt);rt=setTimeout(connWS,3000);};
    ws.onerror=function(){};
    ws.onmessage=function(e){try{var m=JSON.parse(e.data);onMsg(m);}catch(x){}};
  }catch(e){clearTimeout(rt);rt=setTimeout(connWS,3000);}
}

function snd(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}

function onMsg(m){
  if(!m||!m.type)return;
  if(m.type==='config'){if(m.wsPort)S.wp=m.wsPort;}
  else if(m.type==='state'){
    S.cs=m.state||'disconnected';
    D.dot.className='dot '+(S.cs==='connected'?'on':S.cs==='connecting'?'wait':'off');
    D.bc.textContent=S.cs==='connected'?'断开':'连接';
    D.ip.disabled=S.cs==='connected';
    D.dn.textContent=S.cs==='connected'&&m.ip?m.ip:'OSEE';
  }
  else if(m.type==='push'&&m.data)onData(m.data);
  else if(m.type==='rx'&&m.data)onData(m.data);
}

function onData(d){
  if(!d||!d.id)return;
  var v=d.value;
  if(!v||!v.length)return;
  switch(d.id){
    case 'pgmIndex':case 'pgmTally':S.pgm=v[0];hl('pgm',S.pgm);break;
    case 'pvwIndex':case 'pvwTally':S.pvw=v[0];hl('pvw',S.pvw);break;
    case 'recordStatus':S.rs=v[0];updRec();break;
    case 'recordDuration':D.rdu.textContent=fmtD(v[0]);break;
    case 'liveStreamOutputStatus':if(v.length>=2){S.sl[v[0]]=v[1]>=2;updStr(v[0]);}break;
    case 'liveStreamOutputUrl':if(v.length>=2){var i=$$('.su[data-g="'+v[0]+'"]');if(i.length)i[0].value=v[1]||'';}break;
    case 'liveStreamOutputKey':if(v.length>=2){var i=$$('.sk[data-g="'+v[0]+'"]');if(i.length)i[0].value=v[1]||'';}break;
  }
}

function buildSrc(){
  D.pgm.innerHTML='';D.pvw.innerHTML='';
  SRC.forEach(function(s){
    var p=document.createElement('button');p.className='sb';p.textContent=s.n;p.dataset.sid=s.id;
    p.addEventListener('click',function(){snd({action:'command',id:'pgmIndex',cmdType:'set',value:[s.id]});hl('pgm',s.id);});
    D.pgm.appendChild(p);
    var v=document.createElement('button');v.className='sb';v.textContent=s.n;v.dataset.sid=s.id;
    v.addEventListener('click',function(){snd({action:'command',id:'pvwIndex',cmdType:'set',value:[s.id]});hl('pvw',s.id);});
    D.pvw.appendChild(v);
  });
}

function hl(b,id){
  (b==='pgm'?D.pgm:D.pvw).querySelectorAll('.sb').forEach(function(e){e.classList.toggle('a',+e.dataset.sid===id);});
}

function updRec(){
  var m={0:'待机',1:'录制中',2:'停止中'};
  D.rst.textContent=m[S.rs]||'';
  D.rst.classList.toggle('a',S.rs===1);
  $$('.rec-b,.iso-b').forEach(function(b){b.classList.toggle('a',S.rs===1);});
}

function updStr(g){
  var d=D.sd[g];if(d)d.className='sd '+(S.sl[g]?'on':'off');
  $$('.lb[data-g="'+g+'"],.sl[data-g="'+g+'"]').forEach(function(b){
    b.classList.toggle('a',S.sl[g]);
    if(b.classList.contains('lb'))b.textContent=S.sl[g]?'STOP':'L'+(g+1);
    else b.textContent=S.sl[g]?'STOP':'GO LIVE';
  });
}

function fmtD(s){if(typeof s!=='number')return '';return [Math.floor(s/3600),Math.floor(s%3600/60),Math.floor(s%60)].map(function(v){return String(v).padStart(2,'0');}).join(':');}

function sendCmd(n){var c=CMD[n];if(!c)return;snd({action:'command',id:c.id,cmdType:c.t,value:c.v||[]});}

function bindEvt(){
  D.bs.addEventListener('click',function(){D.sp.classList.add('open');D.so.classList.add('open');});
  D.bsc.addEventListener('click',function(){D.sp.classList.remove('open');D.so.classList.remove('open');});
  D.so.addEventListener('click',function(){D.sp.classList.remove('open');D.so.classList.remove('open');});
  D.bc.addEventListener('click',function(){
    if(S.cs==='connected')snd({action:'disconnect'});
    else{var ip=D.ip.value.trim();if(ip)snd({action:'connect',ip:ip});}
  });
  D.ip.addEventListener('keydown',function(e){if(e.key==='Enter')D.bc.click();});
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-cmd]');
    if(b){sendCmd(b.dataset.cmd);b.classList.add('fl');setTimeout(function(){b.classList.remove('fl');},150);}
  });
  document.addEventListener('click',function(e){
    var b=e.target.closest('.lb,.sl');
    if(b){var g=+b.dataset.g;
      if(S.sl[g])snd({action:'command',id:'liveStreamOutputEnable',cmdType:'set',value:[g,0]});
      else{snd({action:'command',id:'liveStreamOutputEnable',cmdType:'set',value:[g,1]});setTimeout(function(){snd({action:'command',id:'live',cmdType:'set',value:[]});},300);}
    }
  });
  document.addEventListener('change',function(e){var c=e.target.closest('.se');if(c)snd({action:'command',id:'liveStreamOutputEnable',cmdType:'set',value:[+c.dataset.g,c.checked?1:0]});});
  document.addEventListener('click',function(e){
    var b=e.target.closest('.ss');
    if(b){var g=+b.dataset.g;var u=$$('.su[data-g="'+g+'"]');var k=$$('.sk[data-g="'+g+'"]');
      var uv=u.length?u[0].value.trim():'';var kv=k.length?k[0].value.trim():'';
      if(uv)snd({action:'command',id:'liveStreamOutputUrl',cmdType:'set',value:[g,uv]});
      if(kv)snd({action:'command',id:'liveStreamOutputKey',cmdType:'set',value:[g,kv]});
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
