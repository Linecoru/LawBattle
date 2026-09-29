import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {Store} from './store.mjs';
import {searchSources} from './retrieval.mjs';
import {cases,demoResult,hearing} from '../public/game.js';
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768)throw Object.assign(new Error('BODY_TOO_LARGE'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('INVALID_JSON'),{status:400});}}
export function api(directory){const games=new Store(path.join(directory,'games'));const corpus=new Store(path.join(directory,'corpus'));return async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'ORIGIN_NOT_ALLOWED'});
 if(url.pathname==='/api/health')return json(res,200,{ok:true,mode:'demo',llm:false});
 if(url.pathname==='/api/v1/cases'&&req.method==='GET')return json(res,200,cases);
 if(url.pathname==='/api/v1/sources/search'&&req.method==='POST'){const request=await body(req);if(typeof request.query!=='string'||request.query.length>1000)return json(res,400,{error:'QUERY_INVALID'});if(request.vector&&(!Array.isArray(request.vector)||!request.vector.every(Number.isFinite)||!request.embeddingModel))return json(res,400,{error:'VECTOR_INVALID'});const sources=(await corpus.get('sources'))||[];return json(res,200,{results:searchSources(sources,request),corpusSize:sources.length});}
 if(url.pathname==='/api/v1/games'&&req.method==='POST'){const input=await body(req);if(!cases.some(c=>c.id===input.caseId)||!['prosecution','defense'].includes(input.role))return json(res,400,{error:'INVALID_CASE_OR_ROLE'});const game={id:randomUUID(),caseId:input.caseId,role:input.role,status:'created',createdAt:new Date().toISOString()};await games.put(game.id,game);return json(res,201,game);}
 const match=url.pathname.match(/^\/api\/v1\/games\/([a-f0-9-]{36})(\/argument)?$/);
 if(match){if(req.method==='GET'&&!match[2]){const game=await games.get(match[1]);return json(res,game?200:404,game||{error:'GAME_NOT_FOUND'});}if(req.method==='POST'&&match[2]){const input=await body(req);if(typeof input.argument!=='string'||input.argument.length>500)return json(res,400,{error:'ARGUMENT_INVALID'});return await games.transaction(async()=>{const game=await games.get(match[1]);if(!game)return json(res,404,{error:'GAME_NOT_FOUND'});if(game.status==='completed'){if(game.argument!==input.argument)return json(res,409,{error:'ALREADY_SUBMITTED'});return json(res,200,game);}Object.assign(game,{argument:input.argument,status:'completed',completedAt:new Date().toISOString(),result:demoResult(),hearing:hearing(cases.find(c=>c.id===game.caseId),game.role,input.argument||'제출한 의견이 없습니다.')});await games.put(game.id,game);return json(res,200,game);});}return json(res,405,{error:'METHOD_NOT_ALLOWED'});}
 return json(res,404,{error:'NOT_FOUND'});
 }catch(error){return json(res,error.status||500,{error:error.status?error.message:'REQUEST_FAILED'});}
 };}
