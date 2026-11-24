/* Lightweight SVG chart library (no dependencies) */
(function(){
const NS='http://www.w3.org/2000/svg';
const C={teal:'#1bb6cc',blue:'#2a7de1',orange:'#f2a93b',green:'#7be0a4',purple:'#a77cf0',pink:'#ec4f85'};
const tip=document.getElementById('tip');

function el(tag,attrs,parent,text){
  const n=document.createElementNS(NS,tag);
  for(const k in attrs||{}) n.setAttribute(k,attrs[k]);
  if(text!==undefined) n.textContent=text;
  if(parent) parent.appendChild(n);
  return n;
}
function setup(box){
  box.innerHTML='';
  const w=Math.max(box.clientWidth,120), h=Math.max(box.clientHeight,100);
  const svg=el('svg',{width:w,height:h,viewBox:`0 0 ${w} ${h}`},box);
  return {svg,w,h};
}
function empty(box,msg){box.innerHTML='';const d=document.createElement('div');d.className='empty';d.textContent=msg||'No data for the current filters';box.appendChild(d)}
function showTip(e,html){
  tip.innerHTML=html;tip.classList.add('show');
  const pad=14,r=tip.getBoundingClientRect();
  let x=e.clientX+pad,y=e.clientY+pad;
  if(x+r.width>innerWidth-6)x=e.clientX-r.width-pad;
  if(y+r.height>innerHeight-6)y=e.clientY-r.height-pad;
  tip.style.left=x+'px';tip.style.top=y+'px';
}
function bindTip(node,html,onClick){
  node.classList.add('hit');
  node.addEventListener('mousemove',e=>showTip(e,html));
  node.addEventListener('mouseleave',()=>tip.classList.remove('show'));
  if(onClick){node.addEventListener('click',()=>{tip.classList.remove('show');onClick()});}
}
function niceStep(range,maxTicks){
  const cands=[.05,.1,.2,.25,.5,1,2,5,10,20,25,50,100,200,250,500,1000];
  for(const s of cands){if(range/s<=maxTicks)return s}
  return 1000;
}
const f2=(v,d=2)=>Number(v).toFixed(d);

/* horizontal bars */
function hbar(box,items,o){
  o=o||{};
  if(!items.length||items.every(i=>i.value==null))return empty(box);
  const {svg,w,h}=setup(box);
  const vals=items.map(i=>i.value).filter(v=>v!=null);
  const lo=o.lo!=null?o.lo:Math.floor((Math.min(...vals)-.15)/.2)*.2;
  const hi=o.hi!=null?o.hi:Math.ceil((Math.max(...vals)+.1)/.2)*.2;
  const step=o.step||.2;
  const maxLab=Math.max(...items.map(i=>i.label.length));
  const L=Math.min(maxLab*5.4+12,w*.38),R=14,T=6,B=20;
  const pw=w-L-R,ph=h-T-B,band=ph/items.length;
  const x=v=>L+(v-lo)/(hi-lo)*pw;
  for(let ti=0,t=lo;t<=hi+1e-9;ti++,t=Math.round((lo+ti*step)*1e4)/1e4){
    el('line',{x1:x(t),x2:x(t),y1:T,y2:T+ph,class:'grid-l'},svg);
    el('text',{x:x(t),y:h-5,'text-anchor':'middle',class:'ax'},svg,f2(t,1));
  }
  items.forEach((it,i)=>{
    const cy=T+band*i+band/2,bh=Math.min(band*.66,15);
    el('text',{x:L-6,y:cy+3.5,'text-anchor':'end',class:'ax'},svg,it.label);
    if(it.value==null)return;
    const wd=Math.max(x(it.value)-L,1);
    const r=el('rect',{x:L,y:cy-bh/2,width:wd,height:bh,fill:it.color||o.color||C.teal,rx:1.5,class:'grow-x'},svg);
    r.style.animationDelay=(i*35)+'ms';
    bindTip(r,`<b>${it.label}</b><br>${o.tipLabel||'Mean'}: ${f2(it.value)}${it.n!=null?'<br>n = '+it.n:''}`,it.onClick);
    el('text',{x:L+wd+4,y:cy+3.5,class:'lbl'},svg,f2(it.value));
  });
}

/* vertical bars (supports negatives) */
function vbar(box,items,o){
  o=o||{};
  if(!items.length||items.every(i=>i.value==null))return empty(box);
  const {svg,w,h}=setup(box);
  const vals=items.map(i=>i.value).filter(v=>v!=null);
  const mn=Math.min(...vals),mx=Math.max(...vals);
  let lo=o.lo,hi=o.hi,step=o.step;
  if(lo==null||hi==null){
    if(o.zero){
      step=step||niceStep((Math.max(mx,0)-Math.min(mn,0))*1.15,9);
      lo=mn<0?Math.floor((mn-step*.4)/step)*step:0;
      hi=mx>0?Math.max(mx*1.18,step):0;
      if(hi>0)hi=Math.ceil(hi/step)*step;
    }else{
      lo=Math.floor((mn-.2)*10)/10;hi=Math.ceil((mx+.05)*10)/10;step=step||.1;
    }
  }
  step=step||niceStep(hi-lo,7);
  const L=36,R=10,T=14,B=22,pw=w-L-R,ph=h-T-B;
  const y=v=>T+(hi-v)/(hi-lo)*ph;
  for(let ti=0,t=lo;t<=hi+1e-9;ti++,t=Math.round((lo+ti*step)*1e4)/1e4){
    el('line',{x1:L,x2:L+pw,y1:y(t),y2:y(t),class:'grid-l'},svg);
    el('text',{x:L-6,y:y(t)+3.5,'text-anchor':'end',class:'ax'},svg,o.tickFmt?o.tickFmt(t):(Math.abs(step)<1?f2(t,1):String(Math.round(t*100)/100)));
  }
  const band=pw/items.length,bw=Math.min(band*(o.zero?.74:.6),o.zero?70:64);
  const z=y(Math.max(lo,Math.min(0,hi)));
  items.forEach((it,i)=>{
    const cx=L+band*i+band/2;
    el('text',{x:cx,y:h-6,'text-anchor':'middle',class:'ax'},svg,it.label);
    if(it.value==null)return;
    const base=o.zero?z:y(lo);
    const yy=y(it.value);
    const top=Math.min(yy,base),ht=Math.max(Math.abs(base-yy),1);
    const r=el('rect',{x:cx-bw/2,y:top,width:bw,height:ht,fill:it.color||o.color||C.blue,rx:1.5,class:it.value<0?'grow-yn':'grow-y'},svg);
    r.style.animationDelay=(i*50)+'ms';
    bindTip(r,`<b>${it.label}</b><br>${o.tipLabel||'Value'}: ${o.fmt?o.fmt(it):f2(it.value,o.zero?1:2)}${it.n!=null?'<br>n = '+it.n:''}`,it.onClick);
    if(o.inside){el('text',{x:cx,y:(it.value<0?top+13:top-5),'text-anchor':'middle',class:'lbl'},svg,o.fmt?o.fmt(it):f2(it.value,1))}
    else el('text',{x:cx,y:top-5,'text-anchor':'middle',class:'lbl'},svg,o.fmt?o.fmt(it):f2(it.value));
  });
  if(o.zero&&lo<0)el('line',{x1:L,x2:L+pw,y1:z,y2:z,stroke:'#98a4b6','stroke-width':1},svg);
}

/* line + area */
function line(box,items,o){
  o=o||{};
  const vals=items.map(i=>i.value).filter(v=>v!=null);
  if(!vals.length)return empty(box);
  const {svg,w,h}=setup(box);
  const mn=Math.min(...vals),mx=Math.max(...vals);
  let step=o.step||.05;
  let lo=o.lo!=null?o.lo:Math.floor((mn-.12)/step)*step;
  let hi=o.hi!=null?o.hi:Math.ceil((mx+.1)/step)*step;
  if(hi-lo<step*3)hi=lo+step*3;
  while((hi-lo)/step>9)step*=2;
  const L=40,R=18,T=14,B=22,pw=w-L-R,ph=h-T-B;
  const x=i=>items.length===1?L+pw/2:L+pw*i/(items.length-1);
  const y=v=>T+(hi-v)/(hi-lo)*ph;
  for(let ti=0,t=lo;t<=hi+1e-9;ti++,t=Math.round((lo+ti*step)*1e4)/1e4){
    el('line',{x1:L,x2:L+pw,y1:y(t),y2:y(t),class:'grid-l'},svg);
    el('text',{x:L-6,y:y(t)+3.5,'text-anchor':'end',class:'ax'},svg,f2(t,o.dec!=null?o.dec:2));
  }
  const pts=items.map((it,i)=>it.value==null?null:[x(i),y(it.value),it,i]).filter(Boolean);
  items.forEach((it,i)=>el('text',{x:x(i),y:h-6,'text-anchor':'middle',class:'ax'},svg,it.label));
  if(pts.length>1){
    const d=pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ');
    const base=T+ph;
    el('path',{d:d+` L${pts[pts.length-1][0]} ${base} L${pts[0][0]} ${base}Z`,fill:(o.color||C.teal),'fill-opacity':.12,stroke:'none'},svg);
    const line=el('path',{d:smooth(pts),fill:'none',stroke:o.color||C.teal,'stroke-width':2.2,'stroke-linejoin':'round',class:'drawline'},svg);
  }
  pts.forEach(p=>{
    const c=el('circle',{cx:p[0],cy:p[1],r:3.6,fill:'#fff',stroke:o.color||C.teal,'stroke-width':2,class:'pop'},svg);
    c.style.animationDelay=(p[3]*90)+'ms';
    el('text',{x:p[0],y:p[1]-9,'text-anchor':'middle',class:'lbl'},svg,o.fmt?o.fmt(p[2].value):f2(p[2].value));
    const hit=el('circle',{cx:p[0],cy:p[1],r:13,fill:'transparent'},svg);
    bindTip(hit,`<b>${p[2].label}</b><br>${o.tipLabel||'Value'}: ${o.fmt?o.fmt(p[2].value):f2(p[2].value)}${p[2].n!=null?'<br>n = '+p[2].n:''}`,p[2].onClick);
  });
}
function smooth(p){
  if(p.length<3)return p.map((q,i)=>(i?'L':'M')+q[0]+' '+q[1]).join(' ');
  let d=`M${p[0][0]} ${p[0][1]}`;
  for(let i=0;i<p.length-1;i++){
    const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2,t=.18;
    d+=` C${p1[0]+(p2[0]-p0[0])*t} ${p1[1]+(p2[1]-p0[1])*t},${p2[0]-(p3[0]-p1[0])*t} ${p2[1]-(p3[1]-p1[1])*t},${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* donut with legend */
function donut(box,items,o){
  o=o||{};
  const total=items.reduce((s,i)=>s+i.value,0);
  if(!total)return empty(box);
  const {svg,w,h}=setup(box);
  const R=Math.min(h-14,w*.52)/2,r=R*.52;
  const cx=Math.min(R+16,w*.4)+ (w>420?20:0),cy=h/2;
  let a=-Math.PI/2;
  const arc=(R,r,a0,a1)=>{
    const big=a1-a0>Math.PI?1:0;
    const p=(rad,ang)=>[cx+rad*Math.cos(ang),cy+rad*Math.sin(ang)];
    const [x0,y0]=p(R,a0),[x1,y1]=p(R,a1),[x2,y2]=p(r,a1),[x3,y3]=p(r,a0);
    return `M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${big} 0 ${x3} ${y3}Z`;
  };
  items.forEach((it,i)=>{
    if(!it.value)return;
    const frac=it.value/total;
    let a1=a+frac*Math.PI*2;
    if(frac>=.9999)a1-=.0001;
    const g=el('g',{class:'pop'},svg);g.style.animationDelay=(i*80)+'ms';
    const path=el('path',{d:arc(R,r,a,a1),fill:it.color,stroke:'#fff','stroke-width':1.6},g);
    bindTip(path,`<b>${it.label}</b><br>${it.value} (${Math.round(frac*100)}%)`,it.onClick);
    if(frac>=.05){
      const m=(a+a1)/2,rr=(R+r)/2;
      el('text',{x:cx+rr*Math.cos(m),y:cy+rr*Math.sin(m)+3.5,'text-anchor':'middle',fill:'#fff','font-size':10.5,'font-weight':700,'pointer-events':'none',style:'paint-order:stroke;stroke:rgba(0,0,0,.18);stroke-width:2px'},g,Math.round(frac*100)+'%');
    }
    a=a1;
  });
  const lx=cx+R+Math.max(14,w*.06),ly=cy-(items.length*17)/2+8;
  items.forEach((it,i)=>{
    const g=el('g',{},svg);
    el('rect',{x:lx,y:ly+i*17-7,width:8,height:8,fill:it.color,rx:1},g);
    el('text',{x:lx+13,y:ly+i*17,class:'ax',style:'font-size:10.5px'},g,it.label);
    if(it.onClick){g.style.cursor='pointer';g.addEventListener('click',it.onClick)}
  });
}

window.Charts={hbar,vbar,line,donut,C,showTip,bindTip};
})();
