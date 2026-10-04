import RFB from './core/rfb.js';
import * as KeyboardUtil from './core/input/util.js';
import {textKeys,viewportBox} from './input.mjs?v=3';

const $=id=>document.getElementById(id);
const input=$('native-input');
let rfb=null,connected=false,keyboardActive=false,composing=false,suppressInput=false;
const held=new Map();

function status(message){$('status').textContent=message;}
function layout(){
 const v=viewportBox(window.visualViewport||{width:innerWidth,height:innerHeight});
 Object.assign($('view').style,{width:v.width+'px',height:v.height+'px',top:v.top+'px',left:v.left+'px'});
}
function clearNativeBuffer(){input.value='';input.setSelectionRange(0,0);}
function focusNativeKeyboard(){
 if(!connected)return;
 keyboardActive=true;
 if(rfb)rfb.focusOnClick=false;
 input.focus({preventScroll:true});
 try{input.setSelectionRange(input.value.length,input.value.length);}catch{}
}
function releaseHeld(){
 for(const [code,key] of held){if(connected)rfb.sendKey(key,code,false);}
 held.clear();
}

layout();
window.addEventListener('resize',layout);
window.visualViewport?.addEventListener('resize',layout);
window.visualViewport?.addEventListener('scroll',layout);

// Native mobile IMEs do not reliably produce useful keydown events. The
// editable proxy is therefore the source of truth for text input. beforeinput
// identifies deletion/line-break semantics; input handles browser/IME changes
// that do not expose a cancelable beforeinput event. Composition is committed
// once, on compositionend, so IME candidate updates are never replayed.
input.addEventListener('keydown',event=>{
 if(event.isComposing||event.keyCode===229||event.key==='Process'||event.key==='Unidentified')return;
 const modified=event.ctrlKey||event.altKey||event.metaKey;
 const printable=!modified && Array.from(event.key).length===1;
 const browserTextKey=printable||event.key==='Backspace'||event.key==='Enter';
 if(browserTextKey)return;
 const key=KeyboardUtil.getKeysym(event);
 if(!key||!connected)return;
 event.preventDefault();
 rfb.sendKey(key,event.code,true);
 held.set(event.code,key);
});
input.addEventListener('keyup',event=>{
 const key=held.get(event.code);
 if(!key)return;
 event.preventDefault();
 if(connected)rfb.sendKey(key,event.code,false);
 held.delete(event.code);
});
input.addEventListener('blur',releaseHeld);

input.addEventListener('compositionstart',()=>{composing=true;});
input.addEventListener('compositionend',event=>{
 composing=false;
 if(!connected){clearNativeBuffer();return;}
 const committed=event.data || input.value;
 suppressInput=true;
 clearNativeBuffer();
 if(committed)for(const key of textKeys(committed))rfb.sendKey(key);
 queueMicrotask(()=>{suppressInput=false;});
});

input.addEventListener('beforeinput',event=>{
 if(!connected||composing||event.isComposing)return;
 const type=event.inputType;
 if(type==='deleteContentBackward'){
  event.preventDefault();
  rfb.sendKey(0xff08);
  clearNativeBuffer();
  return;
 }
 if(type==='deleteContentForward'){
  event.preventDefault();
  rfb.sendKey(0xffff);
  clearNativeBuffer();
  return;
 }
 if(type==='insertLineBreak'){
  event.preventDefault();
  rfb.sendKey(0xff0d);
  clearNativeBuffer();
  return;
 }
 if(type==='insertText' || type==='insertReplacementText' || type==='insertFromPaste'){
  // Let the browser/IME update the editable control. The input event below
  // performs the actual transmission so non-cancelable mobile IME paths work.
 }
});

input.addEventListener('input',event=>{
 if(suppressInput||!connected)return;
 if(composing||event.isComposing)return;
 const value=input.value;
 if(!value)return;
 try{
  for(const key of textKeys(value))rfb.sendKey(key);
 }catch(error){status(error.message);}
 clearNativeBuffer();
});

$('screen').addEventListener('mousedown',event=>{if(keyboardActive)event.preventDefault();},true);
$('screen').addEventListener('touchend',()=>{if(keyboardActive)focusNativeKeyboard();});
$('keyboard').onclick=()=>{focusNativeKeyboard();$('toolbar').classList.add('active');};
$('keyboard-close').onclick=()=>{
 keyboardActive=false;
 clearNativeBuffer();
 input.blur();
 if(rfb)rfb.focusOnClick=true;
};
$('fit').onclick=()=>{if(rfb){rfb.scaleViewport=true;rfb.resizeSession=false;}layout();};
$('reconnect').onclick=()=>connect();
$('fullscreen').onclick=async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await $('view').requestFullscreen();
  layout();
 }catch{status('Fullscreen unavailable');}
};
$('ctrl-alt-del').onclick=()=>{if(connected)rfb.sendCtrlAltDel();};
$('menu').onclick=event=>{if(event.target===$('menu'))$('toolbar').classList.toggle('active');};

const path=new URLSearchParams(location.search).get('path');
if(!path||!/^websockify\?token=[a-f0-9]+$/.test(path)){
 status('Access link required');
 $('toolbar').classList.add('active');
}else connect();

function connect(){
 connected=false;
 keyboardActive=false;
 releaseHeld();
 input.blur();
 clearNativeBuffer();
 if(rfb){rfb.disconnect();rfb=null;}
 status('Connecting…');
 const url=new URL(path,location.href);
 url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const current=new RFB($('screen'),url.href);
 rfb=current;
 current.scaleViewport=true;
 current.resizeSession=false;
 current.showDotCursor=true;
 current.focusOnClick=true;
 current.addEventListener('connect',()=>{
  if(rfb!==current)return;
  connected=true;
  status('Connected');
 });
 current.addEventListener('disconnect',()=>{
  if(rfb!==current)return;
  connected=false;
  keyboardActive=false;
  releaseHeld();
  clearNativeBuffer();
  status('Disconnected · tap reconnect');
  $('toolbar').classList.add('active');
 });
 current.addEventListener('securityfailure',()=>{
  status('Access rejected or expired');
  $('toolbar').classList.add('active');
 });
}
