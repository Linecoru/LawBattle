import {cases,roleName,remaining,demoResult,hearing} from './game.js';
const app=document.querySelector('#app');
const key='little-court-v1';
let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
let state={phase:'home',caseId:'push',role:'defense',draft:'',deadline:0,step:0,...(saved?.version===1?saved.state:{})};
if(!cases.some(c=>c.id===state.caseId)||!['home','case','opening','writing','hearing','result'].includes(state.phase))state={phase:'home',caseId:'push',role:'defense',draft:'',deadline:0,step:0};
let recordPinned=false,auto=false,autoTimer,typingTimer,typed=0,currentText='';
let submitting=false;
async function submitGame(){
 if(submitting)return;submitting=true;
 const button=document.querySelector('[data-action="submit"]');if(button){button.disabled=true;button.textContent='제출 중…';}
 try{
  const send=async(url,data)=>{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw new Error('저장 실패');return response.json();};
  if(!state.gameId){const game=await send('/api/v1/games',{caseId:state.caseId,role:state.role});state.gameId=game.id;save();}
  await send(`/api/v1/games/${state.gameId}/argument`,{argument:state.draft});
  set({phase:'hearing',step:0,deadline:0});
 }catch{state.deadline=Date.now()+30000;save();const error=document.querySelector('#error');if(error)error.textContent='서버에 연결하지 못했어요. 글은 저장되어 있습니다. 다시 제출해 주세요.';if(button){button.disabled=false;button.textContent='다시 제출하기 →';}}
 finally{submitting=false;}
}
const current=()=>cases.find(c=>c.id===state.caseId);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,state}));}catch{}}
function set(next){state={...state,...next};save();render();}
function person(kind,label){return `<div class="person ${kind}"><div class="hair"></div><div class="face"><i></i><i></i><b></b></div><div class="body"><span></span></div></div><div class="desk ${kind}-desk"><span>${label}</span></div>`;}
function court(){return `<div class="court" aria-label="중앙 재판장, 왼쪽 검사, 오른쪽 변호인과 피고인이 있는 법정"><div class="wall-panel left"></div><div class="wall-panel right"></div><div class="emblem">⚖</div><div class="window"><i></i><i></i></div><div class="platform"></div><div class="station judge-station">${person('judge','재판장')}</div><div class="station prosecutor-station">${person('prosecutor','검사')}</div><div class="station defense-station">${person('defender','변호인')}<div class="defendant">${person('witness','피고인')}</div></div><div class="floor"></div><div class="bench bench-left"></div><div class="bench bench-right"></div></div>`;}
function facts(){return `<ol class="facts">${current().facts.map(f=>`<li>${escape(f)}</li>`).join('')}</ol><div class="party-claim"><span>당사자의 주장</span>${escape(current().claim)}</div>`;}
function clock(){return '<span class="timer" role="timer" aria-label="남은 시간"></span>';}
function panel(){
 const c=current();
 if(state.phase==='home')return `<section class="welcome"><span class="eyebrow">작은 사건, 서로 다른 시선</span><h1>작은 법정</h1><p>정답보다 중요한 건,<br>당신의 이야기를 설득하는 힘.</p><button class="primary" data-action="start">법정에 들어가기 <span>→</span></button><div class="welcome-note">한 사건 · 두 가지 시선 · 당신의 변론</div></section>`;
 if(state.phase==='case')return `<section class="modal"><div class="modal-top"><span class="eyebrow">01 &nbsp; 사건 확인</span>${clock()}</div><div class="case-tabs" aria-label="사건 선택">${cases.map((item,i)=>`<button data-case="${item.id}" class="${item.id===c.id?'selected':''}">${String(i+1).padStart(2,'0')} ${item.title}</button>`).join('')}</div><div class="case-heading"><span class="tag">${c.tag}</span><h1>${c.title}</h1><p>${c.subtitle}</p></div>${facts()}<div class="question"><span>이번 사건의 쟁점</span><p>${c.issue}</p></div><div class="choose-label">어느 쪽의 이야기를 들려주시겠어요?</div><div class="role-buttons"><button data-role="prosecution" class="role prosecutor-role"><strong>검사로 참여하기</strong><span>행동의 책임을 이야기합니다 →</span></button><button data-role="defense" class="role defense-role"><strong>변호인으로 참여하기</strong><span>다른 가능성을 이야기합니다 →</span></button></div><small>시간이 끝나면 변호인으로 배정됩니다.</small></section>`;
 if(state.phase==='writing')return `<section class="modal writing"><div class="modal-top"><span class="eyebrow">02 &nbsp; 주장 작성</span>${clock()}</div><span class="tag">${roleName(state.role)} 측 의견</span><h1>당신의 생각을 들려주세요.</h1><p class="muted">법률 용어를 몰라도 괜찮아요. 사건의 사실을 바탕으로 이야기해 주세요.</p><div class="writing-tools"><span>${c.title}</span><div class="record-wrap"><button id="record-button" aria-expanded="false" aria-controls="record" data-action="record">▤ 사건 기록</button><aside id="record" class="record" hidden><h3>사건 기록</h3>${facts()}</aside></div></div><label class="sr-only" for="argument">최종 의견</label><textarea id="argument" maxlength="500" placeholder="저는 이렇게 생각합니다…">${escape(state.draft)}</textarea><div class="input-meta"><span>입력한 내용은 이 기기에 자동 저장돼요.</span><span id="count">${state.draft.length} / 500</span></div><div class="tip">✧ 기록에 없는 사실은 단정하지 말고, 추측이라면 이유를 함께 적어주세요.</div><p id="error" role="alert"></p><div class="submit-row"><small>시간이 끝나면 작성한 내용으로 진행합니다.</small><button class="primary" data-action="submit">변론 제출하기 →</button></div></section>`;
 if(state.phase==='result')return `<section class="modal result"><span class="eyebrow">03 &nbsp; 변론 판정 결과</span><div class="result-icon">⚖</div><h1>이번 변론은 무승부</h1><p class="muted">서로의 시선을 들어본 시간이었습니다.</p><div class="demo-notice"><strong>진행 확인용 결과</strong><p>${demoResult().reason}</p></div><details open><summary>내가 제출한 의견</summary><p class="user-text">${escape(state.draft||'제출한 의견이 없습니다.')}</p></details><details><summary>이번 사건의 쟁점</summary><p>${c.issue}</p></details><details><summary>사용한 판례·법령</summary><p>아직 자료 검색을 연결하지 않아 인용한 자료가 없습니다.</p></details><button class="primary" data-action="restart">다른 시선으로 다시 해보기 ↻</button></section>`;
 return '';
}
function render(){clearInterval(typingTimer);clearTimeout(autoTimer);recordPinned=false;
 const modal=['case','writing','result'].includes(state.phase);
 app.innerHTML=`<header><button class="brand" data-action="home">⚖ <span>작은 법정</span></button><span class="header-note">당신의 논리가 빛나는 곳</span><span class="demo-pill">로컬 데모</span></header><main class="scene ${modal?'modal-open':''}">${court()}${modal?'<div class="shade"></div>':''}${panel()}${['opening','hearing'].includes(state.phase)?'<section class="dialogue"><div class="speaker"></div><p id="speech" aria-live="polite"></p><div class="dialogue-actions"><button data-action="auto">자동 재생 '+(auto?'켜짐':'꺼짐')+'</button><button class="primary" data-action="next">계속하기 →</button></div></section>':''}<div class="phase-rail"><span class="${state.phase==='case'?'active':''}">01 사건 확인</span><i></i><span class="${state.phase==='writing'?'active':''}">02 주장 작성</span><i></i><span class="${['hearing','result'].includes(state.phase)?'active':''}">03 변론과 판정</span></div></main><footer><span>가상의 사건으로 즐기는 법정 이야기</span><span>교육·오락 목적 · 실제 사건의 법률 판단을 제공하지 않습니다</span></footer>`;
 app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
 app.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>set({caseId:b.dataset.case}));
 app.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>set({role:b.dataset.role,phase:'opening',deadline:0}));
 const input=document.querySelector('#argument');if(input)input.oninput=()=>{state.draft=input.value;save();document.querySelector('#count').textContent=`${input.value.length} / 500`;document.querySelector('#error').textContent='';};
 const wrap=document.querySelector('.record-wrap');if(wrap){wrap.onmouseenter=()=>showRecord(true);wrap.onmouseleave=()=>{if(!recordPinned)showRecord(false);};wrap.onfocusin=()=>showRecord(true);wrap.onfocusout=e=>{if(!recordPinned&&!wrap.contains(e.relatedTarget))showRecord(false);};}
 if(['opening','hearing'].includes(state.phase))speak();tick();
}
function showRecord(show){const popup=document.querySelector('#record');if(popup){popup.hidden=!show;document.querySelector('#record-button').setAttribute('aria-expanded',String(show));}}
function speak(){const line=state.phase==='opening'?{speaker:'judge',text:`지금부터 「${current().title}」 사건에 대한 공판을 시작하겠습니다.`}:hearing(current(),state.role,state.draft||'제출한 의견이 없습니다.')[state.step];if(!line)return set({phase:'result'});document.querySelector('.speaker').textContent=line.speaker==='judge'?'재판장':roleName(line.speaker);currentText=line.text;typed=0;typingTimer=setInterval(()=>{typed=Math.min(typed+2,currentText.length);document.querySelector('#speech').textContent=currentText.slice(0,typed);if(typed===currentText.length){clearInterval(typingTimer);scheduleAuto();}},25);}
function scheduleAuto(){if(auto)autoTimer=setTimeout(()=>action('next'),Math.max(2500,currentText.length*55));}
function action(name){
 if(name==='start'||name==='restart'){auto=false;set({phase:'case',gameId:null,draft:'',deadline:Date.now()+60000,step:0});}
 if(name==='home'){if(state.phase==='home'||confirm('진행 중인 법정을 나가시겠어요?'))set({phase:'home',deadline:0});}
 if(name==='record'){recordPinned=!recordPinned;showRecord(recordPinned);}
 if(name==='submit'){if(state.draft.trim().length<20){document.querySelector('#error').textContent='의견을 20자 이상 적어주세요.';return;}void submitGame();}
 if(name==='next'){if(typed<currentText.length){typed=currentText.length;clearInterval(typingTimer);document.querySelector('#speech').textContent=currentText;scheduleAuto();return;}if(state.phase==='opening')set({phase:'writing',deadline:Date.now()+180000});else if(state.phase==='hearing')set({step:state.step+1,phase:state.step>=5?'result':'hearing'});}
 if(name==='auto'){auto=!auto;document.querySelector('[data-action="auto"]').textContent='자동 재생 '+(auto?'켜짐':'꺼짐');clearTimeout(autoTimer);if(typed===currentText.length)scheduleAuto();}
}
function tick(){if(!['case','writing'].includes(state.phase))return;const seconds=remaining(state.deadline);const timer=document.querySelector('.timer');if(timer){timer.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;timer.classList.toggle('urgent',seconds<=10);}if(seconds===0){if(state.phase==='case')set({phase:'opening',role:'defense',deadline:0});else void submitGame();}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){recordPinned=false;showRecord(false);}});
document.addEventListener('click',e=>{if(!e.target.closest('.record-wrap')){recordPinned=false;showRecord(false);}});
setInterval(tick,250);render();
