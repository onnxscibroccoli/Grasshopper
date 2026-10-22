import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUiXml, matchNodes } from '../src/android-ui.mjs';
const xml = '<?xml version="1.0"?><hierarchy><node text="Send" content-desc="Send message" resource-id="com.example:id/send" class="android.widget.Button" package="ai.example" clickable="true" enabled="true" bounds="[10,20][110,120]"/><node text="Hello" content-desc="" resource-id="com.example:id/edit" class="android.widget.EditText" package="ai.example" clickable="true" enabled="true" bounds="[0,200][300,260]"/></hierarchy>';
test('parses semantic UI nodes and bounds', () => { const n=parseUiXml(xml); assert.equal(n.length,2); assert.deepEqual(n[0].bounds,{x1:10,y1:20,x2:110,y2:120,cx:60,cy:70}); });
test('matches by text and resource id', () => { const n=parseUiXml(xml); assert.equal(matchNodes(n,{text:'send'}).length,1); assert.equal(matchNodes(n,{resourceId:'com.example:id/edit'}).length,1); });
