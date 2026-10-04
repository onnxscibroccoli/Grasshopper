import RFB from './core/rfb.js';
import {textKeys,viewportBox} from './input.mjs';
const $=id=>document.getElementById(id);
let rfb,connected=false;
function layout(){const v=viewportBox(window.visualViewport||{width:innerWidth,height:innerHeight});Object.assign($('view').style,{width:v.width+'px',height:v.height+'px',top:v.top+'px',left:v.left+'px'});}
layout();window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);window.visualViewport?.addEventListener('scroll',layout);
const path=new URLSearchParams(location.search).get('path');
if(!path||!path.startsWith('websockify?token=')){$('status').textContent='Access link required';}else connect();
function connect(){
 connected=false;$('type').disabled=true;
 if(rfb){rfb.disconnect();rfb=null;}
 $('status').textContent='Connecting…';
 const url=new URL(path,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const current=new RFB($('screen'),url.href);rfb=current;
 current.scaleViewport=true;current.resizeSession=false;current.showDotCursor=true;
 current.addEventListener('connect',()=>{if(rfb!==current)return;connected=true;$('type').disabled=false;$('status').textContent='Connected';});
 current.addEventListener('disconnect',()=>{if(rfb!==current)return;connected=false;$('type').disabled=true;$('status').textContent='Viewer disconnected — tap Reconnect';});
 current.addEventListener('securityfailure',()=>{$('status').textContent='Access rejected or expired';});
}
$('reconnect').onclick=connect;
$('fit').onclick=()=>{if(rfb){rfb.scaleViewport=true;rfb.resizeSession=false;}layout();$('menu').open=false;};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('view').requestFullscreen();layout();}catch{$('notice').textContent='Fullscreen unavailable';}};
$('draft').addEventListener('focus',()=>{if(rfb)rfb.focusOnClick=false;});
$('draft').addEventListener('blur',()=>{if(rfb)rfb.focusOnClick=true;});
$('type').onclick=()=>{
 if(!connected)return;
 const text=$('draft').value;if(!text)return;
 let keys;try{keys=textKeys(text);}catch(e){$('notice').textContent=e.message;return;}
 // Never replay uncertain user text after reconnect.
 try{for(const key of keys)rfb.sendKey(key);$('draft').value='';$('draft').blur();$('menu').open=false;$('notice').textContent='Text sent. Confirm it in the remote field.';}
 catch{$('notice').textContent='Delivery uncertain. Check the remote field before trying again.';}
};
document.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{if(connected)rfb.sendKey(Number(b.dataset.key));});
