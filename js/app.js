(function(){
'use strict';
const D=window.RSG_DATA, S=D.survey, T=D.tables;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const MONTHS=['Jun','Jul','Aug','Sep','Oct','Nov'];
const DESTS=['The Red Sea','Shura Island','AMAALA','Thuwal'];
const TYPES=['Couples / leisure','Families','Wellness','Diving & adventure','Business & events'];
const REGIONS=['Africa','Americas','Asia','Europe','Other','Other Arab','Other GCC','Saudi Arabia'];
const CAT=[['Pre-visit info','Q1'],['Booking','Q2'],['Value','Q12'],['Feedback','FB'],['Activities','Q9'],['Digital (web/app)','Q3'],['Dining','Q11'],['Check-in','Q5'],['Sustainability','Q13'],['Transport','Q8'],['Accommodation','Q6'],['Staff','Q7']];
const COL=Charts.C;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MINUS='−';
const fmtNPS=v=>v==null?'–':(v<0?MINUS:'')+Math.abs(v).toFixed(1);
const f2=v=>v==null?'–':v.toFixed(2);

/* ============ State ============ */
const F={dest:'',type:'',region:'',month:''};
const FKEY={dest:'Destination',type:'Visitor Type',region:'Region',month:'Month'};
const FLABEL={dest:'Destination',type:'Visitor type',region:'Region',month:'Month'};

/* alerts (persisted overrides) */
const AKEY='rsg_alerts_v1';
let AO={};try{AO=JSON.parse(localStorage.getItem(AKEY)||'{}')}catch(e){AO={}}
const saveAO=()=>{try{localStorage.setItem(AKEY,JSON.stringify(AO))}catch(e){}};
const alertsAll=()=>D.alerts.map(a=>{const o=AO[a['Alert ID']]||{};return Object.assign({},a,{Status:o.status||a.Status,Owner:o.owner||a.Owner,Note:o.note||''})});
const isOpen=a=>a.Status!=='Closed';
const OWNERS=[...new Set(D.alerts.map(a=>a.Owner))].sort();

/* ============ Maths ============ */
const mean=(arr,k)=>{const v=arr.map(r=>r[k]).filter(x=>typeof x==='number');return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
const npsOf=arr=>arr.length?(arr.filter(r=>r['NPS Group']==='Promoter').length-arr.filter(r=>r['NPS Group']==='Detractor').length)/arr.length*100:null;
const posOf=arr=>arr.length?arr.filter(r=>r.Q26>=4).length/arr.length*100:null;
function sf(skip){return S.filter(r=>(skip==='dest'||!F.dest||r.Destination===F.dest)&&(skip==='type'||!F.type||r['Visitor Type']===F.type)&&(skip==='region'||!F.region||r.Region===F.region)&&(skip==='month'||!F.month||r.Month===F.month))}
function af(list,skip){return list.filter(a=>(skip==='dest'||!F.dest||a.Destination===F.dest)&&(skip==='type'||!F.type||a['Visitor Type']===F.type)&&(skip==='region'||!F.region||a.Region===F.region)&&(skip==='month'||!F.month||a.Month===F.month))}
const fade=hex=>{const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255,m=.62;return `rgb(${Math.round(r+(255-r)*m)},${Math.round(g+(255-g)*m)},${Math.round(b+(255-b)*m)})`};

/* ============ Toast / modal ============ */
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}
function openModal(title,html){$('#m-title').textContent=title;$('#m-body').innerHTML=html;$('#modal').classList.add('show')}
function closeModal(){$('#modal').classList.remove('show')}
$('#m-x').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

/* ============ Filters ============ */
function fillSel(id,all,list){
  const s=$(id);s.innerHTML=`<option value="">${all}</option>`+list.map(x=>`<option value="${esc(x)}">${esc(x)}${id==='#f-month'?' 2026':''}</option>`).join('');
}
fillSel('#f-dest','All destinations',DESTS);fillSel('#f-type','All types',TYPES);fillSel('#f-region','All regions',REGIONS);fillSel('#f-month','Jun – Nov 2026',MONTHS);
const SELS={dest:'#f-dest',type:'#f-type',region:'#f-region',month:'#f-month'};
Object.keys(SELS).forEach(k=>$(SELS[k]).addEventListener('change',e=>{F[k]=e.target.value;refresh()}));
function setF(k,v,silent){F[k]=(F[k]===v&&!silent)?'':v;if(!F[k])toast(FLABEL[k]+' filter cleared');else toast(FLABEL[k]+' filter: '+v);refresh()}
function clearAll(){Object.keys(F).forEach(k=>F[k]='');refresh()}
function syncFilters(){
  Object.keys(SELS).forEach(k=>{const s=$(SELS[k]);s.value=F[k];s.parentNode.classList.toggle('on',!!F[k])});
  const act=Object.keys(F).filter(k=>F[k]);
  const html=act.length?act.map(k=>`<span class="chip">${FLABEL[k]}: ${esc(F[k])}<button data-rm="${k}" aria-label="remove">×</button></span>`).join('')+'<button class="clear" id="clr">Clear all</button>':'';
  ['#chips','#sv-chips'].forEach(id=>{const c=$(id);c.innerHTML=html;c.classList.toggle('show',act.length>0)});
  $$('[data-rm]').forEach(b=>b.onclick=()=>{F[b.dataset.rm]='';refresh()});
  $$('#clr').forEach(b=>b.onclick=clearAll);
}

/* ============ KPIs ============ */
const KPIS=[
 {id:'resp',c:'c1',t:'TOTAL RESPONSES'},
 {id:'sat',c:'c2',t:'AVG SATISFACTION'},
 {id:'nps',c:'c3',t:'NET PROMOTER SCORE'},
 {id:'pos',c:'c4',t:'POSITIVE RATE'},
 {id:'rec',c:'c5',t:'AVG RECOMMEND'},
 {id:'alr',c:'c6',t:'OPEN ALERTS'}
];
function monthSeries(rows,fn){return MONTHS.map(m=>{const r=rows.filter(x=>x.Month===m);return {label:m,n:r.length,value:r.length?fn(r):null}})}
function satDelta(){
  const ser=monthSeries(sf('month'),r=>mean(r,'Q26'));
  let i=F.month?MONTHS.indexOf(F.month):-1;
  if(i<0){for(let k=5;k>=0;k--)if(ser[k].value!=null){i=k;break}}
  if(i<1||ser[i].value==null)return null;
  for(let k=i-1;k>=0;k--)if(ser[k].value!=null)return +(ser[i].value-ser[k].value).toFixed(2);
  return null;
}
function kpiVals(){
  const r=sf(),al=af(alertsAll().filter(isOpen));
  const n=r.length,ar=r.filter(x=>x.Language==='Arabic').length;
  const pr=n?r.filter(x=>x['NPS Group']==='Promoter').length/n*100:0,dt=n?r.filter(x=>x['NPS Group']==='Detractor').length/n*100:0;
  return {n,ar,en:n-ar,sat:mean(r,'Q26'),nps:npsOf(r),pr,dt,pos:posOf(r),rec:mean(r,'Q27'),al,
    crit:al.filter(a=>a.Severity==='Critical').length,high:al.filter(a=>a.Severity==='High').length,
    age:al.length?al.reduce((s,a)=>s+a['Age (h)'],0)/al.length:null};
}
function renderKPIs(){
  const v=kpiVals(),d=satDelta();
  const dTxt=d==null?'mean of Q26 (1–5)':`${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(2)} vs last month`;
  const html={
    resp:[v.n,'',`${v.ar} Arabic · ${v.en} English`,''],
    sat:[v.sat==null?'–':v.sat.toFixed(2),' / 5',dTxt,d==null?'':d>=0?'up':'down'],
    nps:[fmtNPS(v.nps),'',v.n?`${v.pr.toFixed(1)}% promoters · ${v.dt.toFixed(1)}% detractors`:'no responses',''],
    pos:[v.pos==null?'–':v.pos.toFixed(1)+'%','','rated satisfaction 4 or 5',''],
    rec:[v.rec==null?'–':v.rec.toFixed(2),' / 5',(!F.dest&&!F.type&&!F.region&&!F.month)?'highest outcome item':'mean of Q27 (1–5)',''],
    alr:[v.al.length,'',v.al.length?`avg. age ${v.age.toFixed(1)} h · SLA 24 h`:'SLA 24 h · all clear','']
  };
  $('#kpis').innerHTML=KPIS.map(k=>{const h=html[k.id];return `<button class="kpi ${k.c}" data-kpi="${k.id}"><h4>${k.t}</h4><div class="v">${h[0]}${h[1]?`<small>${h[1]}</small>`:''}</div><div class="s ${h[3]}">${h[2]}</div></button>`}).join('');
  $$('.kpi').forEach(b=>b.onclick=()=>drill(b.dataset.kpi));
  $('#sk-alerts').textContent=v.al.length;$('#sk-alerts-s').textContent=`${v.crit} critical · ${v.high} high`;
  $('#sk-sat').textContent=v.sat==null?'–':v.sat.toFixed(2);$('#sk-nps').textContent=fmtNPS(v.nps);
  $('#bell-n').textContent=alertsAll().filter(isOpen).length;
}
$$('.skpi').forEach(s=>s.onclick=()=>{if(s.dataset.go)go(s.dataset.go);else{go('dashboard');drill(s.dataset.kpi)}});

/* ============ Charts ============ */
function renderCharts(){
  const base=sf();
  // 1 categories
  const cats=CAT.map(([l,k])=>({label:l,value:mean(base,k),n:base.length})).filter(c=>c.value!=null).sort((a,b)=>b.value-a.value);
  Charts.hbar($('#ch-cat'),cats,{color:COL.teal});
  // 2 trend (ignores month filter so the line stays readable)
  const tr=monthSeries(sf('month'),r=>mean(r,'Q26')).map(p=>Object.assign(p,{onClick:()=>setF('month',p.label)}));
  Charts.line($('#ch-trend'),tr,{tipLabel:'Avg satisfaction'});
  // 3 nps
  const nb=sf(),cnt=g=>nb.filter(r=>r['NPS Group']===g).length;
  Charts.donut($('#ch-nps'),[{label:'Promoters',value:cnt('Promoter'),color:COL.teal},{label:'Passives',value:cnt('Passive'),color:COL.orange},{label:'Detractors',value:cnt('Detractor'),color:COL.pink}]);
  // 4 destination
  const dd=sf('dest');
  const dst=DESTS.map(d=>{const r=dd.filter(x=>x.Destination===d);return {label:d,value:r.length?mean(r,'Q26'):null,n:r.length}}).filter(x=>x.value!=null).sort((a,b)=>b.value-a.value)
    .map(x=>Object.assign(x,{color:F.dest&&F.dest!==x.label?fade(COL.blue):COL.blue,onClick:()=>setF('dest',x.label)}));
  Charts.vbar($('#ch-dest'),dst,{tipLabel:'Avg satisfaction'});
  // 5 visitor types
  const tt=sf('type'),tcol=[COL.teal,COL.blue,COL.green,COL.purple,COL.orange];
  Charts.donut($('#ch-type'),TYPES.map((t,i)=>({label:t,value:tt.filter(r=>r['Visitor Type']===t).length,color:F.type&&F.type!==t?fade(tcol[i]):tcol[i],onClick:()=>setF('type',t)})));
  // 6 region
  const rr=sf('region');
  const reg=REGIONS.map(g=>{const r=rr.filter(x=>x.Region===g);return {label:g,value:r.length?mean(r,'Overall'):null,n:r.length}}).filter(x=>x.value!=null).sort((a,b)=>b.value-a.value)
    .map(x=>Object.assign(x,{color:F.region&&F.region!==x.label?fade(COL.blue):COL.blue,onClick:()=>setF('region',x.label)}));
  Charts.hbar($('#ch-region'),reg,{tipLabel:'Avg overall score'});
  // 7 monthly nps
  const mn=monthSeries(sf('month'),npsOf).map(p=>Object.assign(p,{color:F.month&&F.month!==p.label?fade(COL.orange):COL.orange,onClick:()=>setF('month',p.label)}));
  Charts.vbar($('#ch-mnps'),mn,{zero:true,inside:true,tipLabel:'NPS',fmt:it=>fmtNPS(it.value)});
  // 8 segments
  const sg=sf(),tot=sg.length||1,segs=[['High (4–5)','High (4-5)',COL.green],['Neutral (3)','Neutral (3)',COL.orange],['Low (1–2)','Low (1-2)',COL.pink]];
  Charts.vbar($('#ch-seg'),segs.map(([l,k,c])=>{const n=sg.filter(r=>r['Sat Segment']===k).length;return {label:l.replace('–','-'),value:n,n:null,color:c,pct:Math.round(n/tot*100)}}),{zero:true,tipLabel:'Responses',fmt:it=>`${it.value} (${it.pct}%)`});
  // 9 alert severity
  const al=af(alertsAll().filter(isOpen)),sev=s=>al.filter(a=>a.Severity===s).length;
  Charts.donut($('#ch-sev'),[['Critical',COL.pink],['High',COL.orange],['Medium',COL.blue],['Low',COL.green]].map(([s,c])=>({label:s,value:sev(s),color:c,onClick:()=>{go('alerts');$('#al-sev').value=s;$('#al-st').value='open';renderAlerts()}})));
}

/* ============ KPI drill-down ============ */
function drill(id){
  const k=KPIS.find(x=>x.id===id),v=kpiVals();
  const rows=sf('month');
  let big,sub,fn,fmt,tl,brk;
  if(id==='alr'){
    const list=af(alertsAll(),'month');
    const open=v.al;
    big=open.length;sub=`open alerts · ${v.crit} critical · ${v.high} high`;
    const ser=MONTHS.map(m=>({label:m,value:list.filter(a=>a.Month===m&&isOpen(a)).length,n:null}));
    openModal(k.t,`<div class="big">${big}</div><div class="sub">${sub}</div><div class="drill-chart" id="dc"></div>
      <table><thead><tr><th class="nosort">ID</th><th class="nosort">Destination</th><th class="nosort">Category</th><th class="nosort">Severity</th><th class="nosort">Age</th></tr></thead><tbody>${open.sort((a,b)=>b['Age (h)']-a['Age (h)']).slice(0,6).map(a=>`<tr><td>${a['Alert ID']}</td><td>${a.Destination}</td><td>${a.Category}</td><td><span class="pill p-${a.Severity}">${a.Severity}</span></td><td class="${a['Age (h)']>24?'sla':''}">${a['Age (h)']} h</td></tr>`).join('')||'<tr><td colspan="5">No open alerts</td></tr>'}</tbody></table>
      <p style="margin-top:12px"><button class="btn pri" id="dgo">Open Alerts List ›</button></p>`);
    setTimeout(()=>{Charts.vbar($('#dc'),ser,{zero:true,color:COL.pink,tipLabel:'Open alerts',fmt:i=>String(i.value)})},30);
    $('#dgo').onclick=()=>{closeModal();go('alerts')};return;
  }
  const defs={
    resp:{big:v.n,sub:`${v.ar} Arabic · ${v.en} English`,fn:r=>r.length,fmt:i=>String(i.value),zero:true,color:COL.teal,tl:'Responses',brk:r=>r.length,bf:x=>String(x)},
    sat:{big:v.sat==null?'–':v.sat.toFixed(2)+' / 5',sub:'mean of Q26 (1–5)',fn:r=>mean(r,'Q26'),fmt:i=>i.value.toFixed(2),color:COL.blue,tl:'Avg satisfaction',brk:r=>mean(r,'Q26'),bf:x=>x==null?'–':x.toFixed(2)},
    nps:{big:fmtNPS(v.nps),sub:`${v.pr.toFixed(1)}% promoters · ${v.dt.toFixed(1)}% detractors`,fn:npsOf,fmt:i=>fmtNPS(i.value),zero:true,color:COL.orange,tl:'NPS',brk:npsOf,bf:fmtNPS},
    pos:{big:v.pos==null?'–':v.pos.toFixed(1)+'%',sub:'rated satisfaction 4 or 5',fn:posOf,fmt:i=>i.value.toFixed(1)+'%',zero:true,color:COL.green,tl:'Positive rate',brk:posOf,bf:x=>x==null?'–':x.toFixed(1)+'%'},
    rec:{big:v.rec==null?'–':v.rec.toFixed(2)+' / 5',sub:'mean of Q27 (1–5)',fn:r=>mean(r,'Q27'),fmt:i=>i.value.toFixed(2),color:COL.purple,tl:'Avg recommend',brk:r=>mean(r,'Q27'),bf:x=>x==null?'–':x.toFixed(2)}
  }[id];
  const ser=monthSeries(rows,defs.fn);
  const dr=sf('dest');
  const brkRows=DESTS.map(d=>{const r=dr.filter(x=>x.Destination===d);return `<tr><td>${d}</td><td class="num">${r.length}</td><td class="num"><b>${r.length?defs.bf(defs.brk(r)):'–'}</b></td></tr>`}).join('');
  openModal(k.t,`<div class="big">${defs.big}</div><div class="sub">${defs.sub} · monthly trend${F.month?' (all months shown)':''}</div><div class="drill-chart" id="dc"></div>
    <table><thead><tr><th class="nosort">Destination</th><th class="nosort" style="text-align:right">n</th><th class="nosort" style="text-align:right">${defs.tl}</th></tr></thead><tbody>${brkRows}</tbody></table>`);
  setTimeout(()=>{
    if(defs.zero)Charts.vbar($('#dc'),ser.map(p=>Object.assign(p,{color:defs.color})),{zero:true,tipLabel:defs.tl,fmt:defs.fmt,inside:id==='nps'});
    else Charts.line($('#dc'),ser,{color:defs.color,tipLabel:defs.tl,fmt:v=>v.toFixed(2)});
  },30);
}

/* ============ Survey page ============ */
const SV_COLS=['ID','Language','Gender','Age','Region','Destination','Visitor Type','Month',...Array.from({length:27},(_,i)=>'Q'+(i+1)),'Overall','NPS Group','Sat Segment'];
const sv={q:'',nps:'',sort:'ID',dir:1,page:0,size:25};
function svRows(){
  let r=sf();
  if(sv.nps)r=r.filter(x=>x['NPS Group']===sv.nps);
  if(sv.q){const q=sv.q.toLowerCase();r=r.filter(x=>[x.ID,x.Region,x.Destination,x['Visitor Type'],x.Month,x.Language,x.Gender,x.Age].join(' ').toLowerCase().includes(q))}
  const k=sv.sort,d=sv.dir;
  return r.slice().sort((a,b)=>{const x=a[k],y=b[k];return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))*d});
}
function renderSurvey(){
  const rows=svRows(),pages=Math.max(1,Math.ceil(rows.length/sv.size));
  if(sv.page>=pages)sv.page=pages-1;
  const slice=rows.slice(sv.page*sv.size,(sv.page+1)*sv.size);
  $('#sv-sub').textContent=`${rows.length} of ${S.length} responses${Object.values(F).some(Boolean)?' · dashboard filters applied':''}`;
  const head='<thead><tr>'+SV_COLS.map(c=>`<th data-k="${c}">${c}<span class="ar">${sv.sort===c?(sv.dir>0?'▲':'▼'):''}</span></th>`).join('')+'</tr></thead>';
  const body='<tbody>'+(slice.length?slice.map(r=>'<tr>'+SV_COLS.map(c=>{
    let v=r[c];
    if(c==='Overall')return `<td class="num">${v.toFixed(2)}</td>`;
    if(c==='NPS Group')return `<td><span class="pill p-${v}">${v}</span></td>`;
    return `<td${typeof v==='number'?' class="num"':''}>${esc(v)}</td>`}).join('')+'</tr>').join(''):`<tr><td colspan="${SV_COLS.length}" style="text-align:center;padding:30px;color:#8a95a6">No responses match the current filters</td></tr>`)+'</tbody>';
  $('#sv-table').innerHTML=head+body;
  $$('#sv-table th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sv.sort===k)sv.dir*=-1;else{sv.sort=k;sv.dir=1}renderSurvey()});
  $('#sv-info').textContent=rows.length?`Showing ${sv.page*sv.size+1}–${Math.min((sv.page+1)*sv.size,rows.length)} of ${rows.length}`:'No results';
  $('#sv-pg').textContent=`Page ${sv.page+1} / ${pages}`;
  $('#sv-prev').disabled=sv.page===0;$('#sv-next').disabled=sv.page>=pages-1;
}
$('#sv-q').oninput=e=>{sv.q=e.target.value;sv.page=0;renderSurvey()};
$('#sv-nps').onchange=e=>{sv.nps=e.target.value;sv.page=0;renderSurvey()};
$('#sv-prev').onclick=()=>{sv.page--;renderSurvey()};$('#sv-next').onclick=()=>{sv.page++;renderSurvey()};
$('#sv-reset').onclick=()=>{sv.q='';sv.nps='';$('#sv-q').value='';$('#sv-nps').value='';clearAll()};
$('#sv-csv').onclick=()=>{
  const rows=svRows();
  const csv=[SV_COLS.join(',')].concat(rows.map(r=>SV_COLS.map(c=>{const v=r[c];return /[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v}).join(','))).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));a.download='rsg_survey_data.csv';a.click();toast(`Exported ${rows.length} rows`);
};

