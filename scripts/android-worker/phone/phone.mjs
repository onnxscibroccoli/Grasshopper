import RFB from './core/rfb.js';
import Keyboard from './core/input/keyboard.js';
import KeyTable from './core/input/keysym.js';

const $=id=>document.getElementById(id);
const input=$('native-input');
let rfb=null,connected=false,keyboardActive=false,touchKeyboard=null;
let composing=false;
const kdiag={focus:0,blur:0,keydown:0,keyup:0,beforeinput:0,input:0,compositionstart:0,compositionupdate:0,compositionend:0};

function status(message){$('status').textContent=message;}
function diagStatus(){if(connected)status(`Connected · KBD f${kdiag.focus} b${kdiag.blur} kd${kdiag.keydown} ku${kdiag.keyup} bi${kdiag.beforeinput} i${kdiag.input} cs${kdiag.compositionstart} ce${kdiag.compositionend}`);}
for(const type of Object.keys(kdiag)) input.addEventListener(type,()=>{kdiag[type]++;if(type==='input'||type==='keydown'||type==='compositionend'||type==='focus')diagStatus();},true);

function layout(){
 const v=window.visualViewport||{width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0};
 Object.assign($('view').style,{width:Math.max(1,v.width)+'px',height:Math.max(1,v.height)+'px',top:(v.offsetTop||0)+'px',left:(v.offsetLeft||0)+'px'});
}
function clearNativeInput(){input.value='';}
function focusNativeKeyboard(){
 if(!connected)return;
 keyboardActive=true;
 if(rfb)rfb.focusOnClick=false;
 input.setAttribute('inputmode','text');
 input.focus({preventScroll:true});
 try{input.setSelectionRange(input.value.length,input.value.length);}catch{}
}
function sendText(text){
 if(!rfb||!connected||!text)return;
 for(const c of Array.from(text)){
  const cp=c.codePointAt(0);
  if(cp===10)rfb.sendKey(KeyTable.XK_Return,'Enter');
  else if(cp===9)rfb.sendKey(KeyTable.XK_Tab,'Tab');
  else rfb.sendKey(cp<=255?cp:0x1000000+cp);
 }
}
function keyEvent(keysym,code,down){
 if(!rfb||!connected)return;
 const printable=keysym>=0x20&&keysym<=0x10ffff&&code!=='Enter'&&code!=='Backspace'&&code!=='Tab';
 if(printable)return;
 rfb.sendKey(keysym,code,down);
}
function inputEvent(event){
 if(!rfb||!connected)return;
 if(composing||event.isComposing)return;
 const type=event.inputType||'';
 if(type==='deleteContentBackward'||type==='deleteWordBackward'||type==='deleteContentForward'||type==='deleteWordForward'){
  rfb.sendKey(type.includes('Forward')?KeyTable.XK_Delete:KeyTable.XK_BackSpace,type.includes('Forward')?'Delete':'Backspace');
 }else if(type==='insertLineBreak'||type==='insertParagraph'){
  rfb.sendKey(KeyTable.XK_Return,'Enter');
 }else if(type==='insertTab'){
  rfb.sendKey(KeyTable.XK_Tab,'Tab');
 }else if(event.data){
  sendText(event.data);
 }else if(input.value){
  sendText(input.value);
 }
 clearNativeInput();
}
function beforeInput(event){
 if(!rfb||!connected)return;
 if(event.inputType==='deleteContentBackward'||event.inputType==='deleteWordBackward'){
  event.preventDefault();
  rfb.sendKey(KeyTable.XK_BackSpace,'Backspace');
  clearNativeInput();
 }else if(event.inputType==='deleteContentForward'||event.inputType==='deleteWordForward'){
  event.preventDefault();
  rfb.sendKey(KeyTable.XK_Delete,'Delete');
  clearNativeInput();
 }else if(event.inputType==='insertLineBreak'||event.inputType==='insertParagraph'){
  event.preventDefault();
  rfb.sendKey(KeyTable.XK_Return,'Enter');
  clearNativeInput();
 }else if(event.inputType==='insertTab'){
  event.preventDefault();
  rfb.sendKey(KeyTable.XK_Tab,'Tab');
  clearNativeInput();
 }
}
input.addEventListener('beforeinput',beforeInput,true);
input.addEventListener('input',inputEvent,true);
input.addEventListener('compositionstart',()=>{composing=true;},true);
input.addEventListener('compositionend',event=>{
 composing=false;
 if(event.data)sendText(event.data);
 clearNativeInput();
},true);

layout();
window.addEventListener('resize',layout);
window.visualViewport?.addEventListener('resize',layout);
window.visualViewport?.addEventListener('scroll',layout);

$('keyboard').onclick=()=>{focusNativeKeyboard();$('toolbar').classList.add('active');};
$('keyboard-close').onclick=()=>{keyboardActive=false;input.blur();if(rfb)rfb.focusOnClick=true;};
$('fit').onclick=()=>{if(rfb){rfb.scaleViewport=true;rfb.resizeSession=false;}layout();};
$('reconnect').onclick=()=>connect();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('view').requestFullscreen();layout();}catch{status('Fullscreen unavailable');}};
$('ctrl-alt-del').onclick=()=>{if(connected)rfb.sendCtrlAltDel();};
$('menu').onclick=event=>{if(event.target===$('menu'))$('toolbar').classList.toggle('active');};

const path=new URLSearchParams(location.search).get('path');
if(!path||!/^websockify\?token=[a-f0-9]+$/.test(path)){status('Access link required');$('toolbar').classList.add('active');}
else connect();

function connect(){
 connected=false;keyboardActive=false;composing=false;
 if(touchKeyboard){touchKeyboard.ungrab();touchKeyboard=null;}
 input.blur();clearNativeInput();
 if(rfb){rfb.disconnect();rfb=null;}
 status('Connecting…');
 const url=new URL(path,location.href);
 url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const current=new RFB($('screen'),url.href);
 rfb=current;current.scaleViewport=true;current.resizeSession=false;current.showDotCursor=true;current.focusOnClick=true;
 touchKeyboard=new Keyboard(input);touchKeyboard.onkeyevent=keyEvent;touchKeyboard.grab();
 current.addEventListener('connect',()=>{if(rfb!==current)return;connected=true;status('Connected · tap Keyboard');});
 current.addEventListener('disconnect',()=>{if(rfb!==current)return;connected=false;keyboardActive=false;input.blur();status('Disconnected · tap reconnect');$('toolbar').classList.add('active');});
 current.addEventListener('securityfailure',()=>{status('Access rejected or expired');$('toolbar').classList.add('active');});
}
