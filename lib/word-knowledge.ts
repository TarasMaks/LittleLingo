import type {Evidence,Lesson} from './curriculum';
import type {WordRecord,Term} from './vocabulary';
export type WordState='recognised'|'recalled'|'retained'|'with-support'|'needs-review';
export type WordKnowledge={word:string;status:WordState;independent:number;lastSeen:string;skills:string[];explanation:string};
type Observation={word:string;date:string;independent:boolean;correct:boolean;skill:string;id:string;recall:boolean};
export function analyseWordKnowledge(evidence:Evidence[],records:WordRecord[],terms:Term[],lessons:Lesson[]):WordKnowledge[]{
 const observations:Observation[]=[];
 const latest=new Map<string,Evidence>();for(const e of evidence){const prev=latest.get(e.activityId);if(!prev||Date.parse(e.date)>=Date.parse(prev.date))latest.set(e.activityId,e)}
 for(const e of latest.values()){
  const a=lessons.find(l=>l.id===e.lessonId)?.activities.find(a=>a.id===e.activityId);
  // A passage result does not demonstrate every word in that passage.
  if(!a||!(a.pictures||a.scene)||a.kind==='discover'||!/^\w+$/.test(e.item)||e.status==='pending-review')continue;
  observations.push({word:e.item.toLowerCase(),date:e.date,independent:e.status==='independent',correct:e.correct,skill:e.skill,id:e.id,recall:a.kind==='spell'});
 }
 for(const r of records){const term=terms.find(t=>t.id===r.termId);if(!term)continue;for(const [i,h] of r.history.entries())observations.push({word:term.word,date:h.date,independent:h.correct&&!h.assisted,correct:h.correct,skill:'context recall',id:r.termId+'-'+i,recall:true})}
 const groups=new Map<string,Observation[]>();for(const o of observations){const group=groups.get(o.word)??[];group.push(o);groups.set(o.word,group)}
 return [...groups].map(([word,events])=>{
  events.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));const last=events.at(-1)!;const lastFailure=events.findLastIndex(e=>!e.independent);const clear=events.slice(lastFailure+1).filter(e=>e.independent);
  const recall=clear.filter(e=>e.recall);const delayed=recall.length>=2&&Date.parse(recall.at(-1)!.date)-Date.parse(recall[0].date)>=7*86400000;
  const status:WordState=!last.correct?'needs-review':!last.independent?'with-support':delayed?'retained':recall.length?'recalled':'recognised';
  const explanation=status==='retained'?'Independent recall on different dates at least seven days apart.':status==='recalled'?'At least one independent recall or spelling response; delayed retention still needs checking.':status==='recognised'?'Independent recognition in an isolated word task; recall still needs checking.':status==='with-support'?'The latest word response used support.':'The latest word response needs another try.';
  return {word,status,independent:events.filter(e=>e.independent).length,lastSeen:last.date,skills:[...new Set(events.map(e=>e.skill))],explanation};
 }).sort((a,b)=>a.word.localeCompare(b.word));
}
