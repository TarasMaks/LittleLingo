import {localFetch as fetch} from '@/lib/local-store';
import type {Profile,Evidence,Lesson} from './curriculum';
export type Draft={level?:string;id:string;title:string;text:string;objective:string;words:string[];status:string};
export type AppData={profile:Profile;evidence:Evidence[];adult:boolean;pinSet:boolean;drafts:Draft[];recommendation:{lesson:Lesson;reason:string;rule:string}};
export async function request(body?:unknown){const r=await fetch('/api/learning',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data:any=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');return data}
export function say(text:string,rate=.85,onWord?:(index:number)=>void,onEnd?:()=>void){if(!('speechSynthesis' in window))throw new Error('Audio is unavailable in this browser. You can use the written words.');window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=rate;u.onboundary=e=>onWord?.(e.charIndex);u.onend=()=>onEnd?.();u.onerror=()=>onEnd?.();window.speechSynthesis.speak(u)}
