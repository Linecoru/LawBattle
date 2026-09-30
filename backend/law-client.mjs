import {createHash} from 'node:crypto';
import {Store} from './store.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Deliberately sequential; 1 request/sec is a local cap, not a provider quota.
export class LawClient {
 constructor({oc,cacheDirectory,fetcher=fetch}){if(!oc)throw new Error('LAW_OC_REQUIRED');this.oc=oc;this.ocFingerprint=createHash('sha256').update(oc).digest('hex').slice(0,16);this.cache=new Store(cacheDirectory);this.fetcher=fetcher;this.queue=Promise.resolve();this.last=0;}
 request(endpoint,parameters){const job=this.queue.then(()=>this.perform(endpoint,parameters));this.queue=job.catch(()=>{});return job;}
 async perform(endpoint,parameters){
  if(!['lawSearch.do','lawService.do'].includes(endpoint))throw new Error('INVALID_ENDPOINT');
  const key=createHash('sha256').update(JSON.stringify([this.ocFingerprint,endpoint,parameters])).digest('hex');const cached=await this.cache.get(key);if(cached)return cached;
  const url=new URL(endpoint,'https://www.law.go.kr/DRF/');for(const [key,value]of Object.entries({...parameters,OC:this.oc,type:'JSON'}))url.searchParams.set(key,String(value));
  for(let attempt=0;attempt<3;attempt++){
   await sleep(Math.max(0,1000-(Date.now()-this.last)));this.last=Date.now();
   let response;try{response=await this.fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});}catch{if(attempt===2)throw new Error('LAW_NETWORK_FAILED');await sleep(2000*2**attempt);continue;}
   if([401,403,429].includes(response.status))throw new Error('LAW_ACCESS_LIMIT_STOPPED');
   if(response.status>=500){if(attempt===2)throw new Error('LAW_UPSTREAM_FAILED');await sleep(2000*2**attempt);continue;}
   if(!response.ok)throw new Error('LAW_REQUEST_FAILED');
   let data;try{data=await response.json();}catch{throw new Error('LAW_RESPONSE_NOT_JSON');}
   if(data?.result&&data?.msg)throw new Error('LAW_ACCESS_VALIDATION_FAILED');
   await this.cache.put(key,data);return data;
  }
 }
 listPrecedents({page=1,query='',display=20}={}){return this.request('lawSearch.do',{target:'prec',page,query,display:Math.min(display,100)});}
 listStatutes({page=1,query='',display=20}={}){return this.request('lawSearch.do',{target:'law',page,query,display:Math.min(display,100)});}
 precedent(id){return this.request('lawService.do',{target:'prec',ID:id});}
 currentStatute(id){return this.request('lawService.do',{target:'eflaw',ID:id});}
}
