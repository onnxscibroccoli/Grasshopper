import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inputDelta} from '../scripts/android-worker/phone/input.mjs';
test('IME composition updates replace only the changed suffix',()=>{assert.deepEqual(inputDelta('___hel','___hello'),{backspaces:0,keys:[108,111]});assert.deepEqual(inputDelta('___teh','___the'),{backspaces:2,keys:[104,101]});});
test('native backspace and emoji use code points',()=>{assert.deepEqual(inputDelta('___😀','___'),{backspaces:1,keys:[]});});
test('unchanged compositionend does not duplicate input',()=>{assert.deepEqual(inputDelta('___hello','___hello'),{backspaces:0,keys:[]});});
