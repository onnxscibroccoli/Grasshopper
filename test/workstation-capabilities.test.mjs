import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyProbe,recommendation} from '../scripts/workstation-capabilities.mjs';
test('empty success never proves a capability',()=>assert.equal(classifyProbe({status:0,stdout:''}),'not_proven'));
test('missing and failed tools stay distinct',()=>{assert.equal(classifyProbe({error:{code:'ENOENT'}}),'unavailable');assert.equal(classifyProbe({status:1,stdout:'installed'}),'probe_failed');assert.equal(classifyProbe({signal:'SIGTERM',stdout:'partial'}),'probe_failed');});
test('browser fallback requires functional evidence and never replays observations',()=>{assert.equal(recommendation([{name:'browser.dom',status:'available'}]).action,'repair_browser_dependency_then_reprobe');assert.deepEqual(recommendation([{name:'browser.dom',status:'verified'}]),{action:'use_verified_browser',replayObservedEvents:false});});
