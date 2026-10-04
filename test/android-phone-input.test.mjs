import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textKeys, viewportBox} from '../scripts/android-worker/phone/input.mjs';
test('Unicode text preserves code points without splitting emoji',()=>{assert.deepEqual(textKeys('Aé😀\n'),[65,233,0x101f600,0xff0d]);});
test('keyboard viewport fits controls without negative space',()=>{assert.deepEqual(viewportBox({width:360,height:320,offsetTop:200,offsetLeft:0}),{width:360,height:320,top:200,left:0});});
test('text cap rejects oversized input before transmission',()=>{assert.throws(()=>textKeys('a'.repeat(4097)),/4096/);});
