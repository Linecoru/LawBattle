import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {api} from '../backend/api.mjs';
import {searchSources,validateSource} from '../backend/retrieval.mjs';
test('game persistence, validation and repeated submissions',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'little-court-test-'));const server=http.createServer(api(directory));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const post=(url,data)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 try{assert.equal((await post('/api/v1/games',{caseId:'missing',role:'defense'})).status,400);const created=await post('/api/v1/games',{caseId:'push',role:'defense'});assert.equal(created.status,201);const game=await created.json();const route=`/api/v1/games/${game.id}/argument`;assert.equal((await post(route,{argument:'테스트 의견'})).status,200);assert.equal((await post(route,{argument:'테스트 의견'})).status,200);assert.equal((await post(route,{argument:'변경된 의견'})).status,409);const saved=await(await fetch(base+`/api/v1/games/${game.id}`)).json();assert.equal(saved.argument,'테스트 의견');assert.equal(saved.result.winner,'DRAW');}finally{await new Promise(r=>server.close(r));}
});
test('retrieval separates types and embedding models',()=>{const sources=[{id:'1',type:'statute',title:'밀침',text:'밀침과 부상',url:'https://www.law.go.kr',vector:[1,0],embeddingModel:'test'},{id:'2',type:'precedent',title:'사건',text:'부상',url:'https://www.law.go.kr',vector:[0,1],embeddingModel:'other'}];sources.forEach(validateSource);assert.equal(searchSources(sources,{query:'부상',type:'statute'}).length,1);assert.equal(searchSources(sources,{query:'',vector:[1,0],embeddingModel:'test'})[0].id,'1');assert.equal(searchSources([],{query:'부상'}).length,0);});
