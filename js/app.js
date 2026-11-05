(function(){
'use strict';
/* ---------- helpers ---------- */
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var md=function(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>').replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,'$1')};
var D={1:'Ingestion & Transformation',2:'Data Store Management',3:'Operations & Support',4:'Security & Governance'};
var W={1:34,2:26,3:22,4:18};
var pct=function(a,b){return b?Math.round(100*a/b):0};
var shuffle=function(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a};
var fmtDate=function(t){return new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
var trunc=function(s,n){return s.length>n?s.slice(0,n-1)+'…':s};

/* ---------- storage ---------- */
var KEY='dea-study-v1', QKEY='dea-questions-v1', SKEY='dea-session-v1';
var S=loadState();
function loadState(){try{var r=JSON.parse(localStorage.getItem(KEY));if(r&&r.attempts)return r}catch(e){}return {v:1,attempts:[],sessions:[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- data ---------- */
var QS=[],SETS=[],SRC='none';
(function(){
  if(window.DEA_QUESTIONS&&window.DEA_QUESTIONS.length){QS=window.DEA_QUESTIONS;SETS=window.DEA_SETS||[];SRC='bundled';}
  else{try{var r=JSON.parse(localStorage.getItem(QKEY));if(r&&r.questions&&r.questions.length){QS=r.questions;SETS=r.sets||[];SRC='imported'}}catch(e){}}
  if(QS.length&&!SETS.length){var ids=QS.map(function(q){return q.id});for(var i=0;i<ids.length;i+=10)SETS.push(ids.slice(i,i+10))}
})();
var QM={};QS.forEach(function(q){QM[q.id]=q});
var CS=window.DEA_CONCEPTS||[];var CM={};CS.forEach(function(c){CM[c.id]=c});

function stats(){
  var m={};
  S.attempts.forEach(function(a){
    var s=m[a.q]||(m[a.q]={n:0,right:0,wrong:0,lastOk:null,lastT:0});
    s.n++;a.ok?s.right++:s.wrong++;
    if(a.t>=s.lastT){s.lastT=a.t;s.lastOk=a.ok}
  });
  return m;
}
function needsWork(q,st){var s=st[q.id];return s?s.lastOk===false:q.p==='w'}

/* ---------- session ---------- */
var SESS=null,LAST=null;
try{SESS=JSON.parse(sessionStorage.getItem(SKEY))}catch(e){}
function saveSess(){try{sessionStorage.setItem(SKEY,JSON.stringify(SESS))}catch(e){}}
function pickSmart(pool,n){
  var st=stats();
  var sc=pool.map(function(q){
    var s=st[q.id],w;
    if(!s)w=q.p==='w'?4:q.p==='s'?3:2.5;
    else if(s.lastOk===false)w=6+Math.min(s.wrong,3);
    else if(s.wrong>0)w=2;else w=0.5;
    return [w+Math.random()*1.5,q.id];
  });
  sc.sort(function(a,b){return b[0]-a[0]});
  return sc.slice(0,n).map(function(x){return x[1]});
}
var FLASH='';
function startSession(mode){
  var ids=[],label='';
  var st=stats();
  if(mode==='smart'){ids=pickSmart(QS,10);label='Quick 10'}
  else if(/^d[1-4]$/.test(mode)){var d=+mode[1];ids=pickSmart(QS.filter(function(q){return q.d===d}),10);label='Domain '+d+': '+D[d]}
  else if(/^set-\d+$/.test(mode)){var k=+mode.slice(4);ids=(SETS[k-1]||[]).slice();label='Set '+k}
  else if(mode==='mistakes'){ids=pickSmart(QS.filter(function(q){return needsWork(q,st)}),10);label='Mistakes'}
  else if(/^tag-/.test(mode)){var t=mode.slice(4);ids=pickSmart(QS.filter(function(q){return (q.tags||[]).indexOf(t)>-1}),10);label='Practice: '+(CM[t]?CM[t].name:t)}
  if(!ids.length){FLASH='No questions available for that choice yet.';location.hash='#/';route();return}
  SESS={id:Date.now(),mode:mode,label:label,qids:ids,i:0,answers:{},order:{},picked:[],checked:false};
  saveSess();
  if(location.hash==='#/quiz')route();else location.hash='#/quiz';
}
function curQ(){return QM[SESS.qids[SESS.i]]}
function orderFor(q){
  if(!SESS.order[q.id]){SESS.order[q.id]=shuffle(q.o.map(function(_,i){return i}));saveSess()}
  return SESS.order[q.id];
}
function nCorrect(q){return q.o.filter(function(o){return o.c}).length}
function check(){
  var q=curQ();if(SESS.checked||!SESS.picked.length)return;
  var right=q.o.map(function(o,i){return o.c?i:-1}).filter(function(i){return i>=0});
  var got=SESS.picked.slice().sort();
  var ok=got.length===right.length&&got.every(function(v,i){return v===right.slice().sort()[i]});
  SESS.checked=true;SESS.answers[q.id]={a:SESS.picked.slice(),ok:ok};
  S.attempts.push({q:q.id,t:Date.now(),a:SESS.picked.slice(),ok:ok,s:SESS.id});
  save();saveSess();route();
}
function next(){
  if(!SESS.checked)return;
  if(SESS.i+1>=SESS.qids.length){
    var okc=SESS.qids.filter(function(id){return SESS.answers[id]&&SESS.answers[id].ok}).length;
    var rec={id:SESS.id,t:Date.now(),mode:SESS.mode,label:SESS.label,total:SESS.qids.length,ok:okc};
    S.sessions.push(rec);save();
    LAST={rec:rec,qids:SESS.qids,answers:SESS.answers};
    SESS=null;try{sessionStorage.removeItem(SKEY)}catch(e){}
    location.hash='#/results';route();return;
  }
  SESS.i++;SESS.picked=[];SESS.checked=false;saveSess();route();window.scrollTo(0,0);
}
function toggleOpt(i){
  if(!SESS||SESS.checked)return;
  var q=curQ(),multi=nCorrect(q)>1,p=SESS.picked,at=p.indexOf(i);
  if(multi){if(at>-1)p.splice(at,1);else p.push(i)}else SESS.picked=[i];
  saveSess();route();
}

/* ---------- views ---------- */
function navHtml(page){
  var st=stats(),nw=QS.filter(function(q){return needsWork(q,st)}).length;
  var items=[['','Home'],['mistakes','Mistakes'+(nw?' ('+nw+')':'')],['concepts','Concepts'],['progress','Progress'],['data','Data']];
  $('#nav').innerHTML=items.map(function(x){return '<a href="#/'+x[0]+'"'+(page===x[0]?' class="on" aria-current="page"':'')+'>'+x[1]+'</a>'}).join('');
}
function setMain(h){$('#main').innerHTML=h}
function tagHtml(d){return '<span class="tag d'+d+'">'+esc(D[d])+'</span>'}

function viewHome(){
  var st=stats();
  var seen=QS.filter(function(q){return st[q.id]}).length;
  var right=0,tot=0;S.attempts.forEach(function(a){tot++;if(a.ok)right++});
  var nw=QS.filter(function(q){return needsWork(q,st)}).length;
  var h='';
  if(FLASH){h+='<div class="callout warn">'+esc(FLASH)+'</div>';FLASH=''}
  if(!QS.length){
    return h+'<div class="card"><h1>Welcome</h1><p>No questions are loaded yet. Go to <a href="#/data">Data</a> and import your questions file (<code>questions-import.json</code>). You can still read the <a href="#/concepts">Concepts</a> now.</p></div>';
  }
  h+='<h1>Study</h1><div class="stats"><div class="stat"><b>'+seen+'/'+QS.length+'</b><span class="muted small">questions seen</span></div>'
    +'<div class="stat"><b>'+(tot?pct(right,tot)+'%':'–')+'</b><span class="muted small">answered correctly</span></div>'
    +'<div class="stat"><b>'+nw+'</b><span class="muted small">need work</span></div></div>';
  if(SESS&&SESS.qids&&SESS.i<SESS.qids.length)h+='<div class="card row"><div class="grow"><b>Unfinished: '+esc(SESS.label)+'</b><div class="muted small">Question '+(SESS.i+1)+' of '+SESS.qids.length+'</div></div><a class="btn" href="#/quiz">Continue</a></div>';
  h+='<div class="card"><h2>Quick 10</h2><p class="muted">Ten questions, favouring ones you missed or have not seen.</p><button class="btn big" data-act="start" data-mode="smart">Start</button></div>';
  h+='<div class="card"><h2>By domain</h2><div class="domgrid">'+[1,2,3,4].map(function(d){
    var qd=QS.filter(function(q){return q.d===d}),a=0,r=0;S.attempts.forEach(function(x){if(QM[x.q]&&QM[x.q].d===d){a++;if(x.ok)r++}});
    return '<button class="dombtn d'+d+'" data-act="start" data-mode="d'+d+'"><b>Domain '+d+'</b> · '+W[d]+'% of exam<small>'+esc(D[d])+' · '+(a?pct(r,a)+'% correct':'not started')+'</small></button>'}).join('')+'</div></div>';
  var best={};S.sessions.forEach(function(s){if(/^set-/.test(s.mode)){var k=s.mode;if(!best[k]||s.ok>best[k].ok)best[k]=s}});
  h+='<div class="card"><h2>Sets of ten</h2><p class="muted small">Fixed sets, mixed across domains. Your best score is shown.</p><div class="sets">'+SETS.map(function(s,i){
    var b=best['set-'+(i+1)];
    return '<button class="setbtn'+(b?' done':'')+'" data-act="start" data-mode="set-'+(i+1)+'">'+(i+1)+'<small>'+(b?b.ok+'/'+b.total:s.length+' q')+'</small></button>'}).join('')+'</div></div>';
  h+='<div class="row"><a class="btn ghost" href="#/mistakes">Review mistakes'+(nw?' ('+nw+')':'')+'</a><a class="btn ghost" href="#/concepts">Read concepts</a></div>';
  return h;
}

function viewQuiz(){
  if(!SESS||!SESS.qids||!QM[SESS.qids[SESS.i]]){location.hash='#/';return ''}
  var q=curQ(),ord=orderFor(q),multi=nCorrect(q)>1,n=SESS.qids.length;
  var h='<div class="qhead"><span class="muted">'+esc(SESS.label)+' · '+(SESS.i+1)+' of '+n+'</span>'+tagHtml(q.d)+'</div>';
  h+='<div class="bar d'+q.d+'"><i style="width:'+pct(SESS.i+(SESS.checked?1:0),n)+'%"></i></div>';
  h+='<p class="qtext">'+esc(q.q)+'</p>';
  if(multi)h+='<p class="muted small">Select '+nCorrect(q)+' answers.</p>';
  h+='<div class="'+(multi?'multi':'')+'" role="group" aria-label="Answer choices">';
  ord.forEach(function(oi,pos){
    var o=q.o[oi],sel=SESS.picked.indexOf(oi)>-1,cls='opt';
    var mark='';
    if(SESS.checked){if(o.c){cls+=' right';mark=' <strong>(correct)</strong>'}else if(sel){cls+=' wrong';mark=' <strong>(your choice)</strong>'}}
    else if(sel)cls+=' sel';
    h+='<button class="'+cls+'" data-act="opt" data-i="'+oi+'" '+(SESS.checked?'disabled':'')+' aria-pressed="'+sel+'"><span class="k">'+(pos+1)+'</span><span>'+esc(o.t)+mark;
    if(SESS.checked&&!o.c&&sel&&o.w)h+='<span class="why">'+esc(o.w)+'</span>';
    h+='</span></button>';
  });
  h+='</div>';
  if(!SESS.checked){
    h+='<p><button class="btn" data-act="check" '+(SESS.picked.length?'':'disabled')+'>Check answer</button> <span class="muted small">Keys: 1–'+ord.length+', Enter</span></p>';
  }else{
    var a=SESS.answers[q.id];
    h+='<div class="fb '+(a.ok?'ok':'no')+'" role="status"><h3>'+(a.ok?'✓ Correct':'✗ Not quite')+'</h3>'+(a.ok?'':'<div>The correct answer is highlighted above.</div>')+'</div>';
    if(q.e&&q.e.length)h+='<div class="card"><h3>Why</h3>'+q.e.map(function(p){return '<p>'+esc(p)+'</p>'}).join('')+'</div>';
    var rel=(q.tags||[]).filter(function(t){return CM[t]});
    if(rel.length)h+='<div class="muted small">Read about:</div><div class="chips">'+rel.map(function(t){return '<a class="chip d'+CM[t].d+'" href="#/concept/'+t+'">'+esc(CM[t].name)+'</a>'}).join('')+'</div>';
    h+='<p><button class="btn" data-act="next">'+(SESS.i+1>=n?'Finish':'Next question')+'</button></p>';
  }
  return h;
}

function viewResults(){
  if(!LAST)return '<p>No finished quiz yet. <a href="#/">Start one</a>.</p>';
  var r=LAST.rec,byD={};
  LAST.qids.forEach(function(id){var q=QM[id],a=LAST.answers[id];var o=byD[q.d]||(byD[q.d]={t:0,ok:0});o.t++;if(a&&a.ok)o.ok++});
  var h='<h1>'+r.ok+' / '+r.total+' correct</h1><p class="muted">'+esc(r.label)+'</p><div class="card">';
  Object.keys(byD).forEach(function(d){h+='<div class="item d'+d+'"><div class="row"><span class="grow">'+tagHtml(+d)+'</span><span>'+byD[d].ok+'/'+byD[d].t+'</span></div></div>'});
  h+='</div><div class="card"><h2>Questions</h2>';
  LAST.qids.forEach(function(id){
    var q=QM[id],a=LAST.answers[id]||{ok:false};
    h+='<details class="item"><summary><span class="res '+(a.ok?'ok':'no')+'">'+(a.ok?'✓':'✗')+'</span> '+esc(trunc(q.q,120))+'</summary>'+qReview(q)+'</details>';
  });
  h+='</div><div class="row"><button class="btn" data-act="start" data-mode="smart">Another 10</button><button class="btn ghost" data-act="start" data-mode="mistakes">Practice mistakes</button><a class="btn ghost" href="#/">Home</a></div>';
  return h;
}
function qReview(q){
  var h='<p>'+esc(q.q)+'</p><ul class="tight">';
  q.o.forEach(function(o){h+='<li>'+(o.c?'<strong>✓ '+esc(o.t)+'</strong>':esc(o.t)+(o.w?'<div class="muted small">'+esc(o.w)+'</div>':''))+'</li>'});
  h+='</ul>';
  if(q.e&&q.e.length)h+=q.e.map(function(p){return '<p class="muted">'+esc(p)+'</p>'}).join('');
  var rel=(q.tags||[]).filter(function(t){return CM[t]});
  if(rel.length)h+='<div class="chips">'+rel.map(function(t){return '<a class="chip d'+CM[t].d+'" href="#/concept/'+t+'">'+esc(CM[t].name)+'</a>'}).join('')+'</div>';
  return h;
}

var MF=0;
function viewMistakes(){
  var st=stats();
  var list=QS.filter(function(q){return needsWork(q,st)&&(!MF||q.d===MF)});
  list.sort(function(a,b){var x=st[a.id]?st[a.id].wrong:0,y=st[b.id]?st[b.id].wrong:0;return y-x});
  var all=QS.filter(function(q){return needsWork(q,st)}).length;
  var h='<h1>Mistakes</h1><p class="muted">Questions you last answered wrong here, or missed in your earlier practice exam and have not retried yet.</p>';
  h+='<div class="chips"><button class="chip chipbtn'+(MF?'':' on')+'" data-act="mf" data-d="0">All ('+all+')</button>'+[1,2,3,4].map(function(d){
    var c=QS.filter(function(q){return q.d===d&&needsWork(q,st)}).length;
    return '<button class="chip chipbtn d'+d+(MF===d?' on':'')+'" data-act="mf" data-d="'+d+'">'+esc(D[d])+' ('+c+')</button>'}).join('')+'</div>';
  if(!list.length)return h+'<div class="card">Nothing here. Nice. <a href="#/">Start a quiz</a> to keep testing yourself.</div>';
  h+='<p><button class="btn" data-act="start" data-mode="mistakes">Practice 10 of these</button></p><div class="card">';
  list.forEach(function(q){
    var s=st[q.id];
    var meta=s?('missed '+s.wrong+'×, last '+fmtDate(s.lastT)):'missed in the earlier exam';
    h+='<details class="item"><summary>'+tagHtml(q.d)+' <span class="muted small">'+meta+'</span><br>'+esc(trunc(q.q,150))+'</summary>'+qReview(q)+'</details>';
  });
  return h+'</div>';
}

var CF={d:0,q:''};
function conceptList(){
  var q=CF.q.trim().toLowerCase();
  var list=CS.filter(function(c){
    if(CF.d&&c.d!==CF.d)return false;
    if(!q)return true;
    return (c.name+' '+c.simple+' '+c.cat+' '+c.facts.join(' ')).toLowerCase().indexOf(q)>-1;
  });
  if(!list.length)return '<p class="muted">Nothing matches.</p>';
  var cats={};list.forEach(function(c){(cats[c.cat]=cats[c.cat]||[]).push(c)});
  return Object.keys(cats).sort().map(function(k){
    return '<h3 class="muted" style="margin-top:1rem">'+esc(k)+'</h3>'+cats[k].sort(function(a,b){return a.name<b.name?-1:1}).map(function(c){
      return '<a class="concept-card d'+c.d+'" href="#/concept/'+c.id+'"><b>'+esc(c.name)+'</b><span class="muted small">'+esc(c.simple)+'</span></a>'}).join('');
  }).join('');
}
function viewConcepts(){
  var h='<h1>Concepts</h1><p class="muted">Plain-language notes with use cases. Colors show the exam domain.</p>';
  h+='<input type="search" id="csearch" placeholder="Search services and ideas" value="'+esc(CF.q)+'" aria-label="Search concepts">';
  h+='<div class="chips" style="margin:.7rem 0"><button class="chip chipbtn'+(CF.d?'':' on')+'" data-act="cf" data-d="0">All</button>'+[1,2,3,4].map(function(d){
    return '<button class="chip chipbtn d'+d+(CF.d===d?' on':'')+'" data-act="cf" data-d="'+d+'">D'+d+' '+esc(D[d])+'</button>'}).join('')+'</div>';
  return h+'<div id="clist">'+conceptList()+'</div>';
}
function viewConcept(id){
  var c=CM[id];if(!c)return '<p>Not found. <a href="#/concepts">Back to concepts</a></p>';
  var nq=QS.filter(function(q){return (q.tags||[]).indexOf(id)>-1}).length;
  var st=stats(),wrong=QS.filter(function(q){return (q.tags||[]).indexOf(id)>-1&&needsWork(q,st)}).length;
  var h='<p><a href="#/concepts">← All concepts</a></p><div class="d'+c.d+'"><h1>'+esc(c.name)+'</h1><p>'+tagHtml(c.d)+' <span class="muted small">'+esc(c.cat)+'</span></p></div>';
  h+='<div class="card"><h3>In plain words</h3><p>'+esc(c.simple)+'</p><h3>Use it for</h3><ul class="tight">'+c.uses.map(function(u){return '<li>'+esc(u)+'</li>'}).join('')+'</ul></div>';
  h+='<div class="card"><h3>Key facts</h3><ul class="tight">'+c.facts.map(function(f){return '<li>'+md(f)+'</li>'}).join('')+'</ul></div>';
  if(c.tips&&c.tips.length)h+='<div class="card"><h3>Exam angle</h3><ul class="tight">'+c.tips.map(function(f){return '<li>'+md(f)+'</li>'}).join('')+'</ul></div>';
  if(c.warn&&c.warn.length)h+='<div class="callout warn"><b>Double-check:</b><ul class="tight">'+c.warn.map(function(f){return '<li>'+md(f)+'</li>'}).join('')+'</ul></div>';
  var rel=(c.rel||[]).filter(function(r){return CM[r]});
  if(rel.length)h+='<div class="muted small">Related</div><div class="chips">'+rel.map(function(r){return '<a class="chip d'+CM[r].d+'" href="#/concept/'+r+'">'+esc(CM[r].name)+'</a>'}).join('')+'</div>';
  if(nq)h+='<p><button class="btn" data-act="start" data-mode="tag-'+id+'">Practice questions on this ('+nq+(wrong?', '+wrong+' need work':'')+')</button></p>';
  h+='<p class="muted small">Source: '+esc(c.src)+(c.src==='Cheat sheet'?' (rewritten), plus plain-language notes':'')+'</p>';
  return h;
}

function viewProgress(){
  var st=stats();
  var h='<h1>Progress</h1>';
  h+='<div class="card"><h2>By domain</h2>';
  [1,2,3,4].forEach(function(d){
    var qd=QS.filter(function(q){return q.d===d}),seen=qd.filter(function(q){return st[q.id]}).length,a=0,r=0;
    S.attempts.forEach(function(x){if(QM[x.q]&&QM[x.q].d===d){a++;if(x.ok)r++}});
    h+='<div class="item d'+d+'"><div class="row"><span class="grow"><b>Domain '+d+'</b> '+esc(D[d])+'</span><span>'+(a?pct(r,a)+'%':'–')+'</span></div><div class="bar"><i style="width:'+pct(r,a)+'%"></i></div><div class="muted small">'+seen+' of '+qd.length+' questions seen · '+a+' answers</div></div>';
  });
  h+='</div>';
  var wc={};
  S.attempts.forEach(function(a){if(!a.ok&&QM[a.q])(QM[a.q].tags||[]).forEach(function(t){wc[t]=(wc[t]||0)+1})});
  var top=Object.keys(wc).filter(function(t){return CM[t]}).sort(function(a,b){return wc[b]-wc[a]}).slice(0,6);
  if(top.length){h+='<div class="card"><h2>Topics to revisit</h2><p class="muted small">Most missed so far.</p><div class="chips">'+top.map(function(t){return '<a class="chip d'+CM[t].d+'" href="#/concept/'+t+'">'+esc(CM[t].name)+' ('+wc[t]+')</a>'}).join('')+'</div></div>'}
  h+='<div class="card"><h2>Recent quizzes</h2>';
  var rs=S.sessions.slice(-12).reverse();
  if(!rs.length)h+='<p class="muted">None yet.</p>';
  rs.forEach(function(s){h+='<div class="item row"><span class="grow">'+esc(s.label)+'<div class="muted small">'+fmtDate(s.t)+'</div></span><b>'+s.ok+'/'+s.total+'</b></div>'});
  return h+'</div>';
}

function viewData(){
  var h='<h1>Data</h1>';
  h+='<div class="card"><h2>Your progress</h2><p class="muted">Stored only in this browser. Export a copy now and then, especially before clearing browser data or switching devices.</p>'
    +'<div class="row"><button class="btn" data-act="export">Export progress</button><label class="btn ghost">Import progress<input type="file" id="impP" accept="application/json" hidden></label></div>'
    +'<p class="small muted" style="margin-top:.8rem">'+S.attempts.length+' answers and '+S.sessions.length+' quizzes recorded.</p>'
    +'<p id="resetbox"><button class="btn ghost" data-act="reset1">Reset progress…</button></p></div>';
  h+='<div class="card"><h2>Questions</h2><p>'+QS.length+' loaded ('+(SRC==='bundled'?'bundled with the site':SRC==='imported'?'imported in this browser':'none')+').</p>'
    +'<div class="row"><label class="btn ghost">Import questions file<input type="file" id="impQ" accept="application/json" hidden></label>'
    +(SRC==='imported'?'<button class="btn ghost" data-act="clearq">Remove imported questions</button>':'')+'</div>'
    +'<p class="small muted" style="margin-top:.8rem">The questions come from a commercial practice exam. If you publish this site publicly, keep that content out of the public repository and import it here instead. See the README.</p></div>';
  return h;
}

/* ---------- router ---------- */
function route(){
  var h=(location.hash||'#/').replace(/^#/,'');
  var parts=h.split('/').filter(Boolean);
  var page=parts[0]||'';
  var html='';
  if(page==='quiz')html=viewQuiz();
  else if(page==='results')html=viewResults();
  else if(page==='mistakes')html=viewMistakes();
  else if(page==='concepts')html=viewConcepts();
  else if(page==='concept')html=viewConcept(parts[1]);
  else if(page==='progress')html=viewProgress();
  else if(page==='data')html=viewData();
  else{page='';html=viewHome()}
  navHtml(page==='concept'?'concepts':page==='quiz'||page==='results'?'':page);
  setMain(html);
  bindInputs();
}
function bindInputs(){
  var cs=$('#csearch');
  if(cs)cs.addEventListener('input',function(){CF.q=cs.value;$('#clist').innerHTML=conceptList()});
  var ip=$('#impP');
  if(ip)ip.addEventListener('change',function(){readFile(ip,function(j){
    var seen={};S.attempts.forEach(function(a){seen[a.q+'|'+a.t]=1});
    (j.attempts||[]).forEach(function(a){if(a&&a.q&&!seen[a.q+'|'+a.t]){S.attempts.push(a)}});
    var sid={};S.sessions.forEach(function(s){sid[s.id]=1});
    (j.sessions||[]).forEach(function(s){if(s&&!sid[s.id])S.sessions.push(s)});
    S.attempts.sort(function(a,b){return a.t-b.t});save();route();
  })});
  var iq=$('#impQ');
  if(iq)iq.addEventListener('change',function(){readFile(iq,function(j){
    var qs=Array.isArray(j)?j:j.questions;
    if(!qs||!qs.length||!qs[0].q||!qs[0].o)throw new Error('format');
    localStorage.setItem(QKEY,JSON.stringify({questions:qs,sets:j.sets||[]}));location.reload();
  })});
}
function readFile(inp,cb){
  var f=inp.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){try{cb(JSON.parse(r.result))}catch(e){alert('That file could not be read. Check that it is the right JSON file.')}};
  r.readAsText(f);
}
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act;
  if(a==='start')startSession(t.dataset.mode);
  else if(a==='opt')toggleOpt(+t.dataset.i);
  else if(a==='check')check();
  else if(a==='next')next();
  else if(a==='mf'){MF=+t.dataset.d;route()}
  else if(a==='cf'){CF.d=+t.dataset.d;route()}
  else if(a==='export'){
    var blob=new Blob([JSON.stringify({exported:Date.now(),attempts:S.attempts,sessions:S.sessions})],{type:'application/json'});
    var l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download='dea-progress-'+new Date().toISOString().slice(0,10)+'.json';l.click();
  }
  else if(a==='reset1'){$('#resetbox').innerHTML='<b>This erases all answers and history.</b> <button class="btn" data-act="reset2">Yes, erase</button> <button class="btn ghost" data-act="reset0">Cancel</button>'}
  else if(a==='reset0')route();
  else if(a==='reset2'){S={v:1,attempts:[],sessions:[]};save();SESS=null;try{sessionStorage.removeItem(SKEY)}catch(x){}route()}
  else if(a==='clearq'){localStorage.removeItem(QKEY);location.reload()}
});
document.addEventListener('keydown',function(e){
  if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;
  if(location.hash!=='#/quiz'||!SESS)return;
  var q=curQ();if(!q)return;
  if(e.key==='Enter'){e.preventDefault();SESS.checked?next():check();return}
  var n=+e.key;if(n>=1&&n<=q.o.length){toggleOpt(orderFor(q)[n-1])}
});
window.addEventListener('hashchange',route);
route();
})();
