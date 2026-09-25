import {defaults,lessons,stories,levelCatalog,assess,assessGap,recommend,practiceCandidates,normalizeLevel,wordCount,validTargetWords} from './curriculum';
import type {Profile,Evidence} from './curriculum';
import {vocabulary,domains,wordQueue,advanceWord} from './vocabulary';
import type {Domain,WordRecord} from './vocabulary';
import {analyseWordKnowledge} from './word-knowledge';
import type {Draft} from './client';
import {z} from 'zod';

const KEY='little-lingo.pages.v1',SESSION=KEY+'.adult';
const profileSchema=z.object({nickname:z.string().trim().min(1).max(30),ageBand:z.enum(['7-9','10-11','7–9','10–11']),reading:z.enum(['early reader','confident reader','needs reading support']),level:z.string().refine(v=>levelCatalog.some(l=>l.id===v)||v==='beginner'),rate:z.number().refine(v=>[.65,.85,1].includes(v)),uk:z.boolean(),large:z.boolean(),spacing:z.boolean(),reduced:z.boolean(),microphone:z.boolean(),assignment:z.string()});
const evidenceSchema=z.object({id:z.string(),level:z.string().optional(),lessonId:z.string(),activityId:z.string(),skill:z.enum(['listening','reading','sentences','spelling','speaking','writing']),item:z.string(),firstResponse:z.string(),response:z.string(),assistance:z.array(z.string()),correct:z.boolean(),status:z.enum(['independent','supported','insufficient','pending-review']),date:z.string().datetime(),review:z.object({criteria:z.array(z.boolean()),feedback:z.string(),date:z.string().datetime()}).optional()});
const draftSchema=z.object({id:z.string(),level:z.string().optional(),title:z.string(),text:z.string(),objective:z.string(),words:z.array(z.string()),status:z.enum(['draft','published'])});
type Stored={version:1;profile:Profile;evidence:Evidence[];records:WordRecord[];drafts:Draft[];pin?:{salt:string;hash:string};failures?:number;lockedUntil?:number};
function fresh():Stored{return {version:1,profile:{...defaults},evidence:[],records:[],drafts:[]}}
function validate(value:unknown):Stored{
 const s=z.object({version:z.literal(1),profile:profileSchema,evidence:z.array(evidenceSchema),records:z.array(z.record(z.unknown())),drafts:z.array(draftSchema),pin:z.object({salt:z.string(),hash:z.string()}).optional(),failures:z.number().optional(),lockedUntil:z.number().optional()}).parse(value);
 for(const r of s.records){if(typeof r.termId!=='string'||!vocabulary.some(t=>t.id===r.termId)||!Array.isArray(r.history)||typeof r.due!=='string'||typeof r.firstSeen!=='string'||typeof r.attempts!=='number')throw new Error('Invalid vocabulary record in backup.');for(const h of r.history)if(typeof h.date!=='string'||typeof h.correct!=='boolean'||typeof h.assisted!=='boolean')throw new Error('Invalid vocabulary history.');}
 return s as unknown as Stored;
}
function read():Stored{const raw=localStorage.getItem(KEY);if(!raw)return fresh();try{return validate(JSON.parse(raw))}catch{throw new Error('Saved learning could not be read. Export a backup before clearing browser data.')}}
function save(s:Stored){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{throw new Error('Browser storage is full or disabled. Your change was not saved. Export a backup to keep your progress.')}}
function adult(){return Number(sessionStorage.getItem(SESSION)||0)>Date.now()}
function requireAdult(){if(!adult())throw new Error('Unlock the adult area to make this change.')}
async function digest(pin:string,salt:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}
function snapshot(s:Stored){return {profile:s.profile,evidence:s.evidence,adult:adult(),pinSet:!!s.pin,drafts:s.drafts.filter(d=>adult()||d.status==='published'),recommendation:recommend(s.evidence,s.profile)}}
async function learning(b:any){let s=read();if(!b)return snapshot(s);
 if(b.action==='unlock'){
  if(typeof b.pin!=='string'||!/^\d{6,12}$/.test(b.pin))throw new Error('Use a PIN with 6–12 digits.');
  if((s.lockedUntil??0)>Date.now())throw new Error('Too many tries. Please wait five minutes.');
  const salt=s.pin?.salt??crypto.randomUUID(),hash=await digest(b.pin,salt);s=read();
  if(s.pin&&s.pin.hash!==hash){s.failures=(s.failures??0)+1;if(s.failures>=5)s.lockedUntil=Date.now()+300000;save(s);throw new Error('That PIN did not match.');}
  s.pin={salt,hash};s.failures=0;s.lockedUntil=0;save(s);sessionStorage.setItem(SESSION,String(Date.now()+1800000));return {ok:true};
 }
 if(b.action==='lock'){sessionStorage.removeItem(SESSION);return {ok:true}}
 if(b.action==='evidence'){
  const lesson=lessons.find(l=>l.id===b.lessonId),a=lesson?.activities.find(a=>a.id===b.activityId),story=b.lessonId==='stories'?stories.find(x=>x.id===b.activityId):undefined;
  if(!a&&!story||a?.kind==='discover')throw new Error('Activity cannot be assessed.');
  if(typeof b.id!=='string'||typeof b.response!=='string'||typeof b.firstResponse!=='string'||b.response.length>4000||!Array.isArray(b.assistance))throw new Error('Please check your answer.');
  const old=s.evidence.find(e=>e.id===b.id);if(old&&(old.activityId!==b.activityId||old.lessonId!==b.lessonId))throw new Error('This response belongs to another activity.');
  if(old&&a?.kind==='write'){if(old.response!==b.response)throw new Error('Start a new attempt to revise submitted writing.');return {evidence:old};}
  const first=old?.firstResponse??b.firstResponse,assistance=[...new Set<string>([...(old?.assistance??[]),...b.assistance,...(old&&old.response!==b.response?['retry']:[])])];
  if(a?.kind==='write'&&(wordCount(b.response)<(a.minWords??1)||wordCount(b.response)>(a.maxWords??300)))throw new Error(`Write between ${a.minWords} and ${a.maxWords} words.`);
  const scoring=a?.kind==='write'?{correct:false,status:'pending-review' as const}:a?.kind==='gap'?assessGap(first,b.response,a,assistance):assess(first,b.response,a?.answer??story!.answer,assistance);
  const evidence:Evidence={id:b.id,level:lesson?.level??'A1',lessonId:b.lessonId,activityId:b.activityId,skill:a?.skill??'reading',item:a?.item??story!.id,firstResponse:first,response:b.response,assistance,...scoring,date:new Date().toISOString()};
  s.evidence=s.evidence.filter(e=>e.id!==b.id);s.evidence.push(evidence);save(s);return {evidence};
 }
 requireAdult();
 if(b.action==='profile'){s.profile=profileSchema.parse(b.profile) as Profile;save(s);return {ok:true}}
 if(b.action==='review-writing'){const e=s.evidence.find(e=>e.id===b.id),a=lessons.find(l=>l.id===e?.lessonId)?.activities.find(a=>a.id===e?.activityId);if(!e||a?.kind!=='write'||e.status!=='pending-review')throw new Error('Writing is not awaiting review.');if(!Array.isArray(b.criteria)||b.criteria.length!==a.rubric?.length||!b.criteria.every((x:unknown)=>typeof x==='boolean')||typeof b.feedback!=='string'||!b.feedback.trim()||b.feedback.length>1000)throw new Error('Assess each criterion and add feedback.');e.correct=b.criteria.every(Boolean);e.status=e.correct?(e.assistance.length||e.firstResponse!==e.response?'supported':'independent'):'insufficient';e.review={criteria:b.criteria,feedback:b.feedback.trim(),date:new Date().toISOString()};save(s);return {ok:true};}
 if(b.action==='draft'){if(typeof b.title!=='string'||b.title.length<3||b.title.length>80||typeof b.text!=='string'||b.text.length<20||b.text.length>5000||typeof b.objective!=='string'||b.objective.length>200||!validTargetWords(b.words)||!levelCatalog.some(l=>l.id===b.level))throw new Error('Check title, text, objective, level, and target words.');const id=crypto.randomUUID();s.drafts.push({id,title:b.title,text:b.text,objective:b.objective,words:b.words,level:b.level,status:'draft'});save(s);return {ok:true,id};}
 if(b.action==='publish'||b.action==='unpublish'){const draft=s.drafts.find(d=>d.id===b.id);if(!draft)throw new Error('Draft not found.');if(b.action==='publish'&&b.reviewed!==true)throw new Error('Review the story before publishing.');draft.status=b.action==='publish'?'published':'draft';save(s);return {ok:true};}
 throw new Error('Unknown action.');
}
function wordState(domain:string,b?:any){const s=read();if(!domains.some(d=>d.id===domain))throw new Error('Choose a vocabulary domain.');const queue=wordQueue(s.profile.level,domain as Domain,s.records);if(!b)return {...queue,records:s.records,level:s.profile.level};const term=vocabulary.find(t=>t.id===b.termId),old=s.records.find(r=>r.termId===b.termId);if(!term)throw new Error('Word not found.');if(old?.lastAttemptId===b.attemptId)return {record:old,term};if(typeof b.answer!=='string'||!b.answer.trim()||b.answer.length>80||typeof b.assisted!=='boolean'||typeof b.attemptId!=='string')throw new Error('Check your answer.');if(!queue.items.some(x=>x.term.id===term.id))throw new Error('This word is not due. Refresh your practice.');const record=advanceWord(term,old,b.answer,b.assisted,b.attemptId);s.records=s.records.filter(r=>r.termId!==term.id);s.records.push(record);save(s);return {record,term};}
function practice(domain:Domain){const s=read();if(!domains.some(d=>d.id===domain))throw new Error('Choose a vocabulary domain.');const candidates=practiceCandidates(s.evidence,s.profile.level),queue=wordQueue(s.profile.level,domain,s.records);return {title:'Your next small steps',source:'rules',notice:'Selected from your learning history: revisit gaps, recall due words, and add a little new material.',level:normalizeLevel(s.profile.level),domain,exercises:candidates.slice(0,4).map(c=>({id:c.id,lessonId:c.lessonId,reason:c.reason,observed:c.reason})),words:queue.items.map(i=>({id:i.term.id,word:i.term.word,reason:i.record?'Due for recall.':'A useful new word within your daily limit.',observed:''}))};}
function progress(){const s=read(),latest=new Map(s.evidence.map(e=>[e.activityId,e]));return {knowledge:analyseWordKnowledge(s.evidence,s.records,vocabulary,lessons),paths:levelCatalog.filter(l=>l.id!=='pre-A1').map(level=>{const bank=lessons.filter(l=>l.level===level.id);return {level:level.id,total:bank.length,passed:bank.filter(l=>l.activities.filter(a=>a.kind!=='discover').every(a=>latest.get(a.id)?.status==='independent')).length}})};}
export async function localFetch(input:string,init?:RequestInit):Promise<Response>{
 if(!input.startsWith('/api/'))return globalThis.fetch(import.meta.env.BASE_URL+input.replace(/^\//,''),init);
 try{const url=new URL(input,'https://local.invalid'),b=init?.body?JSON.parse(String(init.body)):undefined;let result;
  switch(url.pathname){case '/api/learning':result=await learning(b);break;case '/api/vocabulary':result=wordState(b?.domain??url.searchParams.get('domain')??'general',b);break;case '/api/practice':result=practice(b?.domain);break;case '/api/lexicon/progress':result=progress();break;default:throw new Error('This feature is unavailable.');}
  return Response.json(result);
 }catch(e){return Response.json({error:e instanceof z.ZodError?'Check the learning data format.':(e as Error).message},{status:400});}
}
export function exportProgress(){return localStorage.getItem(KEY)??JSON.stringify(fresh());}
export function importProgress(raw:string){requireAdult();if(raw.length>10000000)throw new Error('Backup is too large.');const s=validate(JSON.parse(raw));const current=read();s.pin=current.pin;s.failures=0;s.lockedUntil=0;save(s);}
