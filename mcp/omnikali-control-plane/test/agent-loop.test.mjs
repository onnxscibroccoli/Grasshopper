import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHumanBoundary, parsePlannerResponse, chooseNode, verifyExpected } from '../src/agent-loop.mjs';

const nodes = [
  { index:0, text:'Send', desc:'', resourceId:'com.example:id/send', className:'android.widget.Button', packageName:'ai.example', clickable:true, enabled:true, bounds:{cx:60,cy:70} },
  { index:1, text:'Email', desc:'', resourceId:'com.example:id/email', className:'android.widget.EditText', packageName:'ai.example', clickable:true, enabled:true, bounds:{cx:150,cy:230} },
];

test('planner JSON is parsed from fenced output', () => {
  const p = parsePlannerResponse('```json\n{"status":"CONTINUE","action":{"type":"tap","selector":{"resourceId":"com.example:id/send"}},"expected":{"text":"Done"}}\n```');
  assert.equal(p.action.type, 'tap');
});

test('selector resolution is deterministic and rejects ambiguity', () => {
  assert.equal(chooseNode(nodes,{resourceId:'com.example:id/send'}).index,0);
  assert.throws(() => chooseNode([...nodes,{...nodes[0],index:2}],{text:'Send'}), /SELECTOR_AMBIGUOUS/);
});

test('verification reports expected selector state', () => {
  assert.equal(verifyExpected(nodes,{text:'Send'}).verified,true);
  assert.equal(verifyExpected(nodes,{text:'Missing'}).verified,false);
});

test('human boundary detection is fail-closed', () => {
  assert.equal(detectHumanBoundary([{index:1,text:'Verify you are human',desc:'',resourceId:''}]).length,1);
  assert.equal(detectHumanBoundary([{index:1,text:'Continue',desc:'',resourceId:''}]).length,0);
});