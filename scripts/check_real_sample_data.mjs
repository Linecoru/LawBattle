import {readFile} from 'node:fs/promises';
const readJsonl=async path=>(await readFile(path,'utf8')).split(/\r?\n/).filter(Boolean).map((line,index)=>{try{return JSON.parse(line);}catch{throw new Error(`${path}:${index+1} JSON 오류`);}});
const documents=await readJsonl(new URL('../data/real_sample/raw_documents.jsonl',import.meta.url));
const queries=await readJsonl(new URL('../data/real_sample/gold_queries.jsonl',import.meta.url));
const ids=new Set();
for(const document of documents){
 if(ids.has(document.id))throw new Error(`중복 문서 ID: ${document.id}`);
 ids.add(document.id);
 if(document.metadata?.fictional!==false)throw new Error(`실제자료 표시 오류: ${document.id}`);
 if(document.metadata?.collection_method!=='official_api')throw new Error(`API 수집 표시 누락: ${document.id}`);
 if(!Array.isArray(document.sections)||!document.sections.length)throw new Error(`section 없음: ${document.id}`);
 const url=new URL(document.source?.url);
 if(!['law.go.kr','www.law.go.kr'].includes(url.hostname))throw new Error(`공식 URL 오류: ${document.id}`);
}
let judgments=0;
for(const query of queries){
 for(const id of [...Object.keys(query.relevance||{}),...(query.hard_negative_ids||[])])if(!ids.has(id))throw new Error(`${query.query_id}의 알 수 없는 문서 ID: ${id}`);
 judgments+=Object.keys(query.relevance||{}).length;
}
console.log(`실제 샘플 OK: 문서 ${documents.length}건, 질의 ${queries.length}건, 관련성 판정 ${judgments}건`);
