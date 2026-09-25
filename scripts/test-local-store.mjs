import {build} from 'vite';
import assert from 'node:assert/strict';
await build({configFile:false,logLevel:'error',define:{'import.meta.env.BASE_URL':JSON.stringify('/LittleLingo/')},build:{ssr:'lib/local-store.ts',outDir:'.local-tests',rollupOptions:{output:{entryFileNames:'store.mjs'}}}});
class Storage{map=new Map();getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
globalThis.localStorage=new Storage();globalThis.sessionStorage=new Storage();
const {localFetch,exportProgress,importProgress}=await import('../.local-tests/store.mjs');
async function call(path,body,ok=true){const r=await localFetch(path,body?{method:'POST',body:JSON.stringify(body)}:undefined);const data=await r.json();assert.equal(r.ok,ok,JSON.stringify(data));return data;}
const initial=await call('/api/learning');assert.equal(initial.evidence.length,0);assert.equal(initial.adult,false);
await call('/api/learning',{action:'profile',profile:initial.profile},false);
const attempt={action:'evidence',id:'test-attempt-01',lessonId:'animals-1',activityId:'position-listen',response:'on',firstResponse:'on',assistance:[]};
assert.equal((await call('/api/learning',attempt)).evidence.status,'insufficient');
assert.equal((await call('/api/learning',{...attempt,response:'under',firstResponse:'under'})).evidence.status,'supported');
assert.equal((await call('/api/learning')).evidence.length,1);
await call('/api/learning',{action:'unlock',pin:'123456'});
await call('/api/learning',{action:'profile',profile:{...initial.profile,level:'C2'}});
const plan=await call('/api/practice',{domain:'technology',mode:'rules'});assert.equal(plan.level,'C2');assert.equal(plan.source,'rules');assert.ok(plan.exercises.length>0);
const words=await call('/api/vocabulary?domain=technology');assert.ok(words.items.length>0);
const term=words.items[0].term;
const wordAttempt={domain:'technology',termId:term.id,answer:term.word,assisted:false,attemptId:'word-attempt-01'};
const word=await call('/api/vocabulary',wordAttempt);assert.equal(word.record.attempts,1);
assert.equal((await call('/api/vocabulary',wordAttempt)).record.attempts,1);
assert.ok((await call('/api/lexicon/progress')).knowledge.some(k=>k.word===term.word));
const backup=exportProgress();importProgress(backup);assert.equal((await call('/api/learning')).profile.level,'C2');
assert.throws(()=>importProgress('{"version":1}'));assert.equal(exportProgress(),backup);
await call('/api/learning',{action:'lock'});await call('/api/learning',{action:'unlock',pin:'999999'},false);assert.throws(()=>importProgress(backup),/Unlock/);
await call('/api/learning',{action:'unlock',pin:'123456'});
const nativeSave=localStorage.setItem.bind(localStorage);localStorage.setItem=()=>{throw new Error('QuotaExceeded')};await call('/api/learning',{action:'profile',profile:initial.profile},false);localStorage.setItem=nativeSave;
assert.equal((await call('/api/learning')).profile.level,'C2');
console.log('Local persistence, retry scoring, C2 practice, vocabulary idempotency, backup, PIN and storage-failure checks passed.');
