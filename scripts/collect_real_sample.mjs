import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {LawClient} from '../backend/law-client.mjs';

const outputDirectory=fileURLToPath(new URL('../data/real_sample/',import.meta.url));
const cacheDirectory=fileURLToPath(new URL('../data/runtime/api-real-sample/',import.meta.url));
const client=new LawClient({oc:process.env.LAW_OC,cacheDirectory});

const precedentSpecs=[
 {id:'234709',topics:['정당방위','침해의 현재성','반격방어','상당성']},
 {id:'164543',topics:['절도','불법영득의사','일시 사용','휴대전화']},
 {id:'150933',topics:['정당방위','현행범 체포','위법한 체포','공무집행방해','상해']},
 {id:'215717',topics:['정당방위','정당행위','상호 싸움','일방적 공격','상당성']},
 {id:'86608',topics:['정당방위','상호 폭행','쟁투','상해']},
];
const articleSpecs={
 '21':['정당방위','과잉방위','현재의 부당한 침해','상당성'],
 '257':['상해','존속상해','미수범'],
 '329':['절도','타인의 재물','절취'],
};

function cleanText(value=''){
 return String(value)
  .replace(/<br\s*\/?\s*>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/gi,' ')
  .replace(/&quot;/gi,'"')
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>')
  .replace(/&amp;/gi,'&')
  .replace(/\r/g,'')
  .replace(/[ \t]+\n/g,'\n')
  .replace(/\n{3,}/g,'\n\n')
  .replace(/[ \t]{2,}/g,' ')
  .trim();
}

function formatDate(value=''){
 const digits=String(value).replace(/\D/g,'');
 return digits.length===8?`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6)}`:String(value);
}

function statuteDocuments(apiResponse){
 const law=apiResponse.법령;
 const info=law.기본정보;
 const units=Array.isArray(law.조문?.조문단위)?law.조문.조문단위:[law.조문?.조문단위].filter(Boolean);
 return Object.entries(articleSpecs).map(([articleNumber,topics])=>{
  const unit=units.find(item=>String(item.조문번호)===articleNumber&&item.조문여부==='조문');
  if(!unit)throw new Error(`형법 제${articleNumber}조를 API 응답에서 찾지 못했습니다.`);
  const paragraphs=Array.isArray(unit.항)?unit.항:unit.항?[unit.항]:[];
  const sections=paragraphs.length
   ?paragraphs.map((paragraph,index)=>({section_id:`article-${articleNumber}-${index+1}`,heading:`제${index+1}항`,text:cleanText(paragraph.항내용)}))
   :[{section_id:`article-${articleNumber}`,heading:unit.조문제목||`제${articleNumber}조`,text:cleanText(unit.조문내용)}];
  return {
   id:`statute-criminal-act-${articleNumber}`,
   document_type:'statute',
   title:`형법 제${articleNumber}조(${unit.조문제목})`,
   sections,
   metadata:{domain:'criminal',topics,effective_date:formatDate(info.시행일자),law_number:`법률 제${info.공포번호}호`,law_id:info.법령ID,fictional:false,collection_method:'official_api'},
   source:{name:'국가법령정보센터 Open API',url:`https://www.law.go.kr/법령/형법/제${articleNumber}조`},
  };
 });
}

function precedentDocument(apiResponse,spec){
 const item=apiResponse.PrecService;
 const sequence=String(item.판례정보일련번호||spec.id);
 const sections=[];
 if(cleanText(item.판시사항))sections.push({section_id:'issues',heading:'판시사항',text:cleanText(item.판시사항)});
 if(cleanText(item.판결요지))sections.push({section_id:'summary',heading:'판결요지',text:cleanText(item.판결요지)});
 if(cleanText(item.판례내용))sections.push({section_id:'full-text',heading:'판례내용 전문',text:cleanText(item.판례내용)});
 if(!sections.length)throw new Error(`판례 ${spec.id}에 본문이 없습니다.`);
 return {
  id:`precedent-${sequence}`,
  document_type:'precedent',
  title:item.사건명,
  sections,
  metadata:{domain:'criminal',topics:spec.topics,court:item.법원명,decision_date:formatDate(item.선고일자),case_number:item.사건번호,precedent_sequence:sequence,case_type:item.사건종류명,fictional:false,collection_method:'official_api',content_scope:'판시사항·판결요지·판례내용 전문'},
  source:{name:'국가법령정보센터 Open API',url:`https://www.law.go.kr/LSW/precInfoP.do?precSeq=${sequence}`},
 };
}

const documents=statuteDocuments(await client.currentStatute('001692'));
for(const spec of precedentSpecs)documents.push(precedentDocument(await client.precedent(spec.id),spec));

await mkdir(outputDirectory,{recursive:true});
const jsonl=documents.map(document=>JSON.stringify(document)).join('\n')+'\n';
await writeFile(`${outputDirectory}/raw_documents.jsonl`,jsonl,'utf8');
console.log(`실제 API 자료 ${documents.length}건 저장: 법령 3건, 판례 5건`);
