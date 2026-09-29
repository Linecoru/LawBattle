export function validateSource(s){
 if(!s||!['precedent','statute'].includes(s.type)||typeof s.id!=='string'||!s.id||typeof s.text!=='string'||!s.text.trim()||typeof s.title!=='string')throw new Error('SOURCE_INVALID');
 const url=new URL(s.url);if(!['https:','http:'].includes(url.protocol)||!['law.go.kr','open.law.go.kr','www.law.go.kr'].includes(url.hostname))throw new Error('SOURCE_URL_INVALID');
 if(s.vector&&(!s.embeddingModel||!Array.isArray(s.vector)||!s.vector.length||!s.vector.every(Number.isFinite)||!s.vector.some(v=>v!==0)))throw new Error('VECTOR_INVALID');return s;
}
export function cosine(a,b){if(a.length!==b.length||!a.length)throw new Error('VECTOR_DIMENSION_MISMATCH');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function searchSources(sources,{query='',type,vector,embeddingModel,limit=10}){
 const words=[...new Set(query.toLowerCase().match(/[가-힣a-z0-9]+/g)||[])];
 return sources.filter(s=>!type||s.type===type).map(s=>{const lexical=words.reduce((score,w)=>score+(s.title.includes(w)?3:0)+(s.text.includes(w)?1:0),0);const semantic=vector&&s.vector&&s.embeddingModel===embeddingModel&&s.vector.length===vector.length?cosine(vector,s.vector):0;const {vector:storedVector,...document}=s;return {...document,score:vector?semantic:lexical,method:vector?'vector':'keyword'};}).filter(s=>s.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.min(limit,20));
}
