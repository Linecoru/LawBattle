import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,remaining,hearing,demoResult} from '../public/game.js';
test('deadline remains correct across suspended tabs',()=>{assert.equal(remaining(10000,8500),2);assert.equal(remaining(10000,12000),0);});
test('prosecution speaks first for either player role',()=>{for(const role of ['prosecution','defense']){const lines=hearing(cases[0],role,'사용자 원문');assert.equal(lines[1].speaker,'prosecution');assert.equal(lines[3].speaker,'defense');assert.equal(lines[role==='prosecution'?1:3].text,'사용자 원문');}});
test('demo never fabricates a judgment or citations',()=>{assert.equal(demoResult().winner,'DRAW');assert.deepEqual(demoResult().sources,[]);});