/* ============ Alerts page ============ */
function renderAlerts(){
  const all=af(alertsAll());
  const q=$('#al-q').value.toLowerCase(),sev=$('#al-sev').value,st=$('#al-st').value;
  let rows=all.filter(a=>(!sev||a.Severity===sev)&&(st===''||(st==='open'?isOpen(a):a.Status===st))&&(!q||Object.values(a).join(' ').toLowerCase().includes(q)));
  const order={Critical:0,High:1,Medium:2,Low:3};
  rows.sort((a,b)=>(isOpen(b)-isOpen(a))||order[a.Severity]-order[b.Severity]||b['Age (h)']-a['Age (h)']);
  const open=all.filter(isOpen);
  $('#al-stats').innerHTML=`<div class="stat pk"><small>OPEN ALERTS</small><strong>${open.length}</strong></div><div class="stat or"><small>CRITICAL / HIGH</small><strong>${open.filter(a=>a.Severity==='Critical'||a.Severity==='High').length}</strong></div><div class="stat"><small>SLA BREACHED (&gt;24 H)</small><strong>${open.filter(a=>a['Age (h)']>24).length}</strong></div><div class="stat gr"><small>CLOSED</small><strong>${all.length-open.length}</strong></div>`;
  const stPill=s=>`<span class="pill p-${s==='In Progress'?'Progress':s}">${s}</span>`;
  $('#al-table').innerHTML=`<thead><tr>${['Alert ID','Date','Destination','Region','Visitor Type','Service Area','Category','Severity','Status','Owner','Age','Action'].map(h=>`<th class="nosort">${h}</th>`).join('')}</tr></thead><tbody>`+
   (rows.length?rows.map(a=>`<tr data-id="${a['Alert ID']}" style="cursor:pointer"><td><b>${a['Alert ID']}</b></td><td>${a.Date}</td><td>${a.Destination}</td><td>${a.Region}</td><td>${a['Visitor Type']}</td><td>${a['Service Area']}</td><td>${a.Category}</td><td><span class="pill p-${a.Severity}">${a.Severity}</span></td><td>${stPill(a.Status)}</td><td>${esc(a.Owner)}</td><td class="num ${isOpen(a)&&a['Age (h)']>24?'sla':''}">${a['Age (h)']} h</td><td>${isOpen(a)?`<button class="btn sm" data-close="${a['Alert ID']}">Close</button>`:`<button class="btn sm" data-reopen="${a['Alert ID']}">Reopen</button>`}</td></tr>`).join(''):`<tr><td colspan="12" style="text-align:center;padding:30px;color:#8a95a6">No alerts match</td></tr>`)+'</tbody>';
  $$('#al-table tr[data-id]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('button'))return;alertDlg(tr.dataset.id)});
  $$('[data-close]').forEach(b=>b.onclick=()=>setAlert(b.dataset.close,{status:'Closed'},'closed'));
  $$('[data-reopen]').forEach(b=>b.onclick=()=>setAlert(b.dataset.reopen,{status:'Open'},'reopened'));
}
function setAlert(id,patch,msg){AO[id]=Object.assign(AO[id]||{},patch);saveAO();toast(`${id} ${msg||'updated'}`);refresh()}
function alertDlg(id){
  const a=alertsAll().find(x=>x['Alert ID']===id);
  openModal(`Alert ${id}`,`<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><span class="pill p-${a.Severity}">${a.Severity}</span><span class="pill p-${a.Status==='In Progress'?'Progress':a.Status}">${a.Status}</span><b style="font-size:15px">${a.Category}</b></div>
   <div class="form-row"><label>Destination</label><div>${a.Destination} · ${a.Region} · ${a['Visitor Type']}</div></div>
   <div class="form-row"><label>Service area</label><div>${a['Service Area']}</div></div>
   <div class="form-row"><label>Raised</label><div>${a.Date} · age <b class="${isOpen(a)&&a['Age (h)']>24?'sla':''}">${a['Age (h)']} h</b> (SLA 24 h)</div></div>
   <div class="form-row"><label>Owner</label><select id="ad-owner">${OWNERS.map(o=>`<option${o===a.Owner?' selected':''}>${o}</option>`).join('')}</select></div>
   <div class="form-row"><label>Note</label><textarea id="ad-note" placeholder="Add a resolution note…">${esc(a.Note)}</textarea></div>
   <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px">
    <button class="btn" id="ad-save">Save</button>
    ${a.Status==='Open'?'<button class="btn" id="ad-prog">Start progress</button>':''}
    ${isOpen(a)?'<button class="btn danger" id="ad-close">Close ticket</button>':'<button class="btn pri" id="ad-re">Reopen</button>'}
   </div>`);
  const cur=()=>({owner:$('#ad-owner').value,note:$('#ad-note').value});
  const done=(p,m)=>{closeModal();setAlert(id,Object.assign(cur(),p),m)};
  $('#ad-save').onclick=()=>done({},'saved');
  if($('#ad-prog'))$('#ad-prog').onclick=()=>done({status:'In Progress'},'in progress');
  if($('#ad-close'))$('#ad-close').onclick=()=>done({status:'Closed'},'closed');
  if($('#ad-re'))$('#ad-re').onclick=()=>done({status:'Open'},'reopened');
}
['#al-q','#al-sev','#al-st'].forEach(s=>$(s).addEventListener('input',renderAlerts));
$('#al-reset').onclick=()=>{AO={};saveAO();toast('Alerts reset to original data');refresh()};
$('#bell').onclick=()=>{$('#al-st').value='open';$('#al-sev').value='';go('alerts')};

/* ============ Analysis tables ============ */
function renderTables(){
  $('#an-dims').innerHTML=`<table><thead><tr>${['Dimension','Items','Mean','SD',"Cronbach's α"].map(h=>`<th class="nosort">${h}</th>`).join('')}</tr></thead><tbody>${T.dims.map((r,i)=>`<tr${i===4?' style="font-weight:700;background:#f3fafc"':''}><td>${r[0]}</td><td>${r[1]}</td><td class="num">${r[2].toFixed(2)}</td><td class="num">${r[3].toFixed(2)}</td><td class="num">${r[4].toFixed(3)}</td></tr>`).join('')}</tbody></table>`;
  const cl=T.corr[0].slice(1);
  const shade=v=>{const a=(v-.7)/.3;return `rgba(27,182,204,${Math.max(.12,Math.min(1,a)).toFixed(2)})`};
  $('#an-corr').innerHTML=`<div class="heat"><div class="h"></div>${cl.map(c=>`<div class="h">${c}</div>`).join('')}${T.corr.slice(1).map(r=>`<div class="h" style="text-align:left;padding-top:10px">${r[0]}</div>${r.slice(1).map(v=>`<div style="background:${shade(v)};color:${v>.85?'#fff':'#1c2434'}">${v.toFixed(2)}</div>`).join('')}`).join('')}</div><p style="margin-top:10px;font-size:11px;color:#6b7686">EXP experience · FB feedback · SS smart platform · OUT outcome</p>`;
  const q=($('#an-q').value||'').toLowerCase();
  const items=T.items.filter(r=>!q||r[0].toLowerCase().includes(q));
  $('#an-items').innerHTML=`<thead><tr>${['Item','Mean','SD','Agree %','Neutral %','Disagree %'].map(h=>`<th class="nosort">${h}</th>`).join('')}</tr></thead><tbody>${items.map(r=>`<tr><td><b>${r[0]}</b></td><td class="num">${r[1].toFixed(2)}</td><td class="num">${r[2].toFixed(2)}</td><td><div class="bar-cell"><i style="width:${r[3]*140}px"></i>${(r[3]*100).toFixed(1)}%</div></td><td><div class="bar-cell"><i style="width:${r[4]*140}px;background:${COL.orange}"></i>${(r[4]*100).toFixed(1)}%</div></td><td><div class="bar-cell"><i style="width:${r[5]*140}px;background:${COL.pink}"></i>${(r[5]*100).toFixed(1)}%</div></td></tr>`).join('')}</tbody>`;
  $('#an-groups').innerHTML=`<thead><tr>${['Group','Category','n','EXP','FB','SS','OUT','Overall'].map(h=>`<th class="nosort">${h}</th>`).join('')}</tr></thead><tbody>${T.groups.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td>${r.slice(2).map((v,i)=>`<td class="num">${i?v.toFixed(2):v}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('#an-tests').innerHTML=T.tests.map(r=>`<div class="test"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}
$('#an-q').oninput=renderTables;

/* ============ Router ============ */
const BANNERS={
 dashboard:'▸ Use the filters to slice every chart · click a KPI card to drill into its trend · open “Alerts List” to assign and close tickets',
 survey:'▸ Search, sort and export the survey responses · dashboard filters apply here too',
 alerts:'▸ Click an alert to assign an owner, start progress or close the ticket · changes update the dashboard live',
 tables:'▸ Item statistics, reliability, correlations, group means and SPSS tests for the full sample',
 about:'▸ Guide to the dashboard, KPI definitions and data notes'};
let cur='dashboard';
function go(p){if(location.hash!=='#'+p)location.hash=p;else route()}
function route(){
  let p=(location.hash||'#dashboard').slice(1);if(!BANNERS[p])p='dashboard';
  cur=p;
  $$('.page').forEach(s=>s.classList.toggle('active',s.id==='page-'+p));
  $$('#nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===p));
  $('#banner').textContent=BANNERS[p];
  closeModal();render();scrollTo(0,0);
}
function render(){
  syncFilters();renderKPIs();
  if(cur==='dashboard')renderCharts();
  if(cur==='survey')renderSurvey();
  if(cur==='alerts')renderAlerts();
  if(cur==='tables')renderTables();
}
function refresh(){render();if(cur!=='dashboard')renderCharts_if_hidden()}
function renderCharts_if_hidden(){}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{if(!b.classList.contains('skpi'))go(b.dataset.go)}));
window.addEventListener('hashchange',route);
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(cur==='dashboard')renderCharts()},150)});
route();
})();
