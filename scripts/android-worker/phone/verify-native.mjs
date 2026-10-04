// Browser regression checks. No text is sent to the remote session.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:393,height:760},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.VIEWER_URL||'http://127.0.0.1:6081/phone.html');
 await page.waitForFunction(()=>document.querySelector('#native-input').value.length===32);
 const keys=await page.evaluate(()=>['Unidentified','Process','a'].map(key=>{
  const e=new KeyboardEvent('keydown',{key,code:key==='a'?'KeyA':'',keyCode:key==='a'?65:229,bubbles:true,cancelable:true,isComposing:key!=='a'});
  document.querySelector('#native-input').dispatchEvent(e);
  return {key,cancelled:e.defaultPrevented};
 }));
 assert.ok(keys.every(e=>!e.cancelled),'Native IME/printable events must retain browser default action');
 for(const viewport of [{width:393,height:760},{width:393,height:340},{width:980,height:720}]){
  await page.setViewportSize(viewport);
  await page.locator('#menu').evaluate(e=>{e.open=true;});
  const geometry=await page.locator('#menu').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,height:visualViewport.height}));
  assert.ok(geometry.bottom<=geometry.height,'Panel must remain inside visual viewport');
  await page.locator('#close').click();
  assert.equal(await page.locator('#menu').evaluate(e=>e.open),false);
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',keys,viewports:3,physicalKeyboardDelivery:'NOT_TESTED'}));
} finally {await browser.close();}
