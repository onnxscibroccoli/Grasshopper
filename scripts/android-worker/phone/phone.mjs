import RFB from './core/rfb.js';
import Keyboard from './core/input/keyboard.js';
import {inputDelta,viewportBox} from './input.mjs?v=2';
const $=id=>document.getElementById(id),input=$('native-input');
let rfb,connected=false,last='',composing=false,keyboardActive=false;
function reset(){input.value='_'.repeat(32);last=input.value;input.setSelectionRange(last.length,last.length);}
function layout(){const v=viewportBox(window.visualViewport||{width:innerWidth,height:innerHeight});Object.assign($('view').style,{width:v.width+'px',height:v.height+'px',top:v.top+'px',left:v.left+'px'});}
layout();window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);window.visualViewport?.addEventListener('scroll',layout);
const keyboard=new Keyboard(input);
keyboard.onkeyevent=(key,code,down)=>{if(connected)rfb.sendKey(key,code,down);};keyboard.grab();
reset();
input.addEventListener('compositionstart',()=>{composing=true;});
input.addEventListener('compositionend',()=>{composing=false;forward();});
function forward(){
 if(!connected){reset();return;}
 try{const delta=inputDelta(last,input.value);for(let i=0;i<delta.backspaces;i++)rfb.sendKey(0xff08);for(const key of delta.keys)rfb.sendKey(key);last=input.value;
 if(!composing&&(last.length<1||last.length>2048))reset();
 }catch(e){$('notice').textContent=e.message;reset();}
}
input.addEventListener('input',forward);
input.addEventListener('focus',()=>{keyboardActive=true;if(rfb)rfb.focusOnClick=false;});
input.addEventListener('blur',()=>{keyboardActive=false;if(rfb)rfb.focusOnClick=true;});
$('screen').addEventListener('mousedown',event=>{if(keyboardActive)event.preventDefault();},true);
$('screen').addEventListener('touchend',()=>{if(keyboardActive)input.focus({preventScroll:true});});
$('keyboard').onclick=()=>{if(!connected)return;$('menu').open=false;reset();input.focus({preventScroll:true});};
const path=new URLSearchParams(location.search).get('path');
if(!path||!/^websockify\?token=[a-f0-9]+$/.test(path)){$('status').textContent='Access link required';$('menu').open=true;}else connect();
function connect(){
 connected=false;$('keyboard').disabled=true;input.blur();reset();
 if(rfb){rfb.disconnect();rfb=null;}
 $('status').textContent='Connecting…';
 const url=new URL(path,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const current=new RFB($('screen'),url.href);rfb=current;
 current.scaleViewport=true;current.resizeSession=false;current.showDotCursor=true;
 current.addEventListener('connect',()=>{if(rfb!==current)return;connected=true;$('keyboard').disabled=false;$('status').textContent='Connected';});
 current.addEventListener('disconnect',()=>{if(rfb!==current)return;connected=false;$('keyboard').disabled=true;input.blur();reset();$('status').textContent='Viewer disconnected — tap Reconnect';$('menu').open=true;});
 current.addEventListener('securityfailure',()=>{$('status').textContent='Access rejected or expired';$('menu').open=true;});
}
$('reconnect').onclick=connect;
$('fit').onclick=()=>{if(rfb){rfb.scaleViewport=true;rfb.resizeSession=false;}layout();$('menu').open=false;};
$('close').onclick=()=>{$('menu').open=false;};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('view').requestFullscreen();layout();$('menu').open=false;}catch{$('notice').textContent='Fullscreen unavailable';}};
document.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{if(connected)rfb.sendKey(Number(b.dataset.key));});
