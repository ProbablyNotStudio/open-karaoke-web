import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBackground} from '../js/backgrounds.js';
test('random backgrounds avoid immediate repeats while manual and empty selections stay predictable',()=>{
 const items=[{id:'a'},{id:'b'},{id:'c'}];
 assert.equal(chooseBackground(items,'none','a'),null);
 assert.equal(chooseBackground(items,'b','a'),items[1]);
 assert.equal(chooseBackground(items,'missing','a'),null);
 assert.equal(chooseBackground(items,'random','a',()=>0),items[1]);
 assert.equal(chooseBackground(items,'random','a',()=>.99),items[2]);
 assert.equal(chooseBackground([items[0]],'random','a'),items[0]);
 assert.equal(chooseBackground([],'random',null),null);
});
