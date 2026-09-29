import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Store} from '../backend/store.mjs';
import {validateSource} from '../backend/retrieval.mjs';
const input=process.argv[2];
if(!input){console.error('사용법: node scripts/import_sources.mjs 자료.json');process.exit(1);}
const incoming=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(incoming))throw new Error('JSON 배열이 필요합니다.');incoming.forEach(validateSource);
const store=new Store(fileURLToPath(new URL('../data/runtime/corpus/',import.meta.url)));
const documents=new Map(((await store.get('sources'))||[]).map(s=>[s.type+':'+s.id,s]));
for(const source of incoming)documents.set(source.type+':'+source.id,source);
await store.put('sources',[...documents.values()]);console.log(`${incoming.length}개 입력, 전체 ${documents.size}개 저장`);
