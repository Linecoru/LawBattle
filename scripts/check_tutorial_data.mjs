import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../data/tutorial/',import.meta.url));
async function jsonl(name){return (await readFile(root+name,'utf8')).split(/\r?\n/).filter(Boolean).map((line,index)=>{try{return JSON.parse(line);}catch(error){throw new Error(`${name}:${index+1} JSON 오류: ${error.message}`);}});}
const documents=await jsonl('raw_documents.jsonl');const queries=await jsonl('gold_queries.jsonl');
const ids=new Set();for(const document of documents){if(ids.has(document.id))throw new Error(`중복 문서 ID: ${document.id}`);ids.add(document.id);if(!['statute','precedent'].includes(document.document_type))throw new Error(`잘못된 문서 유형: ${document.id}`);if(document.metadata?.fictional!==true)throw new Error(`가상자료 표시 누락: ${document.id}`);if(!Array.isArray(document.sections)||!document.sections.length)throw new Error(`section 없음: ${document.id}`);}
const queryIds=new Set();for(const query of queries){if(queryIds.has(query.query_id))throw new Error(`중복 질의 ID: ${query.query_id}`);queryIds.add(query.query_id);for(const id of [...Object.keys(query.relevance||{}),...(query.hard_negative_ids||[])])if(!ids.has(id))throw new Error(`${query.query_id}가 없는 문서를 참조: ${id}`);}
console.log(`실습 데이터 OK: 문서 ${documents.length}건, 질의 ${queries.length}건, 관련성 판정 ${queries.reduce((n,q)=>n+Object.keys(q.relevance).length,0)}건`);
