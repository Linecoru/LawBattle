import {fileURLToPath} from 'node:url';
import {LawClient} from '../backend/law-client.mjs';
const [kind,id]=process.argv.slice(2);
if(!['list','precedent','statute'].includes(kind)||kind!=='list'&&!/^\d+$/.test(id||'')){console.error('사용법: node scripts/law_sample.mjs list | precedent 일련번호 | statute 법령ID');process.exit(1);}
try{
 const client=new LawClient({oc:process.env.LAW_OC,cacheDirectory:fileURLToPath(new URL('../data/runtime/raw/',import.meta.url))});
 const result=kind==='list'?await client.listPrecedents({display:5}):kind==='precedent'?await client.precedent(id):await client.currentStatute(id);
 console.log('샘플 응답을 data/runtime/raw에 저장했습니다. 응답 최상위 필드:',Object.keys(result).join(', '));
}catch(error){console.error(error.message);process.exitCode=1;}
