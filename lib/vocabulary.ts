import terms from './vocabulary-content.json' with {type:'json'};
export type Domain='general'|'nature'|'technology'|'community'|'medicine'|'education'|'law'|'economy'|'transport'|'travel'|'cars';
export type Term={id:string;word:string;domain:Domain;level:string;definition:string;sentence:string;uk:string;zipf:number|null;importance?:'foundation'|'working'|'advanced'};
export const vocabulary=terms.entries as Term[];
export const vocabularySource=terms.source;
export const domains:{id:Domain;label:string;description:string}[]=[
 {id:'general',label:'Everyday English',description:'Useful words across many conversations.'},
 {id:'technology',label:'Software & technology',description:'Understand software, systems, information, and digital projects.'},
 {id:'community',label:'Business & projects',description:'Work together, negotiate, organize work, and explain proposals.'},
 {id:'medicine',label:'Medicine',description:'Understand clinical terminology, care settings, and health communication.'},
 {id:'nature',label:'Science & nature',description:'Describe living systems, physical processes, and scientific evidence.'},
 {id:'education',label:'Education',description:'Discuss teaching, learning, assessment, and classroom practice.'},
 {id:'law',label:'Law',description:'Understand legal documents, procedures, rights, and responsibilities.'},
 {id:'economy',label:'Economics',description:'Describe markets, resources, trade, and economic change.'},
 {id:'transport',label:'Transport',description:'Understand routes, logistics, infrastructure, and movement.'},
 {id:'travel',label:'Travel',description:'Plan journeys and communicate about accommodation and destinations.'},
 {id:'cars',label:'Cars & automotive',description:'Understand vehicles, components, maintenance terminology, and driving.'},
];
export type WordRecord={termId:string;firstSeen:string;lastSeen:string;due:string;streak:number;attempts:number;status:'independent'|'supported'|'insufficient';lastAttemptId:string;lastAnswer:string;history:{date:string;answer:string;assisted:boolean;correct:boolean}[]};
const levels=['pre-A1','A1','A2','B1','B2','C1','C2'];
export function eligibleTerms(level:string,domain:Domain){const cap=Math.max(1,levels.indexOf(level));return vocabulary.filter(t=>levels.indexOf(t.level)<=cap&&(t.domain==='general'||t.domain===domain))}
export function frequencyLabel(zipf:number|null){return zipf===null?'Frequency unavailable':zipf>=5?'Very common':zipf>=4?'Common':'Less common overall'}
export function normaliseWord(value:string){return value.trim().toLocaleLowerCase('en').replace(/[.!?]+$/,'')}
export function advanceWord(term:Term,old:WordRecord|undefined,answer:string,assisted:boolean,attemptId:string,now=Date.now()):WordRecord{
 if(old?.lastAttemptId===attemptId)return old;
 const correct=normaliseWord(answer)===normaliseWord(term.word);const status=!correct?'insufficient':assisted?'supported':'independent';
 const streak=status==='independent'?(old?.streak??0)+1:0;
 const days=status==='independent'?[1,3,7,14,30][Math.min(streak-1,4)]:1;
 const date=new Date(now).toISOString();
 return {termId:term.id,firstSeen:old?.firstSeen??date,lastSeen:date,due:new Date(now+days*86400000).toISOString(),streak,attempts:(old?.attempts??0)+1,status,lastAttemptId:attemptId,lastAnswer:answer,history:[...(old?.history??[]),{date,answer,assisted,correct}].slice(-12)};
}
export function wordQueue(level:string,domain:Domain,records:WordRecord[],now=Date.now()){
 const map=new Map(records.map(r=>[r.termId,r]));const eligible=eligibleTerms(level,domain);const today=new Date(now).toISOString().slice(0,10);
 const introduced=records.filter(r=>r.firstSeen.slice(0,10)===today).length;let slots=Math.max(0,5-introduced);
 const due=eligible.filter(t=>map.has(t.id)&&Date.parse(map.get(t.id)!.due)<=now).sort((a,b)=>Date.parse(map.get(a.id)!.due)-Date.parse(map.get(b.id)!.due)).slice(0,5);
 const fresh=eligible.filter(t=>!map.has(t.id)).sort((a,b)=>(b.zipf??-1)-(a.zipf??-1));
 const core=fresh.filter(t=>t.domain==='general'&&t.zipf!==null&&t.zipf>=4);
 const importance={foundation:0,working:1,advanced:2};const specialist=fresh.filter(t=>t.domain===domain&&domain!=='general').sort((a,b)=>importance[a.importance??'foundation']-importance[b.importance??'foundation']||(b.zipf??-1)-(a.zipf??-1));
 // Keep specialist introductions to two per UTC day, not just per click.
 const domainToday=records.filter(r=>r.firstSeen.slice(0,10)===today&&vocabulary.find(t=>t.id===r.termId)?.domain!=='general').length;
 const selected=[...due];let domainSlots=Math.max(0,2-domainToday);
 const newCore=core.slice(0,Math.min(slots,5-selected.length,domain==='general'?5:3));selected.push(...newCore);slots-=newCore.length;
 if(domainSlots&&slots)selected.push(...specialist.slice(0,Math.min(domainSlots,slots,5-selected.length)));
 return {items:selected.map(t=>({term:t,record:map.get(t.id)??null,reason:map.has(t.id)?'Due for recall':'A useful new word'})),introduced,newRemaining:Math.max(0,5-introduced),dueCount:eligible.filter(t=>map.has(t.id)&&Date.parse(map.get(t.id)!.due)<=now).length};
}
