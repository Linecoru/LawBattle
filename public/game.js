export const cases=[
 {id:'push',title:'한 번의 밀침',subtitle:'술자리에서 벌어진 뜻밖의 사고',tag:'상해 · 결과의 예견',facts:['A와 B는 술자리에서 말다툼을 했습니다.','A는 B를 한 차례 밀었습니다.','B는 넘어지면서 테이블 모서리에 머리를 부딪혀 크게 다쳤습니다.'],claim:'A는 다치게 할 의도는 없었다고 주장합니다.',issue:'한 번 밀친 행동으로 큰 부상까지 예상할 수 있었을까요?',prosecution:'사람을 밀면 넘어져 다칠 수 있다는 점은 예상할 수 있습니다. 실제로 밀친 직후 넘어져 부상을 입었으므로 행동과 결과의 연결을 살펴봐야 합니다.',defense:'한 차례 밀었다는 사실만으로 중상까지 예상했다고 단정하기는 어렵습니다. 발생한 결과의 크기와 행동 당시 예상할 수 있었던 일을 구분해야 합니다.'},
 {id:'phone',title:'바뀐 휴대전화',subtitle:'카페 테이블에 놓인 두 대의 휴대전화',tag:'재산 · 의도의 해석',facts:['C와 D는 카페의 옆 테이블에 앉아 있었습니다.','C는 D의 휴대전화를 들고 카페를 나갔습니다.','두 휴대전화의 케이스는 같은 색입니다.','C는 그날 저녁 카페에 휴대전화를 돌려주었습니다.'],claim:'C는 자신의 휴대전화로 착각했다고 주장합니다.',issue:'돌려준 행동은 당시의 의도를 어떻게 설명할까요?',prosecution:'다른 사람의 휴대전화를 가지고 나간 행동은 분명합니다. 나중에 돌려줬다는 사실만으로 가져갈 당시의 의도가 자동으로 설명되지는 않습니다.',defense:'케이스가 같은 색이고 당일 반환했다는 사실은 착각했다는 설명과 연결됩니다. 가져간 결과만으로 처음부터 훔칠 의도가 있었다고 단정하기 어렵습니다.'},
 {id:'door',title:'닫힌 문 너머',subtitle:'연락이 끊긴 친구를 찾아간 저녁',tag:'출입 · 행동의 이유',facts:['E는 친구 F의 집을 찾아갔습니다.','F가 연락을 받지 않자 E는 잠기지 않은 현관문을 열고 들어갔습니다.','F는 외출 중이었으며 들어오라는 허락을 한 적은 없습니다.','E는 물건을 가져가거나 훼손하지 않고 나왔습니다.'],claim:'E는 친구에게 문제가 생겼는지 걱정했다고 주장합니다.',issue:'걱정했다는 이유로 허락 없는 출입을 설명할 수 있을까요?',prosecution:'허락 없이 집 안에 들어갔다는 점이 중요합니다. 문이 잠기지 않았다는 사실이나 물건을 건드리지 않았다는 사실이 출입 허락을 대신하지는 않습니다.',defense:'물건을 가져가거나 훼손하지 않고 나온 행동은 걱정했다는 설명과 맞닿아 있습니다. 출입한 사실과 그 행동의 동기를 함께 살펴봐야 합니다.'}
];
export const roleName=role=>role==='prosecution'?'검사':'변호인';
export function remaining(deadline,now=Date.now()){return Math.max(0,Math.ceil((deadline-now)/1000));}
export function demoResult(){return {winner:'DRAW',reason:'현재는 화면과 진행 흐름을 확인하는 데모입니다. 제출한 주장은 평가하지 않았으며, 결과는 항상 무승부로 표시합니다.',sources:[]};}
export function hearing(caseData,role,argument){return [
 {speaker:'judge',text:'양측의 의견 진술을 듣겠습니다. 먼저 검사, 이 사건에 관한 최종 의견을 진술하시기 바랍니다.'},
 {speaker:'prosecution',text:role==='prosecution'?argument:caseData.prosecution},
 {speaker:'judge',text:'다음으로 변호인, 최종 의견을 진술하시기 바랍니다.'},
 {speaker:'defense',text:role==='defense'?argument:caseData.defense},
 {speaker:'judge',text:'양측의 의견을 모두 들었습니다. 이상으로 변론을 종결하겠습니다.'},
 {speaker:'judge',text:'양측 변론에 대한 판정 결과를 말씀드리겠습니다. 이번 시연에서는 무승부로 표시합니다.'}
];}
