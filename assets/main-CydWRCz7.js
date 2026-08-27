(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function n(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=n(r);fetch(r.href,i)}})();let ve=null,N=null;function Ce(){if(!ve)try{const e=window.AudioContext??window.webkitAudioContext;if(!e)return null;ve=new e}catch(e){return console.warn("Web Audio API not supported:",e),null}return ve}function Me(e){e.state==="suspended"&&e.resume()}function dt(e){if(!e)return;const t=Ce();if(!t)return;Me(t);const n=t.createOscillator(),s=t.createGain();n.connect(s),s.connect(t.destination),n.frequency.setValueAtTime(800,t.currentTime),n.type="sine",s.gain.setValueAtTime(.03,t.currentTime),s.gain.exponentialRampToValueAtTime(.001,t.currentTime+.05),n.start(t.currentTime),n.stop(t.currentTime+.05)}function Fe(e){if(!e)return;const t=Ce();if(!t)return;Me(t);const n=t.createOscillator(),s=t.createGain();n.connect(s),s.connect(t.destination),n.frequency.setValueAtTime(200,t.currentTime),n.type="sine",s.gain.setValueAtTime(.05,t.currentTime),s.gain.exponentialRampToValueAtTime(.001,t.currentTime+.08),n.start(t.currentTime),n.stop(t.currentTime+.08)}function ut(e){if(!e)return;const t=Ce();if(!t)return;Me(t);const n=(s,r,i)=>{const a=t.createOscillator(),l=t.createGain();a.connect(l),l.connect(t.destination),a.frequency.setValueAtTime(s,t.currentTime+r),a.type="sine",l.gain.setValueAtTime(.08,t.currentTime+r),l.gain.exponentialRampToValueAtTime(.001,t.currentTime+r+i),a.start(t.currentTime+r),a.stop(t.currentTime+r+i)};n(523.25,0,.15),n(659.25,.12,.2)}function Ue(){return"speechSynthesis"in window}function pt(e,t,n,s={}){if(!Ue())return!1;Ie(),N=new SpeechSynthesisUtterance(e),N.rate=s.speed??.85,N.pitch=1;const r=s.gender!=="male",i=window.speechSynthesis.getVoices(),p=r?["female","zira","hazel","susan","samantha","karen","moira","fiona","victoria","kate"]:["male","david","mark","james","daniel","george","alex"];let u=i.find(d=>d.lang.startsWith("en")&&p.some(c=>d.name.toLowerCase().includes(c)));return!u&&r&&(u=i.find(d=>d.lang.startsWith("en")&&d.name.includes("Google"))),u||(u=i.find(d=>d.lang.startsWith("en"))),u&&(N.voice=u),N.onstart=()=>{},N.onend=()=>{N=null,t?.()},N.onerror=d=>{console.warn("Speech synthesis error:",d),N=null,t?.()},window.speechSynthesis.speak(N),!0}function Ie(){window.speechSynthesis&&window.speechSynthesis.cancel(),N=null}function mt(){return window.speechSynthesis?.speaking||!1}const ie={LESSONS_PER_PAGE:20,DEFAULT_SORT_KEY:"title"},gt="8.0.0",ze=1,De=1,_e=["KS1","KS2","KS3","KS4"];function Je(e){return e==="KS1"||e==="KS2"||e==="KS3"||e==="KS4"}function ae(e){return e==="passage"||e==="phonics"||e==="spelling"||e==="wordset"||e==="drill"}const ft=["passages","wordsets","patterns"],Z="data/",Be=new Set,xe=new Map,ht={passage:"PASSAGES",phonics:"PHONICS",spelling:"SPELLING",wordset:"WORDSETS",drill:"PASSAGES"},$e={appTitle:"",tagline:"",homeStart:"",homeChangeLesson:"",tipAccuracyFirst:"",typingHeaderReady:"",lockstepOn:"Lockstep",focusLineOn:"Focus Line",metricAccuracy:"Accuracy",metricNetWPM:"Net WPM",metricWPM:"Words per minute",metricTime:"Time",metricErrors:"Errors",nextKeyLabel:"",spaceName:"",enterName:"",summaryNiceWork:"Lovely typing!",summaryReplay:"Try again",summaryHome:"Home",summaryDrill:"Start Focus Drill",summaryHardestKeys:"Hardest keys",summaryTrickyWords:"Tricky words",pasteBlocked:"Typing practice works best without pasting.",encourageGentle:["Nice and steady."]},T={PASSAGES:[],WORDSETS:[],PATTERNS:[],PHONICS:[],SPELLING:[],BADGES:[],KEYMAP:[],COPY:{...$e}};async function ee(e){try{const t=await fetch(e);return t.ok?await t.json():(console.warn(`Failed to load data from ${e}. Status: ${t.status}`),null)}catch(t){return console.warn(`Network error or invalid JSON at ${e}:`,t),null}}function yt(e){return!!e&&typeof e=="object"&&!Array.isArray(e)}async function bt(){const[e,t,n,s,r]=await Promise.all([ee(`${Z}badges.json`),ee(`${Z}copy.json`),ee(`${Z}keymap.json`),ee(`${Z}phonics.json`),ee(`${Z}spelling.json`)]);if(T.BADGES=e||[],T.COPY=t?{...$e,...t}:{...$e},T.KEYMAP=n||[],T.PHONICS=s||[],T.SPELLING=r||[],!T.COPY.appTitle)throw new Error("Core data (copy.json) failed to load. The application cannot start.");return!0}async function Ne(e){if(Be.has(e)||!_e.includes(e))return!0;const t=xe.get(e);if(t)return t;const n=(async()=>{const[s,r,i]=await Promise.all(ft.map(a=>ee(`${Z}${e}/${a}.json`)));return Array.isArray(s)&&T.PASSAGES.push(...s),Array.isArray(r)&&T.WORDSETS.push(...r),Array.isArray(i)&&T.PATTERNS.push(...i),Be.add(e),!0})();xe.set(e,n);try{return await n}finally{xe.delete(e)}}function vt(e){return yt(e)&&typeof e.id=="string"}const xt=["PASSAGES","WORDSETS","PHONICS","SPELLING"];function pe(e,t){const n=ht[e]||"PASSAGES";return xt.includes(n)?T[n].find(i=>vt(i)&&i.id===t)??null:null}async function St(e,t,n){if(e==="spelling"||e==="phonics")return pe(e,t);const s=pe(e,t);if(s)return s;const r=Je(n)?[n]:[..._e];for(const i of r){await Ne(i);const a=pe(e,t);if(a)return a}return null}const fe="storykeys_state",he="storykeys_draft",wt=1440*60*1e3;function Xe(e,t,n,s){try{localStorage.setItem(he,JSON.stringify({lessonId:e,lessonType:t,typedText:n,lessonData:s,savedAt:Date.now()}))}catch(r){console.warn("Unable to save draft:",r)}}function kt(e){if(!e||typeof e!="object")return!1;const t=e;return typeof t.lessonId=="string"&&ae(t.lessonType)&&typeof t.typedText=="string"&&typeof t.savedAt=="number"&&!!t.lessonData&&typeof t.lessonData=="object"}function Qe(){try{const e=localStorage.getItem(he);if(!e)return null;const t=JSON.parse(e);return!kt(t)||Date.now()-t.savedAt>wt?(oe(),null):t}catch{return null}}function oe(){try{localStorage.removeItem(he)}catch(e){console.warn("Unable to clear draft:",e)}}function Tt(){try{localStorage.removeItem(fe),localStorage.removeItem(he)}catch(e){console.warn("Unable to clear stored data:",e)}}const Et=3,$t=1,Lt=2,je={practice:1,accuracy:2,courage:3,variety:4,time:5,consistency:6,fluency:7,specialty:8,surprise:9};function Pt(e,t){return e.requires?(Array.isArray(e.requires)?e.requires:[e.requires]).every(s=>t.has(s)):!0}function At(e){return[...e].sort((t,n)=>{if(t.hidden&&!n.hidden)return 1;if(!t.hidden&&n.hidden)return-1;const s=t.tier??99,r=n.tier??99;if(s!==r)return s-r;const i=je[t.track??""]??99,a=je[n.track??""]??99;return i!==a?i-a:(t.id??"").localeCompare(n.id??"")})}function Ct(e,t){const n=t?Lt:Et,s=[],r=new Set;for(const i of At(e)){if(s.length>=n)break;i.track&&r.has(i.track)&&s.length>=$t||i.track&&r.has(i.track)||(s.push(i),i.track&&r.add(i.track))}return s}function Mt(e,t,n){const s=new Set(t.progress.badges.map(S=>S.id)),r=S=>s.has(S),i=t.sessions.length===0,a=t.runtime.lesson,l={id:"pending",contentType:a?.type??"passage",contentId:a?.data&&"id"in a.data&&a.data.id?a.data.id:"",stage:a?.data&&"stage"in a.data?a.data.stage:void 0,title:"",accuracy:e.accuracy,errors:e.errors,grossWPM:e.grossWPM,netWPM:e.netWPM,durationSec:e.durationSec,completionPercent:0,hardestKeys:e.hardestKeys,trickyWords:e.trickyWords,flags:t.runtime.flags??{lockstep:!1,focusLine:!1,keyboardHint:!1,timer:!1,countdownTimer:!1,showTimerChip:!1,punct:!0},ts:new Date().toISOString()},p=t.runtime.targetTextNorm?.length||0,u=[...t.sessions,l],d=u.length,c=t.progress.wordsTotal+p/5,h=t.progress.minutesTotal+e.durationSec/60,f=a?.data&&"theme"in a.data?a.data.theme:void 0;f&&(t.progress.themesCompleted[f]=!0);const y=Object.keys(t.progress.themesCompleted).length,$=l.stage;$&&(t.progress.stagesCompleted[$]=!0);const L=Object.keys(t.progress.stagesCompleted).length,b=S=>u.filter(ne=>ne.contentType===S).length,k=b("passage"),P=b("spelling"),I=b("phonics"),A=u.filter(S=>S.accuracy>=90).length,K=new Set(u.map(S=>new Date(S.ts).toDateString())).size,G=new Date,E=t.progress.consecutiveDays||1,C={};u.forEach(S=>{S.stage&&(C[S.stage]=(C[S.stage]||0)+1)});const _=Object.entries(C).sort((S,ne)=>ne[1]-S[1])[0]?.[0],W=["KS1","KS2","KS3","KS4"],te=!!(_&&$&&W.indexOf($)>W.indexOf(_)),Q=(t.runtime.startTime??new Date).getHours(),q=G.getDay()===0||G.getDay()===6,ye=t.runtime.flags?.lockstep,lt=a?.data.tags?.complexity?.punct,ct={practice_1:d>=1,practice_5:d>=5,practice_15:d>=15,practice_30:d>=30,practice_50:d>=50,practice_100:d>=100,accuracy_90:e.accuracy>=90,accuracy_95:e.accuracy>=95,accuracy_98:e.accuracy>=98,accuracy_100:e.accuracy===100,steady_3:A>=3,steady_10:A>=10,steady_25:A>=25,fluency_20:e.netWPM>=20,fluency_30:e.netWPM>=30,fluency_40:e.netWPM>=40,fluency_50:e.netWPM>=50,fluency_60:e.netWPM>=60,balanced_40:e.netWPM>=40&&e.accuracy>=90,balanced_50:e.netWPM>=50&&e.accuracy>=95,time_15:h>=15,time_30:h>=30,time_60:h>=60,time_120:h>=120,time_180:h>=180,words_500:c>=500,words_1k:c>=1e3,words_3k:c>=3e3,words_5k:c>=5e3,routine_2:K>=2,routine_5:K>=5,routine_10:K>=10,routine_20:K>=20,streak_3:E>=3,streak_5:E>=5,streak_7:E>=7,explorer_2:y>=2,explorer_4:y>=4,explorer_6:y>=6,mode_passage:k>=1,mode_spelling:P>=1,mode_phonics:I>=1,mode_mixer:k>=1&&P>=1&&I>=1,stage_2:L>=2,stage_3:L>=3,stage_4:L>=4,brave_longer:p>=200,brave_challenging:te,brave_steady:e.durationSec>=300,brave_lockstep:e.errors===0&&!!ye,brave_persist:e.errors>=10&&d>=1,spelling_star:e.errors===0&&l.contentType==="spelling",spelling_10:P>=10,spelling_25:P>=25,phonics_precision:e.accuracy>=90&&l.contentType==="phonics",phonics_10:I>=10,phonics_25:I>=25,punct_pro:e.accuracy>=95&&!!lt,surprise_early:Q<9,surprise_late:Q>=21,surprise_weekend:q,surprise_streak_10:E>=10},We=[];for(const S of n.BADGES)S._comment||!S.id||r(S.id)||ct[S.id]&&Pt(S,s)&&We.push(S);const be=Ct(We,i).map(S=>S.id).filter(S=>!!S);if(be.length>0){const S=new Date().toISOString();be.forEach(ne=>{t.progress.badges.push({id:ne,earnedAt:S})})}return be}const It={"’":"'","‘":"'","“":'"',"”":'"',"–":"-","—":"-","…":"..."," ":" "};function Ze(e){return It[e]??e}function B(e){return e.split("").map(Ze).join("")}function Dt(e){return e.replace(/\s+/g," ").trim()}async function et(e){const t=new TextEncoder().encode(e),n=await crypto.subtle.digest("SHA-256",t);return Array.from(new Uint8Array(n)).map(s=>s.toString(16).padStart(2,"0")).join("")}function _t(e,t){let n=0,s="";for(const r of e){if(n+=Ze(r).length,n>t)break;s+=r}return s}function v(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Oe(e={}){return"title"in e&&e.title?e.title:"name"in e&&e.name?e.name:"id"in e&&e.id?e.id:"Lesson"}function ce(e){const t=Math.max(0,Math.floor(e)),n=String(Math.floor(t/60)).padStart(2,"0"),s=String(t%60).padStart(2,"0");return`${n}:${s}`}function He(e,t){let n;const s=(...r)=>{n&&clearTimeout(n),n=setTimeout(()=>{n=void 0,e(...r)},t)};return s.cancel=()=>{n&&clearTimeout(n),n=void 0},s}function m(e){return document.getElementById(e)}const Re=e=>Math.min(100,Math.max(0,Math.round(e)));function le(e,t={}){const n="stage"in t&&t.stage?t.stage:"general",s="id"in t&&t.id?t.id:"unknown";return`${e||"lesson"}:${n}:${s}`}function Nt(e){return le(e.contentType,{id:e.contentId,stage:e.stage})}function Ot(e,t){return!!e.meta.lastLessonId&&e.meta.lastLessonId===t}function Ht(e,t){if(!e||e.length===0)return 0;const n=B(t||""),s=Math.min(e.length,n.length);let r=0;for(let i=0;i<s&&n[i]===e[i];i++)r=i+1;return Re(r/e.length*100)}function Rt(e){const t=new Date().toDateString(),n=e.progress.lastPlayed;if(!n)e.progress.consecutiveDays=1;else if(n!==t){const s=new Date(n),r=new Date(t);Math.round((r.getTime()-s.getTime())/(1e3*60*60*24))===1?e.progress.consecutiveDays=(e.progress.consecutiveDays||0)+1:e.progress.consecutiveDays=1}e.progress.lastPlayed=t}function Kt(e,t,n){return t==="spelling"?e.completedSpellings.includes(n):t==="phonics"?e.completedPhonics.includes(n):t==="wordset"?e.completedWordsets.includes(n):e.completedPassages.includes(n)}function Wt(e){return e==="passage"?"completedPassages":e==="phonics"?"completedPhonics":e==="spelling"?"completedSpellings":e==="wordset"?"completedWordsets":null}function Le(e,t){if(!t)return 0;const[n,,s]=t.split(":");let r=0;n&&s&&Kt(e.progress,n,s)&&(r=100);for(const i of e.sessions)if(Nt(i)===t){const a=typeof i.completionPercent=="number"?i.completionPercent:i.accuracy===100?100:0;r=Math.max(r,Re(a))}return r}function Ft(e,t,n,s){const a=({passage:t.PASSAGES,phonics:t.PHONICS,spelling:t.SPELLING,wordset:t.WORDSETS}[n]||[]).filter(p=>!s||p.stage===s);if(!a.length)return 0;const l=a.reduce((p,u)=>p+Le(e,le(n,u)),0);return Re(l/a.length)}const Ge=["💠","🐣","🐤","🐔","🦖","🐉"];function tt(e){const t=Math.min(Ge.length-1,Math.floor(e/30));return Ge[t]??"💠"}function nt(e,t){const n=document.documentElement;n.classList.remove("theme-light","theme-cream","theme-dark"),n.classList.add(`theme-${e.theme}`);const s={default:"var(--font-family-default)",dyslexia:"var(--font-family-dyslexia)",opendyslexic:"var(--font-family-opendyslexic)"};n.style.setProperty("--font-family",s[e.font]||s.default),n.style.setProperty("--line-height",String(e.lineHeight)),n.style.setProperty("--letter-spacing",`${e.letterSpacing/100}em`),n.classList.toggle("reduce-motion",e.reduceMotion===!0);const r=document.getElementById("progress-pet");r&&(r.textContent=tt(t.minutesTotal))}function D(e){const t=document.createElement("div");t.className="toast",t.textContent=e,t.setAttribute("role","status"),document.body.appendChild(t),setTimeout(()=>t.remove(),2500)}function Bt(){const e=document.querySelector(".badge-earned")||document.querySelector("#summary-screen .card");if(e)for(let t=0;t<30;t++){const n=document.createElement("div");n.className="confetti",n.style.left=`${Math.random()*100}%`,n.style.animationDelay=`${Math.random()*2}s`,n.style.backgroundColor=["#3b82f6","#16a34a","#f59e0b","#ef4444"][Math.floor(Math.random()*4)]??"#3b82f6",e.appendChild(n)}}function jt(e,t){const n=e.progress.badges.map(l=>(t.BADGES.find(u=>u.id===l.id)||{label:l.id}).label??l.id),s=Math.round(e.progress.minutesTotal),r=new Date().toLocaleDateString("en-GB",{year:"numeric",month:"long",day:"numeric"}),i=`<!DOCTYPE html>
<html>
<head>
    <title>StoryKeys Certificate</title>
    <style>
        @page { size: landscape; margin: 0.5in; }
        body { font-family: Georgia, 'Times New Roman', serif; text-align: center; padding: 40px; background: linear-gradient(135deg, #fef3c7, #fff); min-height: 100vh; box-sizing: border-box; }
        .certificate { border: 8px double #b45309; padding: 40px; background: #fffbeb; max-width: 900px; margin: 0 auto; }
        h1 { color: #92400e; font-size: 2.5rem; margin: 0; letter-spacing: 0.1em; }
        .subtitle { font-size: 1.2rem; color: #78350f; margin: 10px 0 30px; }
        .recipient { font-size: 1.8rem; font-style: italic; color: #1f2937; margin: 30px 0; border-bottom: 2px solid #d97706; padding-bottom: 10px; display: inline-block; min-width: 300px; }
        .achievement-text { font-size: 1.1rem; color: #374151; margin: 20px 0; }
        .badges { margin: 30px 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .badge-chip { background: #fef3c7; border: 1px solid #f59e0b; padding: 5px 15px; border-radius: 20px; font-size: 0.9rem; }
        .date { margin-top: 40px; font-size: 0.95rem; color: #9ca3af; }
        .logo { font-size: 2rem; margin-bottom: 10px; }
        @media print { body { background: white; } }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="logo">📚✨</div>
        <h1>Certificate of Achievement</h1>
        <p class="subtitle">StoryKeys Typing Practice</p>
        <p class="achievement-text">This certificate is awarded to</p>
        <div class="recipient">________________</div>
        <p class="achievement-text">for demonstrating dedication and skill in typing practice,<br>earning ${n.length} badge${n.length!==1?"s":""} and practicing for ${s} minutes.</p>
        <div class="badges">
            ${n.slice(0,12).map(l=>`<span class="badge-chip">${v(l)}</span>`).join("")}
            ${n.length>12?`<span class="badge-chip">+${n.length-12} more</span>`:""}
        </div>
        <p class="date">Awarded on ${r}</p>
    </div>
    <script>window.onload = () => window.print();<\/script>
</body>
</html>`,a=window.open("","_blank");a?(a.document.write(i),a.document.close()):D("Pop-up blocked. Please allow pop-ups to print the certificate.")}function Gt(e){return v(e).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>").split(/\n{2,}/).map(s=>`<p>${s.replace(/\n/g,"<br>")}</p>`).join("")}function qt(e,t){const n=B(e).split(/\s+/),s=B(t).split(/\s+/),r=new Set;for(let i=0;i<n.length;i++)n[i]!==(s[i]||"")&&r.add((n[i]??"").replace(/[.,;:!?'"“”’‘()-]/g,"").toLowerCase());return Array.from(r)}function Yt(e,t){const n=t.targetTextNorm??"",s=t.startTime??new Date,r=t.flags,i=t.runtimeErrors??0,a=t.hardestKeys??{},l=t.targetText??"",p=B(e),u=Math.max((Date.now()-s.getTime())/1e3,.1),d=n.length/5;let c=0;if(r?.lockstep)c=i;else for(let L=0;L<n.length;L++)p[L]!==n[L]&&c++;const h=n.length===0?0:Math.max(0,Math.round(100*(n.length-c)/n.length)),f=u/60,y=d/f,$=y-c/5/f;return{accuracy:h,durationSec:parseFloat(u.toFixed(1)),errors:c,netWPM:Math.max(0,Math.round($)),grossWPM:Math.max(0,Math.round(y)),hardestKeys:Object.entries(a).sort(([,L],[,b])=>b-L).slice(0,3).map(([L])=>L),trickyWords:qt(l,e).slice(0,3)}}function st(e){e&&(e.timer?.handle&&(clearInterval(e.timer.handle),e.timer.handle=null),e.wpmSampleInterval&&(clearInterval(e.wpmSampleInterval),e.wpmSampleInterval=null),e._cleanupPauseHandler?.(),e._cleanupResize?.(),e._cleanupSummaryKeys?.(),e._cleanupPauseHandler=null,e._cleanupResize=null,e._cleanupSummaryKeys=null)}function Ke(e,t,n,s){if(!e?.data)return;const r=e.type==="drill",i=e.type==="spelling",a="words"in e.data&&e.data.words?e.data.words:[],l="text"in e.data&&e.data.text?e.data.text:i?a.join(`
`):a.join(" ");if(!l){D("This lesson has no text to type.");return}st(t.runtime);const p=i?l:Dt(l),u=le(e.type,e.data);u&&(t.meta.lastLessonId=u,s?.());const d=r||!!e.withTimer,c=t.settings.showTimerDisplay;t.runtime={lesson:e,targetText:p,targetTextNorm:B(p),startTime:new Date,runtimeErrors:0,hardestKeys:{},flags:{lockstep:t.settings.lockstepDefault,focusLine:t.settings.focusLineDefault,keyboardHint:t.settings.keyboardHintDefault,timer:d||c,countdownTimer:d,showTimerChip:c,punct:e.data.tags?.complexity?.punct??!0},isDrill:r,timer:{handle:null,paused:!1,remaining:60,started:!1},lineElements:[],vanishedLines:new Set},n("typing")}function qe(e,t,n,s,r){if(!t.runtime.targetTextNorm)return;t.runtime.timer?.handle&&clearInterval(t.runtime.timer.handle);const i=Yt(e,t.runtime);Rt(t);const a=Mt(i,t,n);t.progress.wordsTotal+=t.runtime.targetTextNorm.length/5,t.progress.minutesTotal+=i.durationSec/60;const l=`sess_${Date.now()}`,p=t.runtime.lesson?.data&&"id"in t.runtime.lesson.data?t.runtime.lesson.data.id:void 0,u=t.runtime.lesson?.type;if(!t.runtime.isDrill&&p&&u){const h=Wt(u);h&&(t.progress[h].includes(p)||t.progress[h].push(p)),t.sessions.push({id:l,ts:new Date().toISOString(),contentId:p,contentType:u,title:Oe(t.runtime.lesson?.data),stage:t.runtime.lesson?.data&&"stage"in t.runtime.lesson.data?t.runtime.lesson.data.stage:void 0,completionPercent:Ht(t.runtime.targetTextNorm,e),...i,flags:t.runtime.flags??{lockstep:!1,focusLine:!1,keyboardHint:!1,timer:!1,countdownTimer:!1,showTimerChip:!1,punct:!0}}),t.sessions.length>500&&t.sessions.shift()}const d=t.sessions.filter(h=>h.contentId===p&&h.id!==l);let c=null;d.length>0&&(c={netWPM:Math.max(...d.map(h=>h.netWPM||0)),accuracy:Math.max(...d.map(h=>h.accuracy||0))}),ut(t.settings.soundEnabled),t.runtime.summaryResults={...i,newBadges:a,isDrill:!!t.runtime.isDrill,personalBest:c},r(),s("summary")}function Vt(e,t,n,s){const{trickyWords:r=[],hardestKeys:i=[]}=e.runtime.summaryResults||{};let a=null;if(r.length>0){const l=d=>{for(const c of t.WORDSETS)if(c.words?.includes(d))return c.tags?.phonics||[];for(const c of t.PASSAGES)if(c.text&&c.text.toLowerCase().split(/\W+/).includes(d))return c.tags?.phonics||[];for(const c of t.PHONICS)if(c.text&&c.text.toLowerCase().split(/\W+/).includes(d))return c.tags?.phonics||[];return[]},p=new Map;for(const d of r)for(const c of l(d)){const h=t.PATTERNS.find(f=>f.tags?.phonics?.includes(c));h&&p.set(h.name,h.items)}const u=p.entries().next().value;if(u){const[d,c]=u;a={type:"drill",data:{name:`Focus on: ${d}`,words:c},withTimer:!0}}}if(!a&&r.length>0)a={type:"drill",data:{name:"Focus on: Tricky Words",words:[...r,...r]},withTimer:!0};else if(!a&&i.length>0){const l=i[0]??"",p=[...t.WORDSETS,...t.PASSAGES,...t.PHONICS].flatMap(d=>"words"in d&&d.words?d.words:"text"in d&&d.text?d.text.split(" "):[]).filter(d=>B(d).toLowerCase().includes(l)),u=[...new Set(p)].filter(d=>d.length>2).sort(()=>.5-Math.random()).slice(0,10);u.length>4&&(a={type:"drill",data:{name:`Focus on: '${l}' key`,words:u},withTimer:!0})}a?Ke(a,e,n,s):D("No specific drill available for that session.")}const rt={q:"lp",a:"lp",z:"lp",1:"lp",w:"lr",s:"lr",x:"lr",2:"lr",e:"lm",d:"lm",c:"lm",3:"lm",r:"li",f:"li",v:"li",t:"li",g:"li",b:"li",4:"li",5:"li",y:"ri",h:"ri",n:"ri",u:"ri",j:"ri",m:"ri",6:"ri",7:"ri",i:"rm",k:"rm",",":"rm",8:"rm",o:"rr",l:"rr",".":"rr",9:"rr",p:"rp",";":"rp","/":"rp",0:"rp"," ":"thumb"};function Ut(e,t,n,s){if(!t.runtime.targetTextNorm)return;const r=e.target;if(r instanceof HTMLTextAreaElement&&(it(r.value,t),B(r.value).length>=t.runtime.targetTextNorm.length)){r.disabled=!0;const i=_t(r.value,t.runtime.targetTextNorm.length);setTimeout(()=>s(i),100)}}function it(e,t,n){const s=t.runtime.targetTextNorm,r=t.runtime.flags,i=t.runtime.hardestKeys,a=t.runtime.lineElements;if(!s||!r||!i)return;const l=m("typing-target");if(!l)return;const p=B(e);if(r.lockstep&&p.length>0&&p.slice(-1)!==s[p.length-1]){const f=m("typing-input");if(!f)return;f.value=e.slice(0,-1),t.runtime.runtimeErrors=(t.runtime.runtimeErrors??0)+1;const y=s[p.length-1];y&&y!==" "&&(i[y]=(i[y]||0)+1),Fe(t.settings.soundEnabled),f.classList.add("is-error"),setTimeout(()=>{f.classList.remove("is-error")},200);return}if(p.length>0){const f=p.length-1;p[f]===s[f]?(dt(t.settings.soundEnabled),t.runtime.timer&&!t.runtime.timer.started&&t.runtime.flags?.timer&&(t.runtime.timer.started=!0,t.runtime.startTime=new Date,t.runtime.timer.tick&&(t.runtime.timer.handle=setInterval(t.runtime.timer.tick,1e3),t.runtime.timer.tick()))):Fe(t.settings.soundEnabled)}if(!r.lockstep&&p.length>0){const f=p.length-1;if(p[f]!==s[f]){const y=s[f];y&&y!==" "&&(i[y]=(i[y]||0)+1)}}const u=p.length;if(a&&a.length>0){a.forEach(y=>y.classList.remove("current-line"));let f=null;if(u<s.length){const y=l.querySelector(`.char[data-idx="${u}"]`);y instanceof HTMLElement&&(f=y.parentElement)}else a.length>0&&(f=a[a.length-1]??null);f&&f.classList.add("current-line")}if(t.runtime.lesson?.type==="spelling"&&a?.length){const f=t.runtime.vanishedLines??new Set;a.forEach(y=>{const $=Number(y.dataset.startIdx);Number.isFinite($)&&p.length>$&&f.add($),y.classList.toggle("vanished",f.has(Number(y.dataset.startIdx)))}),t.runtime.vanishedLines=f}Array.from(l.querySelectorAll(".char")).forEach(f=>{if(!(f instanceof HTMLElement))return;const y=parseInt(f.dataset.idx??"",10);f.className="char",y<p.length&&f.classList.add(p[y]===s[y]?"correct":"incorrect"),y===u&&f.classList.add("current")});const c=u<s.length?s[u]:null,h=m("finger-hint");if(h){const f=h.querySelectorAll(".finger"),y=c?rt[c.toLowerCase()]:void 0;f.forEach($=>{($ instanceof SVGElement||$ instanceof HTMLElement)&&$.classList.toggle("active",$.getAttribute("data-finger")===y)})}if(c&&r.keyboardHint){const f=m("keyboard-hint");if(!f)return;f.querySelector(".key.highlight")?.classList.remove("highlight"),f.querySelector(`.key[data-key="${c.toLowerCase()}"]`)?.classList.add("highlight")}}function Ye(e,t){const n=m("typing-target");if(!n)return;const s=Array.from(n.querySelectorAll(".line"));if(s.length){const r=document.createDocumentFragment();s.forEach(i=>{Array.from(i.querySelectorAll(".char")).forEach(a=>r.appendChild(a))}),n.innerHTML="",n.appendChild(r)}requestAnimationFrame(()=>{const r=Array.from(n.querySelectorAll(".char"));if(!r.length)return;const i=[];let a=null;r.forEach(d=>{if(!(d instanceof HTMLElement))return;const c=d.offsetTop;(a===null||c!==a)&&(i.push([]),a=c),i[i.length-1]?.push(d)});const l=document.createDocumentFragment(),p=[];i.forEach(d=>{const c=document.createElement("div");c.className="line";const h=d.find(f=>f.textContent!==`
`)||d[0];h&&(c.dataset.startIdx=h.dataset.idx),d.forEach(f=>c.appendChild(f)),l.appendChild(c),p.push(c)}),n.innerHTML="",n.appendChild(l),e.runtime.lineElements=p;const u=m("typing-input");it(u?u.value:"",e)})}const at={hasSeenWelcome:!1,welcomeVersion:De,lastLessonId:null},re={font:"default",lineHeight:1.7,letterSpacing:2,theme:"cream",lockstepDefault:!0,focusLineDefault:!0,keyboardHintDefault:!1,showTimerDisplay:!0,defaultStage:"KS2",pin:null,soundEnabled:!1,fingerGuide:!1,reduceMotion:!1,voiceGender:"female",voiceSpeed:.85},zt={minutesTotal:0,wordsTotal:0,badges:[],themesCompleted:{},stagesCompleted:{},lastPlayed:null,consecutiveDays:0,completedPassages:[],completedSpellings:[],completedPhonics:[],completedWordsets:[]};function Jt(){return{settings:{...re},progress:{...zt,badges:[],themesCompleted:{},stagesCompleted:{},completedPassages:[],completedSpellings:[],completedPhonics:[],completedWordsets:[]},sessions:[],meta:{...at},ui:{currentScreen:"home",modal:null,lastFocus:null},runtime:{}}}function Xt(e){return e==="cream"||e==="light"||e==="dark"}function Qt(e){return e==="default"||e==="dyslexia"||e==="opendyslexic"}function Zt(e){return e==="KS1"||e==="KS2"||e==="KS3"||e==="KS4"}function en(e){return e==="female"||e==="male"}function tn(e){try{const t={_v:ze,settings:e.settings,progress:e.progress,sessions:e.sessions,meta:e.meta};localStorage.setItem(fe,JSON.stringify(t))}catch(t){console.warn("Unable to save state to localStorage:",t)}}function nn(e){try{const t=localStorage.getItem(fe);if(!t)return;const n=JSON.parse(t);e.settings={...e.settings,...n.settings},Xt(e.settings.theme)||(e.settings.theme=re.theme),Qt(e.settings.font)||(e.settings.font=re.font),Zt(e.settings.defaultStage)||(e.settings.defaultStage=re.defaultStage),en(e.settings.voiceGender)||(e.settings.voiceGender=re.voiceGender),e.settings.lineHeight=parseFloat(String(e.settings.lineHeight))||1.7,e.settings.letterSpacing=parseInt(String(e.settings.letterSpacing),10),Number.isNaN(e.settings.letterSpacing)&&(e.settings.letterSpacing=2),e.settings.voiceSpeed=parseFloat(String(e.settings.voiceSpeed)),Number.isNaN(e.settings.voiceSpeed)&&(e.settings.voiceSpeed=.85),e.progress={...e.progress,...n.progress,completedPassages:n.progress?.completedPassages||[],completedSpellings:n.progress?.completedSpellings||[],completedPhonics:n.progress?.completedPhonics||[],completedWordsets:n.progress?.completedWordsets||[],badges:n.progress?.badges||[],themesCompleted:n.progress?.themesCompleted||{},stagesCompleted:n.progress?.stagesCompleted||{}},e.sessions=n.sessions||[],e.meta={...at,...n.meta||{}}}catch(t){console.error("Failed to parse state from localStorage:",t)}}function sn(e,t){e.meta.hasSeenWelcome=!0,e.meta.welcomeVersion=De,t()}function rn(e){return!e.meta.hasSeenWelcome||e.meta.welcomeVersion!==De}function x(...e){return e.filter(Boolean).join(" ")}const Se="focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sk-accent",g={button:x("inline-flex items-center justify-center gap-2 min-h-12 px-5 py-3 text-base font-semibold","no-underline text-center rounded-xl border-2 border-transparent cursor-pointer","transition-[background-color,border-color,transform,opacity] duration-150","hover:enabled:-translate-y-px active:enabled:translate-y-0","disabled:opacity-45 disabled:cursor-not-allowed",Se),buttonPrimary:"btn-primary",buttonSecondary:"bg-sk-subtle border-sk-border text-sk-text hover:enabled:border-sk-accent",buttonQuiet:"bg-transparent border-transparent text-sk-text hover:enabled:bg-sk-subtle",buttonDanger:"bg-[#b32d24] text-white border-[#b32d24] hover:enabled:brightness-110",buttonPhonics:"bg-[#bde5c8] text-[#12402f] border-[#a3d6b2] hover:enabled:border-[#12402f]",buttonSpelling:"bg-[#b3dfe2] text-[#0f3c42] border-[#95ccd1] hover:enabled:border-[#0f3c42]",buttonSm:"min-h-10 px-3.5 py-2 text-[0.9rem]",buttonLg:"min-h-14 px-7 text-[1.15rem] font-bold rounded-2xl",buttonBlock:"w-full",iconButton:x("bg-transparent border-0 cursor-pointer size-11 rounded-full inline-flex items-center justify-center","text-sk-muted hover:bg-sk-subtle hover:text-sk-text transition-colors duration-150","[&>svg]:w-6 [&>svg]:h-6 [&>svg]:fill-current",Se),card:"card p-5 sm:p-7",cardTight:"card p-4 sm:p-5",sectionTitle:"text-[1.35rem] sm:text-[1.5rem] font-bold m-0",lead:"text-sk-muted m-0",eyebrow:"eyebrow",buttonRow:"flex flex-wrap items-center gap-3",buttonRowCenter:"flex flex-wrap items-center justify-center gap-3",buttonGroup:"flex flex-wrap items-center gap-2 sm:gap-3",textLink:x("bg-transparent border-0 text-sk-accent cursor-pointer font-semibold p-0 underline",Se),modal:"modal fixed inset-0 z-[100] hidden items-center justify-center bg-black/55 p-3 sm:p-5",modalContent:x("modal-content bg-sk-card rounded-2xl border border-sk-border","p-5 sm:p-7 max-w-[95%] w-[640px] max-h-[90vh] overflow-y-auto overscroll-contain","flex flex-col gap-5"),modalHeader:"flex justify-between items-start gap-4 shrink-0 pb-4 border-b border-sk-border",modalTitle:"text-[1.4rem] sm:text-[1.6rem] font-bold tracking-tight m-0",modalFooter:"mt-1 flex justify-center flex-wrap gap-3",toggle:x("toggle-switch inline-flex items-center gap-2.5 cursor-pointer select-none","text-[0.95rem] font-semibold rounded-full py-1.5 px-2 hover:bg-sk-subtle transition-colors duration-150"),field:"text-base px-3 py-2.5 min-h-11 border-2 border-sk-border rounded-xl bg-sk-card text-sk-text cursor-pointer hover:border-sk-accent transition-colors duration-150"};function w(...e){const t={primary:g.buttonPrimary,secondary:g.buttonSecondary,quiet:g.buttonQuiet,danger:g.buttonDanger,phonics:g.buttonPhonics,spelling:g.buttonSpelling,sm:g.buttonSm,lg:g.buttonLg,block:g.buttonBlock};return x(g.button,...e.map(n=>t[n]))}const an='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>',on=`**StoryKeys** is a calm typing companion for learners who benefit from gentle practice. It pairs curated stories with mindful drills so building muscle memory feels encouraging.

This project is designed to respect privacy, celebrate small wins, and make it easy for teachers, parents, and independent learners to explore accessible typing journeys.`,ln=`MIT License

Copyright (c) 2025 Philip Leichauer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;function cn(){return`<button id="close-modal-btn" type="button" class="${x(g.iconButton,"shrink-0 -mt-1 -mr-1")}" title="Close" aria-label="Close">${an}</button>`}function Y(e,t){return`<div class="${g.modalHeader}"><h2 id="${e}" class="${g.modalTitle}">${v(t)}</h2>${cn()}</div>`}const we="w-[130px] accent-sk-accent cursor-pointer",Ve="w-[110px] text-center px-3 py-2.5 min-h-11 border-2 border-sk-border rounded-xl bg-sk-card text-sk-text",dn="flex justify-between items-center gap-4 py-3.5 flex-wrap border-b border-sk-border last:border-0",un="m-0 text-sk-muted text-[0.88rem] max-w-none",V="border border-sk-border rounded-xl p-5 bg-sk-subtle",pn="flex items-center justify-between gap-2 font-bold text-[1.1rem] cursor-pointer min-h-11 list-none";function M(e,t,n){return`<div class="${dn}">
                        <div class="min-w-0">
                            <b>${v(e)}</b>
                            <p class="${un}">${v(t)}</p>
                        </div>
                        ${n}
                    </div>`}function U(e,t){return`<label class="${g.toggle}"><span class="sr-only">${v(t)}</span><input type="checkbox" id="${e}"><span class="slider"></span></label>`}function de(e,t){return`<select id="${e}" class="${x(g.field,"min-w-[9rem]")}">${t.map(([n,s])=>`<option value="${n}">${v(s)}</option>`).join("")}</select>`}function se(e,t,n=!0){return`<details class="group border border-sk-border rounded-xl px-4 py-2" ${n?"open":""}>
                    <summary class="${pn}">
                        <span>${v(e)}</span>
                        <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current shrink-0 text-sk-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    </summary>
                    <div class="pb-2">${t}</div>
                </details>`}function mn(e,t,n){switch(e){case"welcome":return`
            <div class="${g.modal}" id="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="${x(g.modalContent,"gap-4")}">
                ${Y("welcome-title","Welcome to StoryKeys")}
                <p class="text-[1.05rem] text-sk-muted m-0">A calm, dyslexia-friendly space to build confident typing skills.</p>
                <ul class="list-none p-0 m-0 grid gap-3">
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">📖</span><span><b>Pick a lesson</b> — stories, spelling lists, letter sounds, or word sets.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🔊</span><span><b>Listen first</b> — tap Read aloud to hear the words before you start.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🐢</span><span><b>Go at your pace</b> — the timer only starts when you press your first key.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🏅</span><span><b>Earn badges</b> — celebrate every milestone along the way.</span></li>
                    <li class="flex gap-3 items-start"><span class="text-xl shrink-0" aria-hidden="true">🎨</span><span><b>Make it yours</b> — change colours, fonts and spacing in Settings.</span></li>
                </ul>
                <p class="text-sm text-sk-muted m-0">Everything stays on this device. No account needed.</p>
                <div class="${g.modalFooter}">
                    <button id="welcome-start-btn" type="button" class="${w("primary","lg")}">Let's start</button>
                </div>
            </div></div>`;case"help":return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="${g.modalContent}">
                ${Y("help-title","Need a hand?")}
                <div class="${V}">
                    <h3 class="mt-0">What is StoryKeys?</h3>
                    <p class="mb-0">StoryKeys is a reading and typing practice tool that uses short stories to build confidence and rhythm. It keeps things calm so you can focus on accuracy first, then speed.</p>
                </div>
                <div class="${V}">
                    <h3 class="mt-0">How to use it</h3>
                    <ol class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Choose a story.</li>
                        <li>Type the words you see.</li>
                        <li>Aim for accuracy first, then speed.</li>
                    </ol>
                </div>
                <div class="${V}">
                    <h3 class="mt-0">Features that help</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li><b>Focus line</b> — dims everything except the line you are on.</li>
                        <li><b>Lockstep</b> — waits for the right letter before moving on.</li>
                        <li><b>Read aloud</b> — hears the passage for you before you type.</li>
                        <li><b>Finger guide</b> — shows which finger to reach with.</li>
                    </ul>
                </div>
                <div class="${V}" id="help-data-privacy">
                    <h3 class="mt-0">Data &amp; privacy</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Progress is stored only in this browser, using localStorage.</li>
                        <li>No accounts, no cloud storage, no third-party trackers.</li>
                        <li>You can export or erase local data from Parent Glance.</li>
                    </ul>
                </div>
                <div class="${V}">
                    <h3 class="mt-0">Tips</h3>
                    <ul class="pl-[1.2rem] m-0 grid gap-1">
                        <li>Take your time. Accuracy comes first.</li>
                        <li>Keep your fingers resting on the home row.</li>
                        <li>Green letters mean you got it right.</li>
                        <li>Short breaks help hands and eyes stay fresh.</li>
                    </ul>
                </div>
                <div class="${V}">
                    <h3 class="mt-0">Keyboard shortcuts</h3>
                    <ul class="list-none p-0 m-0 grid gap-2">
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Enter</kbd> Start lesson or try again</li>
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Esc</kbd> Pause typing, or go home</li>
                        <li class="flex gap-4 items-center"><kbd class="min-w-[64px] text-center">Space</kbd> Carry on when paused</li>
                    </ul>
                </div>
                <div class="${V}">
                    <h3 class="mt-0">About StoryKeys</h3>
                    <div>${Gt(on)}</div>
                </div>
                ${se("License",`<pre class="bg-sk-card border border-sk-border rounded-xl p-4 whitespace-pre-wrap overflow-x-auto font-mono text-xs m-0 mt-2">${v(ln)}</pre>`,!1)}
            </div></div>`;case"badges":{const s=t.progress.badges.map(a=>{const l=n.BADGES.find(d=>d.id===a.id)||{label:a.id,desc:"Badge earned."},p=a.earnedAt?new Date(a.earnedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"",u=p?`<span class="block text-xs text-sk-muted mt-1.5">Earned ${v(p)}</span>`:"";return`<div class="flex gap-3 items-start border border-sk-border rounded-xl p-4 bg-sk-subtle text-left">
                    <span class="text-2xl shrink-0" aria-hidden="true">🏅</span>
                    <span class="min-w-0">
                        <span class="block font-bold">${v(l.label)}</span>
                        <span class="block text-sm text-sk-muted">${v(l.desc)}</span>
                        ${u}
                    </span>
                </div>`}),r=s.length>0,i=n.BADGES.filter(a=>!a._comment&&!a.hidden).length;return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="badges-title"><div class="${g.modalContent}">
                ${Y("badges-title","Your badges")}
                ${r?`<p class="${g.eyebrow}">${s.length} of ${i} earned</p>
                     <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${s.join("")}</div>
                     <div class="${g.modalFooter}"><button id="print-certificate-btn" type="button" class="${w("secondary")}"><span aria-hidden="true">🎓</span> Print certificate</button></div>`:`<div class="text-center py-6">
                        <div class="text-5xl mb-3" aria-hidden="true">🏅</div>
                        <p class="m-0 mx-auto text-sk-muted">No badges yet. Finish a lesson and your first one will appear here.</p>
                     </div>`}
            </div></div>`}case"lessonPicker":return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="lesson-picker-title"><div class="${x(g.modalContent,"lesson-picker-modal w-[min(920px,95%)] gap-4")}">
                ${Y("lesson-picker-title",n.COPY.homeChangeLesson)}
                <div class="tabs flex gap-1 border-b border-sk-border overflow-x-auto -mt-1">
                    <button type="button" class="tab-button active" data-type="passage">Stories</button>
                    <button type="button" class="tab-button" data-type="phonics">Letter sounds</button>
                    <button type="button" class="tab-button" data-type="spelling">Spelling</button>
                    <button type="button" class="tab-button" data-type="wordset">Word sets</button>
                </div>
                <div class="flex gap-3 items-center flex-wrap">
                    <label class="${g.eyebrow}" for="stage-filter-ks1">Key stage</label>
                    <div class="stage-filter flex flex-wrap gap-1.5">
                        <button type="button" class="${w("secondary","sm")}" data-stage="KS1" id="stage-filter-ks1">KS1</button>
                        <button type="button" class="${w("secondary","sm")}" data-stage="KS2">KS2</button>
                        <button type="button" class="${w("secondary","sm")}" data-stage="KS3">KS3</button>
                        <button type="button" class="${w("secondary","sm")}" data-stage="KS4">KS4</button>
                    </div>
                </div>
                <div class="flex gap-2 sm:gap-3 flex-wrap">
                    <label class="sr-only" for="search-input">Search lessons</label>
                    <input type="search" id="search-input" class="${x(g.field,"grow min-w-[11rem] cursor-text")}" placeholder="Search by title or theme…">
                    <label class="sr-only" for="status-filter">Filter by status</label>
                    <select id="status-filter" class="${g.field}">
                        <option value="all">All</option>
                        <option value="complete">Finished</option>
                        <option value="todo">Not yet done</option>
                    </select>
                    <label class="sr-only" for="sort-select">Sort lessons</label>
                    <select id="sort-select" class="${g.field}">
                        <option value="title">Sort: title</option>
                        <option value="length">Sort: length</option>
                        <option value="theme">Sort: theme</option>
                    </select>
                </div>
                <div class="lesson-list grow overflow-y-auto overscroll-contain min-h-[240px] sm:min-h-[360px] max-h-[50vh] sm:max-h-[420px] -mx-1 px-1"></div>
                <div class="pagination-controls flex justify-between items-center gap-3 pt-3 border-t border-sk-border"></div>
            </div></div>`;case"settings":return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="${g.modalContent}">
                ${Y("settings-title","Settings")}
                ${se("Look and feel",[M("Colours","Change the app's colour scheme.",de("setting-theme",[["cream","Cream"],["light","Light"],["dark","Dark"]])),M("Font","Choose a clearer font for reading.",de("setting-font",[["default","Default"],["dyslexia","Clear (Arial)"],["opendyslexic","OpenDyslexic"]])),M("Line spacing","Space between lines of text.",`<div class="flex items-center gap-3"><span id="lh-val" class="tabular-nums text-sk-muted min-w-[2.5rem] text-right"></span><input type="range" id="setting-line-height" min="1.4" max="2.0" step="0.1" class="${we}"></div>`),M("Letter spacing","Space between letters.",`<div class="flex items-center gap-3"><span id="ls-val" class="tabular-nums text-sk-muted min-w-[2.5rem] text-right"></span><input type="range" id="setting-letter-spacing" min="0" max="8" step="1" class="${we}"></div>`),M("Reduce motion","Turn off animations and effects.",U("setting-reduce-motion","Reduce motion"))].join(""))}
                ${se("Typing helpers",[M("Lockstep","Wait for the right letter before moving on.",U("setting-lockstep","Lockstep")),M("Focus line","Dim every line except the current one.",U("setting-focusline","Focus line")),M("On-screen keyboard","Show a keyboard with the next key lit up.",U("setting-keyboard","On-screen keyboard")),M("Finger guide","Show which finger to use.",U("setting-finger-guide","Finger guide"))].join(""))}
                ${se("Sound and speech",[M("Typing sounds","Play soft clicks while typing.",U("setting-sound","Typing sounds")),M("Read aloud voice","Voice used to read passages.",de("setting-voice-gender",[["female","Female"],["male","Male"]])),M("Reading speed","How fast text is read aloud.",`<div class="flex items-center gap-3"><span id="vs-val" class="tabular-nums text-sk-muted min-w-[3rem] text-right"></span><input type="range" id="setting-voice-speed" min="0.5" max="1.2" step="0.05" class="${we}"></div>`)].join(""))}
                ${se("For grown-ups",[M("Key stage","Used for the main buttons on the home screen.",de("setting-default-stage",[["KS1","KS1"],["KS2","KS2"],["KS3","KS3"],["KS4","KS4"]])),M("Show timer","Display a timer during lessons.",U("setting-timer-display","Show timer")),M("Parent PIN","Protect Parent Glance with 4 digits.",`<input type="password" id="setting-pin" class="${Ve}" maxlength="4" placeholder="0000" inputmode="numeric" autocomplete="new-password">`)].join(""),!1)}
                <div class="${g.modalFooter}">
                    <button id="save-settings-btn" type="button" class="${w("primary","lg")}">Save and close</button>
                </div>
            </div></div>`;case"parent":{const s=t.sessions.filter(a=>Date.now()-new Date(a.ts).getTime()<6048e5),r=s.length?`${Math.round(s.reduce((a,l)=>a+l.accuracy,0)/s.length)}%`:"—",i=(a,l)=>`<div class="bg-sk-subtle border border-sk-border rounded-xl p-4 text-center">
                        <p class="${g.eyebrow}">${v(a)}</p>
                        <p class="metric-value text-[1.8rem] m-0 mt-1">${v(l)}</p>
                    </div>`;return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="parent-title"><div class="${g.modalContent}">
                ${Y("parent-title","Parent Glance")}
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    ${i("Sessions this week",String(s.length))}
                    ${i("Average accuracy",r)}
                    ${i("Total minutes",String(Math.round(t.progress.minutesTotal)))}
                </div>
                <div>
                    <p class="${g.eyebrow}">Recent sessions</p>
                    <div class="max-h-[220px] overflow-y-auto border border-sk-border rounded-xl mt-2 divide-y divide-sk-border">${t.sessions.slice(-10).reverse().map(a=>{const l=typeof a.netWPM=="number"?`${a.netWPM} wpm`:"– wpm";return`<div class="flex justify-between items-center gap-3 px-3 py-2.5 text-sm">
                            <span class="min-w-0 truncate">${v(a.title||a.contentId)}</span>
                            <span class="shrink-0 text-sk-muted tabular-nums">${a.accuracy}% · ${v(l)}</span>
                        </div>`}).join("")||'<p class="m-0 p-4 text-sk-muted">No sessions yet.</p>'}</div>
                </div>
                <div class="${x(g.buttonRow,"mt-1")}">
                    <button id="export-btn" type="button" class="${w("secondary")}">Export data</button>
                    <button id="clear-data-btn" type="button" class="${w("danger")}">Clear all data</button>
                </div>
            </div></div>`}case"pin":return`
            <div class="${g.modal}" role="dialog" aria-modal="true" aria-labelledby="pin-title"><div class="${x(g.modalContent,"w-[420px] text-center")}">
                ${Y("pin-title","Enter PIN")}
                <p class="m-0 mx-auto text-sk-muted">This area is for grown-ups.</p>
                <label class="sr-only" for="pin-input">Four digit PIN</label>
                <input type="password" id="pin-input" data-autofocus class="${x(Ve,"mx-auto text-3xl tracking-[0.3em] w-[170px]")}" maxlength="4" inputmode="numeric" autocomplete="one-time-code">
                <div class="${g.modalFooter}">
                    <button id="pin-submit-btn" type="button" class="${w("primary")}">Unlock</button>
                </div>
            </div></div>`}}const gn={Animals:"🐾","Silly Stories":"🤪",Nature:"🌿",Core:"📚",Phonics:"🔤",Statutory:"📜","Science snips":"🔬",Myths:"🦄",Academic:"🎓",History:"🏛️",Geography:"🗺️"},fn={KS1:"Ages 5–7",KS2:"Ages 7–11",KS3:"Ages 11–14",KS4:"Ages 14–16"},hn='<svg viewBox="0 0 24 24" class="w-5 h-5 fill-current shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';function yn(e){return e.title?e.title:(e.id||"").split("_").slice(1).join(" ").replace(/_/g," ")||e.id||"Lesson"}function bn(e){if(!e.sessions.length)return"";const t=new Set,n=[];for(let r=e.sessions.length-1;r>=0&&n.length<4;r--){const i=e.sessions[r];!i||t.has(i.contentId)||(t.add(i.contentId),n.push({id:i.contentId,type:i.contentType,stage:i.stage,title:i.title,accuracy:i.accuracy,wpm:i.netWPM}))}if(!n.length)return"";const s=n.map(r=>`
        <button type="button" class="recent-lesson-btn tile flex justify-between items-center gap-3 px-4 py-3 min-h-12 bg-sk-card border border-sk-border rounded-xl cursor-pointer text-left w-full" data-recent-id="${v(r.id)}" data-recent-type="${v(r.type)}" data-recent-stage="${v(r.stage||"")}">
            <span class="font-semibold min-w-0 truncate">${v(yn(r))}</span>
            <span class="text-sm text-sk-muted shrink-0 tabular-nums">${r.accuracy}% · ${r.wpm||"–"} wpm</span>
        </button>`).join("");return`
        <section class="${g.card}" aria-labelledby="recent-heading">
            <h2 id="recent-heading" class="${g.sectionTitle}">Pick up where you left off</h2>
            <div class="recent-lessons-list flex flex-col gap-2 mt-4">${s}</div>
        </section>`}function vn(e){const t=Qe(),n=e.settings.defaultStage,s=Math.round(e.progress.minutesTotal),r=e.progress.consecutiveDays,i=t?`
                <section id="resume-draft-card" class="${x(g.card,"resume-card")}" aria-labelledby="resume-heading">
                    <p class="${g.eyebrow}">Unfinished lesson</p>
                    <h2 id="resume-heading" class="${x(g.sectionTitle,"mt-1")}">${v(Oe(t.lessonData))}</h2>
                    <p class="${x(g.lead,"mt-2")}">${t.typedText.length>0?`You typed ${t.typedText.length} characters last time.`:"You opened this lesson but had not started typing."}</p>
                    <div class="${x(g.buttonRow,"mt-5")}">
                        <button id="resume-draft-btn" type="button" class="${w("primary")}">Carry on</button>
                        <button id="discard-draft-btn" type="button" class="${w("quiet")}">Start something else</button>
                    </div>
                </section>`:"",a=_e.map(l=>`
                            <div class="flex items-center gap-3 py-1.5">
                                <span class="w-24 shrink-0 font-bold">${l}<span class="block text-xs font-normal text-sk-muted">${fn[l]}</span></span>
                                <button type="button" class="${x(w("secondary","sm"),"flex-1")}" data-stage="${l}">Story</button>
                                <button type="button" class="${x(w("secondary","sm"),"flex-1")}" data-spelling-stage="${l}">Spelling</button>
                            </div>`).join("");return`
            <div id="home-screen" class="screen active flex flex-col gap-5 sm:gap-6">
                <header class="text-center pt-1 pb-2">
                    <h1 class="text-[1.9rem] sm:text-[2.4rem]">Welcome to StoryKeys</h1>
                    <p class="${x(g.lead,"mx-auto mt-1 text-[1.05rem]")}">A calm, friendly place to practise typing.</p>
                </header>

                ${i}

                <section id="new-story-card" class="${g.card}" aria-labelledby="start-heading">
                    <p class="${g.eyebrow}">Your key stage · ${n}</p>
                    <h2 id="start-heading" class="${x(g.sectionTitle,"mt-1")}">Ready to type?</h2>
                    <p class="${x(g.lead,"mt-2")}">Pick a short story, practise your spellings, or work on letter sounds.</p>

                    <div class="flex flex-col gap-3 mt-6">
                        <button type="button" class="${w("primary","lg","block")}" data-stage="${n}">
                            <span aria-hidden="true">📖</span> Read and type a story
                        </button>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button type="button" class="${w("spelling","block")}" data-spelling-stage="${n}">
                                <span aria-hidden="true">✏️</span> Spelling practice
                            </button>
                            <button id="phonics-mode-btn" type="button" class="${w("phonics","block")}">
                                <span aria-hidden="true">🔤</span> Letter sounds
                            </button>
                        </div>
                    </div>

                    <details class="group mt-5 border-t border-sk-border pt-4">
                        <summary class="${x("flex items-center justify-between gap-2 font-semibold text-sk-muted hover:text-sk-text min-h-11 rounded-xl px-1","marker:content-none")}">
                            <span>Try a different key stage</span>
                            ${hn}
                        </summary>
                        <div class="mt-3 flex flex-col divide-y divide-sk-border">${a}</div>
                    </details>
                </section>

                ${bn(e)}

                <section class="${g.card}" aria-labelledby="explore-heading">
                    <h2 id="explore-heading" class="${g.sectionTitle}">Explore</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <button id="browse-lessons-btn" type="button" class="${x(w("secondary","block"),"justify-start text-left h-auto py-4")}">
                            <span class="text-2xl shrink-0" aria-hidden="true">📚</span>
                            <span class="min-w-0">
                                <span class="block">All lessons</span>
                                <span class="block text-sm font-normal text-sk-muted">Stories, word sets and drills</span>
                            </span>
                        </button>
                        <button id="view-badges-btn" type="button" class="${x(w("secondary","block"),"justify-start text-left h-auto py-4")}">
                            <span class="text-2xl shrink-0" aria-hidden="true">🏅</span>
                            <span class="min-w-0">
                                <span class="block">Your badges</span>
                                <span class="block text-sm font-normal text-sk-muted">See what you have earned</span>
                            </span>
                        </button>
                    </div>
                </section>

                <section class="${x(g.cardTight,r>0?"streak-card":"")} flex items-center gap-4 sm:gap-5" aria-labelledby="progress-heading">
                    <span class="text-4xl sm:text-5xl shrink-0" aria-hidden="true">${r>0?"🔥":tt(e.progress.minutesTotal)}</span>
                    <div class="min-w-0">
                        <h2 id="progress-heading" class="${x("text-[1.15rem] font-bold m-0",r>0?"streak-heading":"")}">${r>0?`${r} day${r===1?"":"s"} in a row`:"Your progress"}</h2>
                        <p class="m-0 text-[0.95rem] text-sk-muted">${s>0?`You have practised for ${s} minute${s===1?"":"s"} altogether.`:"Finish your first lesson to start building a streak."}</p>
                    </div>
                </section>
            </div>`}function xn(e,t){const s=(e.runtime.targetText??"").split("").map((d,c)=>`<span class="char" data-idx="${c}">${v(d)}</span>`).join(""),r=!!e.runtime.flags?.keyboardHint,i=e.settings.fingerGuide,l=r?`<div id="keyboard-hint" class="${i?"finger-guide":""} p-2 bg-sk-subtle border border-sk-border rounded-xl select-none overflow-x-auto">${[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l",";"],["z","x","c","v","b","n","m",",","."]].map(d=>`<div class="keyboard-row flex justify-center">${d.map(c=>`<div class="key ${i?`finger-${rt[c]??""}`:""}" data-key="${c}">${c}</div>`).join("")}</div>`).join("")}<div class="keyboard-row flex justify-center"><div class="key space ${i?"finger-thumb":""}" data-key=" ">Space</div></div></div>`:"",p=i?`<div id="finger-hint" class="flex flex-col items-center gap-1">
                            <svg viewBox="0 0 160 38" class="w-[170px] sm:w-[200px] h-11" role="img" aria-label="Which finger to use next">
                                <circle cx="11" cy="27" r="7" class="finger" data-finger="lp"/>
                                <circle cx="24" cy="16" r="7" class="finger" data-finger="lr"/>
                                <circle cx="37" cy="11" r="7" class="finger" data-finger="lm"/>
                                <circle cx="50" cy="16" r="7" class="finger" data-finger="li"/>
                                <circle cx="64" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                                <circle cx="96" cy="27" r="8" class="finger thumb" data-finger="thumb"/>
                                <circle cx="110" cy="16" r="7" class="finger" data-finger="ri"/>
                                <circle cx="123" cy="11" r="7" class="finger" data-finger="rm"/>
                                <circle cx="136" cy="16" r="7" class="finger" data-finger="rr"/>
                                <circle cx="149" cy="27" r="7" class="finger" data-finger="rp"/>
                            </svg>
                            <span class="${g.eyebrow}">Finger to use</span>
                        </div>`:"",u=p||l?`<div class="flex flex-col items-center gap-4 mt-6">${p}${l}</div>`:"";return`
            <div id="typing-screen" class="screen active flex flex-col gap-4">
                <div class="sticky top-0 z-50 progress-track w-full h-2.5" role="progressbar" aria-label="Lesson progress">
                    <div id="typing-progress-bar" class="progress-bar h-full w-0"></div>
                </div>

                <div class="${g.card}">
                    <div class="flex items-center justify-between gap-3 mb-5">
                        <button id="exit-lesson-btn" type="button" class="${x(w("quiet","sm"),"shrink-0")}" title="Save and leave this lesson">
                            <span aria-hidden="true">←</span> Exit
                        </button>
                        <h1 class="text-[1.15rem] sm:text-[1.4rem] font-bold m-0 text-center min-w-0 truncate">${v(Oe(e.runtime.lesson?.data))}</h1>
                        <div class="shrink-0 min-w-[4.5rem] flex justify-end">
                            ${e.runtime.flags?.showTimerChip?'<div id="timer-chip" class="timer-chip text-[1.05rem] font-bold px-3 py-1.5 rounded-full" aria-live="off">--:--</div>':""}
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5 pb-4 border-b border-sk-border">
                        <button id="read-aloud-btn" type="button" class="${x(w("secondary","sm"),"read-aloud-btn")}" title="Listen to the words before you type">
                            <span aria-hidden="true">🔊</span> Read aloud
                        </button>
                        <div class="${g.buttonGroup}">
                            <label class="${g.toggle}"><input type="checkbox" id="lockstep-toggle" ${e.runtime.flags?.lockstep?"checked":""}><span class="slider"></span><span>${v(t.COPY.lockstepOn)}</span></label>
                            <label class="${g.toggle}"><input type="checkbox" id="focusline-toggle" ${e.runtime.flags?.focusLine?"checked":""}><span class="slider"></span><span>${v(t.COPY.focusLineOn)}</span></label>
                            <div id="caps-lock-indicator" class="caps-lock-indicator" title="Caps Lock is on">
                                <span class="caps-lock-led"></span>
                                <span>Caps</span>
                            </div>
                        </div>
                    </div>

                    <p class="panel-label" id="read-this-label"><span aria-hidden="true">👀</span> Read this</p>
                    <div id="typing-target" class="typing-target ${e.runtime.flags?.focusLine?"focus-line-active":""}" aria-describedby="read-this-label">${s}</div>

                    <p class="panel-label mt-5"><span aria-hidden="true">⌨️</span> <label for="typing-input">Type here</label></p>
                    <textarea id="typing-input" class="typing-input" rows="3" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>

                    ${u}
                </div>

                <div id="pause-overlay" class="pause-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                    <div class="${x(g.card,"text-center max-w-sm mx-4 p-8")}">
                        <div class="text-5xl mb-3" aria-hidden="true">⏸️</div>
                        <h2 id="pause-title" class="text-2xl mb-3">Paused</h2>
                        <p class="m-0 text-sk-muted">Press <kbd>Space</kbd> or <kbd>Esc</kbd> when you are ready to carry on.</p>
                    </div>
                </div>
            </div>`}function ue(e,t,n){return`<div class="text-center">
                            <p class="${g.eyebrow}">${v(e)}</p>
                            <p class="metric-value text-[2.1rem] sm:text-[2.5rem] m-0 mt-1">${t}</p>
                            ${n?`<p class="m-0 text-sm text-sk-muted">${v(n)}</p>`:""}
                        </div>`}function Sn(e,t){const n=e.runtime.summaryResults;if(!n)return"<h1>Error</h1>";const{accuracy:s,durationSec:r,errors:i,netWPM:a,grossWPM:l,hardestKeys:p,trickyWords:u,newBadges:d,isDrill:c,personalBest:h}=n,f=t.COPY.metricWPM||t.COPY.metricNetWPM||"Words per minute",y=typeof a=="number"?a:"—",$=typeof l=="number"?l:"—",L=!c&&(p.length>0||u.length>0)?`<button id="start-drill-btn" type="button" class="${w("secondary")}">${v(t.COPY.summaryDrill)}</button>`:"",b=E=>E===" "?"Space":E,k=s===100,P=!!(h&&!c&&(a>h.netWPM||s>h.accuracy));let I="";if(h&&!c){const E=a-h.netWPM,C=s-h.accuracy,_=(W,te,Q,q)=>{const ye=q>0?"🎉":q===0?"➡️":"↓";return`<div class="flex justify-center items-center gap-3 py-1 text-[0.95rem]">
                            <span class="text-sk-muted min-w-[8.5rem] text-right">${v(W)}: ${v(te)}</span>
                            <span aria-hidden="true">${ye}</span>
                            <span class="min-w-[8.5rem] text-left font-bold tabular-nums">${v(Q)}${q!==0?` (${q>0?"+":""}${q})`:""}</span>
                        </div>`};I=`
                    <div class="personal-best-comparison ${P?"new-best":"bg-sk-subtle border border-sk-border"} p-4 rounded-xl my-6 mx-auto max-w-md text-center">
                        <h3 class="m-0 mb-2 text-base">${P?"🏆 A new personal best!":"Compared with your best"}</h3>
                        ${_("Words per minute",String(h.netWPM),String(y),E)}
                        ${_("Accuracy",`${h.accuracy}%`,`${s}%`,C)}
                    </div>`}const A=e.runtime.wpmSamples||[],j=A.length>2?(()=>{const E=Math.max(...A,1),C=A.map((_,W)=>{const te=W/(A.length-1)*100,Q=30-_/E*28;return`${te},${Q}`}).join(" ");return`
                    <div class="my-6 p-4 bg-sk-subtle border border-sk-border rounded-xl">
                        <p class="${g.eyebrow}">Your speed through the lesson</p>
                        <svg class="w-full h-10 mt-2" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
                            <polyline fill="none" stroke="var(--sk-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${C}"/>
                        </svg>
                        <div class="flex justify-between text-xs text-sk-muted"><span>Start</span><span>End</span></div>
                    </div>`})():"",K=t.COPY.encourageGentle[Math.floor(Math.random()*t.COPY.encourageGentle.length)]??"",G=(E,C,_)=>`
                        <div>
                            <p class="${g.eyebrow}">${v(E)}</p>
                            <ul class="list-none p-0 m-0 mt-2 flex flex-wrap gap-2">${C.map(W=>`<li class="bg-sk-subtle border border-sk-border px-3 py-1 rounded-full font-semibold">${v(_(W))}</li>`).join("")}</ul>
                        </div>`;return`
            <div id="summary-screen" class="screen active flex flex-col gap-6 ${P||k?"show-confetti":""}">
                <div class="${x(g.card,"relative")}">
                    <div class="text-center">
                        <div class="text-5xl mb-2" aria-hidden="true">${k?"🌟":"👏"}</div>
                        <h1>${c?"Drill complete!":v(t.COPY.summaryNiceWork)}</h1>
                        <p class="${x(g.lead,"mx-auto")}">${v(K)}</p>
                    </div>

                    ${k?'<div class="perfect-banner mt-5">Every single letter correct!</div>':""}

                    ${d.length>0?`<div class="flex flex-col gap-3 mt-6">${d.map(E=>{const C=t.BADGES.find(_=>_.id===E);return C?`<div class="badge-earned relative flex items-center gap-4 p-4 rounded-xl text-left">
                            <span class="text-3xl shrink-0" aria-hidden="true">🏅</span>
                            <span class="min-w-0">
                                <span class="block font-bold">New badge: ${v(C.label)}</span>
                                <span class="block text-sm">${v(C.desc)}</span>
                            </span>
                        </div>`:""}).join("")}</div>`:""}

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-5 my-8">
                        ${ue(t.COPY.metricAccuracy,`${s}%`)}
                        ${ue(f,String(y),`${$} gross`)}
                        ${ue(t.COPY.metricTime,`${r}s`)}
                        ${ue(t.COPY.metricErrors,String(i))}
                    </div>

                    ${j}
                    ${I}

                    ${p.length>0||u.length>0?`
                    <div class="flex gap-8 flex-wrap justify-center mt-2">
                        ${p.length>0?G(t.COPY.summaryHardestKeys,p,b):""}
                        ${u.length>0?G(t.COPY.summaryTrickyWords,u,E=>E):""}
                    </div>`:""}

                    <div class="${x(g.buttonRowCenter,"mt-8")}">
                        ${c?"":`<button id="replay-btn" type="button" class="${w("primary")}">${v(t.COPY.summaryReplay)}</button>`}
                        ${L}
                        <button id="home-btn" type="button" class="${w("secondary")}">${v(t.COPY.summaryHome)}</button>
                    </div>
                    <p class="text-center text-sm text-sk-muted mt-5 m-0">Press <kbd>Enter</kbd> to try again, or <kbd>Esc</kbd> to go home.</p>
                </div>
            </div>`}function wn(e,t,n){switch(e){case"home":return vn(t);case"typing":return xn(t,n);case"summary":return Sn(t,n);default:return"<h1>Error</h1>"}}let R={searchTerm:"",sortKey:ie.DEFAULT_SORT_KEY,statusFilter:"all",currentPage:1,currentType:"passage",currentStage:"KS2"},me=null,ge=null,Pe=!1;function kn(){return R}function ke(e){return"text"in e&&e.text?e.text.length:"words"in e&&e.words?e.words.join(" ").length:"items"in e&&e.items?e.items.join(" ").length:0}function Tn(e,t,n){if(n==="phonics")return;const s=document.querySelectorAll(".stage-filter [data-stage]");s.length&&s.forEach(r=>{if(!(r instanceof HTMLElement))return;const i=r.dataset.stage;if(!i)return;const a=Ft(e,t,n,i);let l=r.querySelector(".stage-progress");l||(l=document.createElement("span"),l.className="stage-progress inline-block ml-1 px-1.5 py-0.5 rounded-full bg-sk-subtle text-xs",r.appendChild(l)),l.textContent=`${a}%`,l instanceof HTMLElement&&(l.title=`Average completion for ${i}`)})}function En(e,t,n){const{currentType:s,currentStage:r,searchTerm:i,sortKey:a,statusFilter:l,currentPage:p}=e,d={passage:n.PASSAGES,phonics:n.PHONICS,spelling:n.SPELLING,wordset:n.WORDSETS,drill:n.PASSAGES}[s]||n.PASSAGES;let h=s!=="phonics"?d.filter(b=>!b.stage||b.stage===r):[...d];if(i){const b=i.toLowerCase();h=h.filter(k=>("title"in k&&k.title||"name"in k&&k.name||"").toLowerCase().includes(b)||("theme"in k&&k.theme||"").toLowerCase().includes(b))}l&&l!=="all"&&(h=h.filter(b=>{const k=le(s,b),P=Le(t,k);return l==="complete"?P===100:l==="todo"?P<100:!0})),h.sort((b,k)=>{if(a==="length")return ke(b)-ke(k);if(a==="theme"){const A="theme"in b&&b.theme||"",j="theme"in k&&k.theme||"";return A.localeCompare(j)}const P="title"in b&&b.title||"name"in b&&b.name||"",I="title"in k&&k.title||"name"in k&&k.name||"";return P.localeCompare(I)});const f=Math.max(1,Math.ceil(h.length/ie.LESSONS_PER_PAGE)),y=(p-1)*ie.LESSONS_PER_PAGE;return{items:h.slice(y,y+ie.LESSONS_PER_PAGE).map(b=>{const k=ke(b),P="words"in b&&b.words?b.words.length:Math.round(k/5),I=le(s,b),A=Le(t,I),j=b.tags?.complexity??{caps:!0,punct:!0},K="text"in b&&b.text||("words"in b&&b.words?b.words.slice(0,15).join(" "):""),G=K.slice(0,100)+(K.length>100?"…":""),E="theme"in b?b.theme:void 0,C="title"in b&&b.title||"name"in b&&b.name||b.id||"Lesson";return{id:b.id??"",type:s,lessonId:I,title:C,theme:E,icon:E&&gn[E]||"📝",lenDisplay:`≈ ${k} chars / ${P} words`,completionPercent:A,completionLabel:A===100?"Completed ✓":`${A}% complete`,isComplete:A===100,isLastVisited:Ot(t,I),hasCaps:!!j.caps,hasPunct:!!j.punct,preview:G}}),currentPage:p,totalPages:f,totalFiltered:h.length,hasNextPage:p<f,hasPrevPage:p>1,currentType:s,currentStage:r,lastLessonId:t.meta.lastLessonId||null}}function $n(e){const t=document.querySelector(".lesson-list");t&&(e.items.length===0?t.innerHTML=`<div class="text-center p-10">
            <div class="text-4xl mb-3" aria-hidden="true">🔍</div>
            <p class="m-0 mx-auto text-sk-muted">Nothing matched. Try a different search or key stage.</p>
        </div>`:t.innerHTML=e.items.map(n=>`
            <div class="lesson-item flex gap-3 items-center p-3 rounded-xl mb-1 hover:bg-sk-subtle" data-id="${n.id}" data-type="${n.type}" data-lesson-id="${n.lessonId}" title="${v(n.preview)}">
                <div class="text-2xl shrink-0" aria-hidden="true">${n.icon}</div>
                <div class="grow min-w-0">
                    <b class="block">${v(n.title)}</b>
                    <div class="flex gap-1.5 font-normal text-xs text-sk-muted mt-1 flex-wrap items-center">
                        ${n.theme?`<span class="meta-chip">${v(n.theme)}</span>`:""}
                        <span class="meta-chip">${n.lenDisplay}</span>
                        ${n.hasCaps?'<span class="meta-chip" title="Includes capital letters">Aa</span>':""}
                        ${n.hasPunct?'<span class="meta-chip" title="Includes punctuation">.,!</span>':""}
                        <span class="meta-chip ${n.isComplete?"complete-chip":"progress-chip"}">${n.isComplete?"✓ Finished":n.completionLabel}</span>
                        ${n.isLastVisited?'<span class="font-bold text-sk-accent">← Last visited</span>':""}
                    </div>
                </div>
                <button type="button" class="${w("primary","sm")} shrink-0" data-start="true">Start</button>
            </div>
        `).join(""),t.classList.remove("loading"))}function Ln(e){const t=document.querySelector(".pagination-controls");if(!t)return;const n=e.totalPages<=1,s=n?`${e.totalFiltered} lesson${e.totalFiltered===1?"":"s"}`:`Page ${e.currentPage} of ${e.totalPages}`;t.innerHTML=`
        <button type="button" class="${w("secondary","sm")}" data-action="prev-page" ${!e.hasPrevPage||n?"disabled":""}>← Back</button>
        <span class="text-sm text-sk-muted tabular-nums">${s}</span>
        <button type="button" class="${w("secondary","sm")}" data-action="next-page" ${!e.hasNextPage||n?"disabled":""}>Next →</button>
    `}function Ae(e,t){me=t,ge=e;const n=En(R,t,e);if(R._totalPages=n.totalPages,Tn(t,e,n.currentType),$n(n),Ln(n),!Pe&&n.lastLessonId){const r=document.querySelector(".lesson-list")?.querySelector(`[data-lesson-id="${n.lastLessonId}"]`);r&&(r.scrollIntoView({block:"center",behavior:"smooth"}),Pe=!0)}}function Pn(e){!ge||!me||(e==="prev-page"&&R.currentPage>1?(R.currentPage--,Ae(ge,me)):e==="next-page"&&R.currentPage<(R._totalPages??1)&&(R.currentPage++,Ae(ge,me)))}function An(e,t,n){e.sortKey&&(["title","length","theme"].includes(e.sortKey)||delete e.sortKey),e.statusFilter&&(["all","complete","todo"].includes(e.statusFilter)||delete e.statusFilter),Object.assign(R,e),Ae(n,t)}function Cn(e){R={searchTerm:"",sortKey:ie.DEFAULT_SORT_KEY,statusFilter:"all",currentPage:1,currentType:"passage",currentStage:e},Pe=!1}const o=Jt(),Te=He((e,t)=>{const n=e.runtime.lesson?.data&&"id"in e.runtime.lesson.data?e.runtime.lesson.data.id:void 0,s=e.runtime.lesson?.type,r=e.runtime.lesson?.data;n&&s&&r&&t.length>0&&Xe(n,s,t,r)},2e3);function X(){tn(o)}function Ee(e,t){const n={spelling:"completedSpellings",phonics:"completedPhonics",wordset:"completedWordsets",passage:"completedPassages",drill:"completedPassages"},s=new Set(o.progress[n[t]]),r=e.filter(l=>l.id&&!s.has(l.id));if(r.length)return r[Math.floor(Math.random()*r.length)]??null;const i=o.sessions.filter(l=>l.contentType===t);if(!i.length)return e.length?e[Math.floor(Math.random()*e.length)]??null:null;const a=new Map;return i.forEach(l=>a.set(l.contentId,new Date(l.ts).getTime())),[...e].sort((l,p)=>(a.get(l.id??"")||0)-(a.get(p.id??"")||0))[0]||null}function O(e){st(o.runtime),Ie(),o.ui.currentScreen=e;const t=m("main-content");t&&(t.innerHTML=wn(e,o,T),On(e),window.scrollTo(0,0))}let z=null;function H(e,t={}){z&&(clearTimeout(z),z=null),o.ui.modal||(o.ui.lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null),o.ui.modal=e;const n=m("modal-container");if(!n)return;n.innerHTML=mn(e,o,T),e==="lessonPicker"&&Cn(o.settings.defaultStage),document.body.classList.add("modal-open");const s=n.querySelector(".modal");if(!(s instanceof HTMLElement))return;Kn(e),s.classList.add("active");const r=s.querySelector("[data-autofocus]"),i=s.querySelector(".modal-content");if(r?r.focus():i&&(i.tabIndex=-1,i.focus()),t.scrollToId){const a=s.querySelector(`#${t.scrollToId}`);a&&a.scrollIntoView({behavior:"smooth",block:"start"})}}function F(){const e=m("modal-container"),t=e?.querySelector(".modal");if(!t){document.body.classList.remove("modal-open"),o.ui.modal=null;return}o.ui.modal==="welcome"&&sn(o,X),t.classList.remove("active"),document.body.classList.remove("modal-open"),z&&clearTimeout(z);const n=o.ui.lastFocus;z=setTimeout(()=>{if(z=null,e&&(e.innerHTML=""),o.ui.modal=null,n&&typeof n.focus=="function")try{n.focus()}catch{}},200)}function Mn(){const e=m("typing-input"),t=e?e.value:"",n=o.runtime.lesson?.data&&"id"in o.runtime.lesson.data?o.runtime.lesson.data.id:void 0,s=o.runtime.lesson?.type,r=o.runtime.lesson?.data;n&&s&&r&&(Xe(n,s,t,r),t.length>0&&D("Draft saved. You can resume later."))}function ot(){return confirm("Exit lesson? Your progress will be saved as a draft.")?(Mn(),O("home"),!0):!1}function J(e){Ke(e,o,O,X)}function In(){m("about-btn")?.addEventListener("click",()=>{if(F(),o.ui.currentScreen==="typing"){ot();return}O("home")}),m("help-btn")?.addEventListener("click",()=>H("help")),m("start-here-btn")?.addEventListener("click",()=>H("welcome")),m("settings-btn")?.addEventListener("click",()=>H("settings")),m("parent-btn")?.addEventListener("click",()=>{o.settings.pin?H("pin"):H("parent")}),m("footer-privacy-link")?.addEventListener("click",()=>{H("help",{scrollToId:"help-data-privacy"})}),window.addEventListener("keydown",e=>{e.key==="Escape"&&o.ui.modal&&(e.preventDefault(),F())}),window.addEventListener("blur",()=>{o.ui.currentScreen==="typing"&&o.runtime.timer?.started&&!o.runtime.timer.paused&&(o.runtime.timer.paused=!0,o.runtime.pauseStartTime=new Date,o.runtime._autoPaused=!0)}),window.addEventListener("focus",()=>{if(o.runtime._autoPaused&&o.runtime.timer){if(o.runtime.pauseStartTime&&o.runtime.startTime){const e=Date.now()-o.runtime.pauseStartTime.getTime();o.runtime.startTime=new Date(o.runtime.startTime.getTime()+e)}o.runtime.timer.paused=!1,o.runtime._autoPaused=!1}})}function Dn(){m("resume-draft-btn")?.addEventListener("click",()=>{const e=Qe();if(e?.lessonData&&ae(e.lessonType)){const t=()=>{setTimeout(()=>{const n=m("typing-input");n&&(n.value=e.typedText,n.dispatchEvent(new Event("input",{bubbles:!0})))},100)};Ke({type:e.lessonType,data:e.lessonData},o,n=>{O(n),n==="typing"&&t()},X)}}),m("discard-draft-btn")?.addEventListener("click",()=>{oe(),O("home"),D("Draft discarded.")}),m("new-story-card")?.addEventListener("click",async e=>{const t=e.target;if(!(t instanceof HTMLElement))return;const n=t.closest("[data-stage]");if(n instanceof HTMLElement&&n.dataset.stage){const r=n.dataset.stage;D(`Finding a new ${r} story...`),await Ne(r);const i=Ee(T.PASSAGES.filter(a=>a.stage===r),"passage");if(!i){D(`No ${r} passages are available yet. Please try another stage.`);return}J({type:"passage",data:i});return}const s=t.closest("[data-spelling-stage]");if(s instanceof HTMLElement&&s.dataset.spellingStage){const r=s.dataset.spellingStage,i=T.SPELLING.filter(l=>l.stage===r);if(!i.length){D(`No spelling lists found for ${r} yet. Please try another stage.`);return}const a=Ee(i,"spelling");if(!a){D(`No fresh spelling lists found for ${r}. Please try another stage.`);return}J({type:"spelling",data:a})}}),m("phonics-mode-btn")?.addEventListener("click",()=>{if(!T.PHONICS.length){D("Phonics passages are still loading. Please try again in a moment.");return}const e=Ee(T.PHONICS,"phonics");if(!e){D("No phonics passages available yet. Please try again later.");return}J({type:"phonics",data:e})}),m("browse-lessons-btn")?.addEventListener("click",()=>H("lessonPicker")),m("view-badges-btn")?.addEventListener("click",()=>H("badges")),document.querySelector(".recent-lessons-list")?.addEventListener("click",async e=>{const t=e.target instanceof Element?e.target.closest(".recent-lesson-btn"):null;if(!(t instanceof HTMLElement))return;const n=t.dataset.recentId,s=t.dataset.recentType,r=t.dataset.recentStage;if(!n||!s)return;const i=await St(s,n,r);i&&ae(s)?J({type:s,data:i}):D("Could not find that lesson. It may have been removed.")})}function _n(){requestAnimationFrame(()=>Ye(o));const e=He(()=>Ye(o),250);window.addEventListener("resize",e),o.runtime._cleanupResize=()=>window.removeEventListener("resize",e),m("exit-lesson-btn")?.addEventListener("click",()=>{ot()});const t=m("typing-input"),n=m("typing-progress-bar"),s=m("pause-overlay"),r=m("caps-lock-indicator");if(!t)return;const i=c=>{r&&c.getModifierState&&r.classList.toggle("active",c.getModifierState("CapsLock"))};t.addEventListener("keydown",i),t.addEventListener("keyup",i),o.runtime.wpmSamples=[],o.runtime.wpmSampleInterval=null;const a=c=>{Te.cancel(),oe(),o.runtime.wpmSampleInterval&&clearInterval(o.runtime.wpmSampleInterval),qe(c,o,T,O,X)},l=()=>{if(n&&o.runtime.targetTextNorm){const c=t.value.length,h=o.runtime.targetTextNorm.length;n.style.width=`${Math.min(100,c/h*100)}%`}};t.addEventListener("input",c=>{Ut(c,o,T,a),l(),Te(o,t.value),!o.runtime.wpmSampleInterval&&o.runtime.timer?.started&&(o.runtime.wpmSampleInterval=setInterval(()=>{if(o.runtime.startTime&&!o.runtime.timer?.paused){const h=(Date.now()-o.runtime.startTime.getTime())/1e3;h>0&&(o.runtime.wpmSamples=o.runtime.wpmSamples??[],o.runtime.wpmSamples.push(Math.round(t.value.length/5/h*60)))}},3e3))}),t.addEventListener("paste",c=>{c.preventDefault(),D(T.COPY.pasteBlocked)}),m("lockstep-toggle")?.addEventListener("change",c=>{o.runtime.flags&&c.target instanceof HTMLInputElement&&(o.runtime.flags.lockstep=c.target.checked)}),m("focusline-toggle")?.addEventListener("change",c=>{o.runtime.flags&&c.target instanceof HTMLInputElement&&(o.runtime.flags.focusLine=c.target.checked,m("typing-target")?.classList.toggle("focus-line-active",c.target.checked))});const p=()=>{if(!o.runtime.timer?.started)return;const c=!o.runtime.timer.paused;if(o.runtime.timer.paused=c,s?.classList.toggle("hidden",!c),c)t.blur(),o.runtime.pauseStartTime=new Date;else{if(o.runtime.pauseStartTime&&o.runtime.startTime){const h=Date.now()-o.runtime.pauseStartTime.getTime();o.runtime.startTime=new Date(o.runtime.startTime.getTime()+h)}t.focus()}},u=c=>{o.ui.modal||(c.key==="Escape"?o.runtime.timer?.started&&p():c.key===" "&&o.runtime.timer?.paused&&(c.preventDefault(),p()))};window.addEventListener("keydown",u),o.runtime._cleanupPauseHandler=()=>window.removeEventListener("keydown",u);const d=m("read-aloud-btn");if(d&&(Ue()?d.addEventListener("click",()=>{mt()?(Ie(),d.textContent="🔊 Read Aloud",d.classList.remove("speaking")):o.runtime.targetText&&(d.textContent="⏹️ Stop",d.classList.add("speaking"),pt(o.runtime.targetText,()=>{d.textContent="🔊 Read Aloud",d.classList.remove("speaking")},null,{gender:o.settings.voiceGender,speed:o.settings.voiceSpeed}))}):(d instanceof HTMLButtonElement&&(d.disabled=!0),d.title="Text-to-speech not available in this browser")),t.focus(),o.runtime.flags?.timer&&o.runtime.timer){const c=m("timer-chip");c&&(c.textContent=o.runtime.flags.countdownTimer?ce(o.runtime.timer.remaining):ce(0),c.title="Timer starts when you begin typing"),o.runtime.timer.tick=()=>{if(o.runtime.timer?.paused)return;const h=f=>{Te.cancel(),oe(),qe(f,o,T,O,X)};if(o.runtime.flags?.countdownTimer&&o.runtime.timer){if(o.runtime.timer.remaining--,c&&(c.textContent=ce(o.runtime.timer.remaining)),o.runtime.timer.remaining<=0){o.runtime.timer.handle&&clearInterval(o.runtime.timer.handle);const f=m("typing-input");h(f?f.value:"")}}else c&&o.runtime.startTime&&(c.textContent=ce(Math.floor((Date.now()-o.runtime.startTime.getTime())/1e3)))}}}function Nn(){const e=m("replay-btn");e?.addEventListener("click",()=>{o.runtime.lesson&&J(o.runtime.lesson)}),m("start-drill-btn")?.addEventListener("click",()=>Vt(o,T,O,X)),m("home-btn")?.addEventListener("click",()=>O("home"));const t=o.runtime.summaryResults;t&&((t.newBadges?.length??0)>0||t.accuracy>=95||t.personalBest&&(t.netWPM>t.personalBest.netWPM||t.accuracy>t.personalBest.accuracy))&&!o.settings.reduceMotion&&Bt();const s=r=>{r.key==="Enter"&&e&&!o.runtime.summaryResults?.isDrill&&o.runtime.lesson?J(o.runtime.lesson):r.key==="Escape"&&O("home")};window.addEventListener("keydown",s),o.runtime._cleanupSummaryKeys=()=>window.removeEventListener("keydown",s)}function On(e){e==="home"&&Dn(),e==="typing"&&_n(),e==="summary"&&Nn()}function Hn(){const e=m("modal-container");if(!e)return;const t=e.querySelector(".stage-filter"),n=m("search-input"),s=m("sort-select"),r=m("status-filter"),i=e.querySelector(".lesson-list");if(!(t instanceof HTMLElement)||!n||!s||!r||!(i instanceof HTMLElement))return;const a=u=>{const d=u==="phonics";t.classList.toggle("disabled",d),t.querySelectorAll("button").forEach(c=>{c.disabled=d})},l=async u=>{i.classList.add("loading"),u.currentStage&&await Ne(u.currentStage),setTimeout(()=>An(u,o,T),50)};e.querySelectorAll(".tab-button").forEach(u=>u.addEventListener("click",d=>{e.querySelector(".tab-button.active")?.classList.remove("active"),d.currentTarget instanceof HTMLElement&&d.currentTarget.classList.add("active");const c=d.currentTarget instanceof HTMLElement?d.currentTarget.dataset.type:void 0;!c||!ae(c)||(a(c),l({currentType:c,currentPage:1}))})),t.querySelectorAll("[data-stage]").forEach(u=>u.addEventListener("click",d=>{const c=d.target instanceof Element?d.target.closest("[data-stage]"):null;if(!(c instanceof HTMLButtonElement)||c.disabled)return;const h=c.dataset.stage;if(!h)return;const f=t.querySelector(".active");f instanceof HTMLElement&&f.dataset.stage===h||(f?.classList.remove("active"),c.classList.add("active"),l({currentStage:h,currentPage:1}))})),n.addEventListener("input",He(()=>{l({searchTerm:n.value,currentPage:1})},300)),s.addEventListener("change",()=>{const u=s.value;(u==="title"||u==="length"||u==="theme")&&l({sortKey:u,currentPage:1})}),r.addEventListener("change",()=>{const u=r.value;(u==="all"||u==="complete"||u==="todo")&&l({statusFilter:u,currentPage:1})}),i.addEventListener("click",u=>{const d=u.target instanceof Element?u.target.closest("[data-start]"):null;if(!d)return;const c=d.closest(".lesson-item");if(!(c instanceof HTMLElement))return;const{id:h,type:f}=c.dataset;if(!h||!f)return;const y=pe(f,h);y&&ae(f)&&(F(),J({type:f,data:y}))}),e.querySelector(".pagination-controls")?.addEventListener("click",u=>{const d=u.target instanceof HTMLElement?u.target.dataset.action:void 0;d&&Pn(d)}),t.querySelector(`[data-stage="${o.settings.defaultStage}"]`)?.classList.add("active");const p=kn();a(p.currentType),l({currentStage:p.currentStage})}function Rn(){const e=o.settings,t=(i,a)=>{const l=m(i);l instanceof HTMLInputElement?l.type==="checkbox"?l.checked=!!a:l.value=String(a):l instanceof HTMLSelectElement&&(l.value=String(a))};t("setting-theme",e.theme),t("setting-font",e.font),t("setting-line-height",e.lineHeight),t("setting-letter-spacing",e.letterSpacing),t("setting-lockstep",e.lockstepDefault),t("setting-focusline",e.focusLineDefault),t("setting-keyboard",e.keyboardHintDefault),t("setting-timer-display",e.showTimerDisplay),t("setting-sound",e.soundEnabled),t("setting-finger-guide",e.fingerGuide),t("setting-reduce-motion",e.reduceMotion),t("setting-voice-gender",e.voiceGender),t("setting-voice-speed",e.voiceSpeed),t("setting-default-stage",e.defaultStage);const n=m("lh-val"),s=m("ls-val"),r=m("vs-val");n&&(n.textContent=String(e.lineHeight)),s&&(s.textContent=`+${e.letterSpacing}%`),r&&(r.textContent=`${Math.round((e.voiceSpeed??.85)*100)}%`),m("setting-line-height")?.addEventListener("input",i=>{n&&i.target instanceof HTMLInputElement&&(n.textContent=i.target.value)}),m("setting-letter-spacing")?.addEventListener("input",i=>{s&&i.target instanceof HTMLInputElement&&(s.textContent=`+${i.target.value}%`)}),m("setting-voice-speed")?.addEventListener("input",i=>{r&&i.target instanceof HTMLInputElement&&(r.textContent=`${Math.round(Number(i.target.value)*100)}%`)}),m("save-settings-btn")?.addEventListener("click",async()=>{const i=m("setting-theme")?.value,a=m("setting-font")?.value,l=m("setting-default-stage")?.value,p=m("setting-voice-gender")?.value;(i==="cream"||i==="light"||i==="dark")&&(e.theme=i),(a==="default"||a==="dyslexia"||a==="opendyslexic")&&(e.font=a),Je(l)&&(e.defaultStage=l),(p==="female"||p==="male")&&(e.voiceGender=p),e.lineHeight=parseFloat(m("setting-line-height")?.value??"")||1.7,e.letterSpacing=parseInt(m("setting-letter-spacing")?.value??"",10),Number.isNaN(e.letterSpacing)&&(e.letterSpacing=2),e.lockstepDefault=!!m("setting-lockstep")?.checked,e.focusLineDefault=!!m("setting-focusline")?.checked,e.keyboardHintDefault=!!m("setting-keyboard")?.checked,e.showTimerDisplay=!!m("setting-timer-display")?.checked,e.soundEnabled=!!m("setting-sound")?.checked,e.fingerGuide=!!m("setting-finger-guide")?.checked,e.reduceMotion=!!m("setting-reduce-motion")?.checked,e.voiceSpeed=parseFloat(m("setting-voice-speed")?.value??""),Number.isNaN(e.voiceSpeed)&&(e.voiceSpeed=.85);const u=m("setting-pin")?.value??"";/^\d{4}$/.test(u)&&(e.pin=await et(u)),nt(e,o.progress),X(),F()})}function Kn(e){const n=m("modal-container")?.querySelector(".modal"),s=n?.querySelector(".modal-content");if(!(n instanceof HTMLElement)||!(s instanceof HTMLElement))return;n.querySelector("#close-modal-btn")?.addEventListener("click",()=>F()),n.addEventListener("click",i=>{i.target===n&&F()});const r=Array.from(s.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));if(r.length>0){const i=r[0],a=r[r.length-1];s.addEventListener("keydown",l=>{l.key!=="Tab"||!i||!a||(l.shiftKey&&document.activeElement===i?(l.preventDefault(),a.focus()):!l.shiftKey&&document.activeElement===a&&(l.preventDefault(),i.focus()))})}if(e==="lessonPicker"&&Hn(),e==="welcome"&&m("welcome-start-btn")?.addEventListener("click",()=>F()),e==="settings"&&Rn(),e==="parent"&&(m("export-btn")?.addEventListener("click",()=>{const i=new Date().toISOString().slice(0,16).replace(/[T:]/g,"-"),a=JSON.stringify({_v:ze,appVersion:gt,state:o},null,2),l=new Blob([a],{type:"application/json"}),p=URL.createObjectURL(l),u=document.createElement("a");u.href=p,u.download=`storykeys-backup-${i}.json`,u.click(),URL.revokeObjectURL(p)}),m("clear-data-btn")?.addEventListener("click",()=>{confirm("Really clear all progress? This cannot be undone.")&&(Tt(),location.reload())})),e==="badges"&&m("print-certificate-btn")?.addEventListener("click",()=>jt(o,T)),e==="pin"){const i=m("pin-input"),a=async()=>{const l=i?.value??"";!!(o.settings.pin&&await et(l)===o.settings.pin)?(F(),H("parent")):(alert("Incorrect PIN."),i&&(i.value="",i.focus()))};i?.addEventListener("input",()=>{i.value.length===4&&a()}),m("pin-submit-btn")?.addEventListener("click",()=>{a()})}}async function Wn(){const e=m("loading-overlay"),t=m("app-container"),n=m("loading-error");try{await bt(),nn(o),localStorage.getItem(fe)||window.matchMedia("(prefers-color-scheme: dark)").matches&&(o.settings.theme="dark"),nt(o.settings,o.progress),O("home"),In(),rn(o)&&H("welcome"),e&&(e.style.opacity="0"),t?.classList.remove("hidden"),setTimeout(()=>{e&&(e.style.display="none")},300)}catch(s){console.error("Initialization failed:",s),n&&(n.textContent="Data failed to load. Please check your connection and refresh the page.",n.classList.remove("hidden"))}}document.addEventListener("DOMContentLoaded",()=>{Wn()});
