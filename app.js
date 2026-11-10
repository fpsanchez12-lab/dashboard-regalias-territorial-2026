
const $=id=>document.getElementById(id);
const raw=window.CONSOLIDATED_PROJECTS||[];
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>{if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null};
const txt=(v,fallback="Sin dato")=>v===null||v===undefined||String(v).trim()===""?fallback:String(v).trim();
const fmt=n=>new Intl.NumberFormat("es-CO",{maximumFractionDigits:1,minimumFractionDigits:1}).format(n||0);
const pct=n=>Number.isFinite(n)?fmt(n)+"%":"s/d";
const money=n=>Number.isFinite(n)?"$"+fmt(n/1000)+" mil MM":"s/d";
const avg=a=>{a=a.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null};
const uniq=a=>[...new Set(a.filter(x=>x&&x!=="Sin dato"))].sort((a,b)=>a.localeCompare(b,"es"));
const cleanState=v=>txt(v,"Sin estado registrado");
const cleanClass=v=>txt(v,"Sin clasificación / acción");
const cleanSource=v=>txt(v,"Sin fuente registrada");

const D=raw.map(r=>{
  const fisCurrent=num(r["Avance físico actual (%)"]), finCurrent=num(r["Avance financiero actual (%)"]);
  return {
    id:r["ID"],project:txt(r["Proyecto"],"SIN NOMBRE"),object:txt(r["Objeto / descripción"],""),
    dep:txt(r["Departamento"],"Sin ámbito territorial"),mun:txt(r["Municipio / ubicación"],"Sin ubicación"),
    sec:txt(r["Sector"],"Sin sector"),entity:txt(r["Entidad responsable"],"Sin entidad"),
    state:cleanState(r["Estado / situación"]),fis:fisCurrent??num(r["Avance físico (%)"]),
    fin:finCurrent??num(r["Avance financiero (%)"]),scope:txt(r["Alcance del avance"],""),
    total:num(r["Valor total (millones COP)"]),amount:num(r["Recursos regalías / monto referido (millones COP)"]),
    cut:txt(r["Fecha de corte"],"Sin fecha de corte"),classif:cleanClass(r["Clasificación"]),
    strategy:txt(r["Estrategia / tipo de intervención"],""),action:txt(r["Acción o compromiso"],""),
    horizon:txt(r["Plazo / horizonte"],""),obs:txt(r["Observaciones"],""),
    source:cleanSource(r["Fuente"]),url:txt(r["URL"],""),match:txt(r["Coincidencia con otras bases"],""),
    beneficiaries:num(r["Beneficiarios"]),nation:num(r["Regalías Nación (millones COP)"]),
    deptAmount:num(r["Regalías Dpto (millones COP)"]),munAmount:num(r["Regalías Municipio (millones COP)"])
  }
});

let mode="proyectos",metric="amount",term="";

function setSelect(id,values,label="Todos"){
  const el=$(id),cur=el.value;
  el.innerHTML=`<option value="TODOS">${label}</option>`+values.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join("");
  if([...el.options].some(o=>o.value===cur))el.value=cur;
}
setSelect("dep",uniq(D.map(x=>x.dep)),"Todos");
setSelect("sec",uniq(D.map(x=>x.sec)),"Todos");
setSelect("source",uniq(D.map(x=>x.source)),"Todas");
setSelect("classif",uniq(D.map(x=>x.classif)),"Todas");
setSelect("state",uniq(D.map(x=>x.state)),"Todas");

function matchesFilters(p,{ignoreProject=false}={}){
  if($("dep").value!=="TODOS"&&p.dep!==$("dep").value)return false;
  if($("sec").value!=="TODOS"&&p.sec!==$("sec").value)return false;
  if($("source").value!=="TODOS"&&p.source!==$("source").value)return false;
  if($("classif").value!=="TODOS"&&p.classif!==$("classif").value)return false;
  if($("state").value!=="TODOS"&&p.state!==$("state").value)return false;
  if(!ignoreProject&&$("project").value&&$("project").value!=="TODOS"&&String(p.id)!==$("project").value)return false;
  if($("onlyProgress").checked&&!(Number.isFinite(p.fis)||Number.isFinite(p.fin)))return false;
  if($("onlyAmount").checked&&!Number.isFinite(p.amount))return false;
  if(term){
    const hay=[p.project,p.dep,p.mun,p.sec,p.entity,p.source,p.state,p.classif].join(" ").toLowerCase();
    if(!hay.includes(term))return false;
  }
  return true;
}
function filtered(opts={}){return D.filter(p=>matchesFilters(p,opts));}

function refreshProjectOptions(){
  const el=$("project"),cur=el.value;
  const list=filtered({ignoreProject:true}).sort((a,b)=>a.project.localeCompare(b.project,"es"));
  el.innerHTML='<option value="TODOS">Todos los proyectos</option>'+list.map(p=>`<option value="${p.id}">${safe(p.project)}</option>`).join("");
  if([...el.options].some(o=>o.value===cur))el.value=cur;else el.value="TODOS";
}

function aggregate(key){
  const m=new Map();
  for(const p of filtered()){
    const name=key==="dep"?p.dep:p.sec;
    if(!m.has(name))m.set(name,{id:name,name,p:[],amount:0,amountCount:0,f:[],n:[],sources:{},states:{}});
    const g=m.get(name);g.p.push(p);
    if(Number.isFinite(p.amount)){g.amount+=p.amount;g.amountCount++}
    if(Number.isFinite(p.fis))g.f.push(p.fis);
    if(Number.isFinite(p.fin))g.n.push(p.fin);
    g.sources[p.source]=(g.sources[p.source]||0)+1;
    g.states[p.state]=(g.states[p.state]||0)+1;
  }
  return [...m.values()].map(g=>{
    g.projects=g.p.length;g.fis=avg(g.f);g.fin=avg(g.n);
    g.gap=Number.isFinite(g.fis)&&Number.isFinite(g.fin)?g.fin-g.fis:null;
    g.progressCount=g.p.filter(x=>Number.isFinite(x.fis)&&Number.isFinite(x.fin)).length;
    g.domSource=Object.entries(g.sources).sort((a,b)=>b[1]-a[1])[0]?.[0]||"Sin fuente";
    return g;
  });
}

function projectRows(){
  return filtered().map(p=>({
    id:String(p.id),name:p.project,projects:1,amount:p.amount,amountCount:Number.isFinite(p.amount)?1:0,
    fis:p.fis,fin:p.fin,gap:Number.isFinite(p.fis)&&Number.isFinite(p.fin)?p.fin-p.fis:null,
    progressCount:Number.isFinite(p.fis)&&Number.isFinite(p.fin)?1:0,domSource:p.source,p:[p],project:p
  }));
}
function currentRows(){
  let a=mode==="proyectos"?projectRows():aggregate(mode==="departamentos"?"dep":"sec");
  const val=x=>metric==="projects"?x.projects:
    metric==="physical"?(Number.isFinite(x.fis)?x.fis:-1):
    metric==="financial"?(Number.isFinite(x.fin)?x.fin:-1):
    metric==="gap"?(Number.isFinite(x.gap)?Math.abs(x.gap):-1):
    (Number.isFinite(x.amount)?x.amount:-1);
  return a.sort((a,b)=>val(b)-val(a));
}
function metricLabel(g){
  if(metric==="projects")return `${g.projects} proy.`;
  if(metric==="physical")return pct(g.fis);
  if(metric==="financial")return pct(g.fin);
  if(metric==="gap")return Number.isFinite(g.gap)?`${g.gap>0?"+":""}${fmt(g.gap)} pp`:"s/d";
  return money(g.amount);
}

function renderStats(){
  const p=filtered(), amounts=p.filter(x=>Number.isFinite(x.amount)), fis=p.filter(x=>Number.isFinite(x.fis)), fin=p.filter(x=>Number.isFinite(x.fin)), both=p.filter(x=>Number.isFinite(x.fis)&&Number.isFinite(x.fin));
  const total=amounts.reduce((s,x)=>s+x.amount,0);
  const cards=[
    ["Proyectos",p.length,"universo filtrado"],
    ["Monto referido",money(total),`${amounts.length} con monto`],
    ["Avance físico",pct(avg(fis.map(x=>x.fis))),`${fis.length} con dato`],
    ["Avance financiero",pct(avg(fin.map(x=>x.fin))),`${fin.length} con dato`],
    ["Avance comparable",`${both.length}/${p.length}`,"con físico y financiero"],
    ["Cobertura de monto",p.length?fmt(100*amounts.length/p.length)+"%":"0,0%",`${amounts.length}/${p.length} proyectos`]
  ];
  $("stats").innerHTML=cards.map(c=>`<div class="stat"><span>${c[0]}</span><b>${c[1]}</b><small>${c[2]}</small></div>`).join("");
}

function renderBars(rows){
  const top=rows.slice(0,20);
  $("bars").innerHTML=top.length?top.map(g=>`
    <div class="row" data-id="${safe(g.id)}">
      <span class="name" title="${safe(g.name)}">${safe(g.name)}</span>
      <div class="track" title="Físico ${pct(g.fis)} · Financiero ${pct(g.fin)}">
        <div class="bar fis" style="width:${Number.isFinite(g.fis)?Math.max(0,Math.min(100,g.fis)):0}%"></div>
        <div class="bar fin" style="width:${Number.isFinite(g.fin)?Math.max(0,Math.min(100,g.fin)):0}%"></div>
      </div>
      <b>${metricLabel(g)}</b>
    </div>`).join(""):`<p class="hint">No hay registros para la selección.</p>`;
  $("bars").querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>openRow(el.dataset.id));
}

function renderNarrative(){
  const p=filtered(), amounts=p.filter(x=>Number.isFinite(x.amount)), fis=p.filter(x=>Number.isFinite(x.fis)), fin=p.filter(x=>Number.isFinite(x.fin));
  const total=amounts.reduce((s,x)=>s+x.amount,0);
  const src=Object.entries(p.reduce((m,x)=>(m[x.source]=(m[x.source]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]);
  const top=src[0];
  $("narr").innerHTML=`
    <p>La selección reúne <strong>${p.length} proyectos</strong>. <strong>${amounts.length}</strong> reportan monto, por un total referido de <strong>${money(total)}</strong>.</p>
    <p>El avance físico promedio es <strong>${pct(avg(fis.map(x=>x.fis)))}</strong> sobre ${fis.length} proyectos con dato; el financiero es <strong>${pct(avg(fin.map(x=>x.fin)))}</strong> sobre ${fin.length}.</p>
    <p>${top?`La fuente con mayor número de registros es <strong>${safe(top[0])}</strong> (${top[1]} proyectos).`:""} La base integra fuentes con alcances distintos; por eso los faltantes se muestran como <strong>s/d</strong> y no se imputan.</p>`;
  renderSources(src,p.length);
}
function renderSources(src,total){
  $("sources").innerHTML=`<div class="source-list">${src.slice(0,7).map(([s,n])=>`
    <div class="source-line">
      <span class="source-name" title="${safe(s)}">${safe(s)}</span>
      <div class="source-track"><div class="source-fill" style="width:${total?100*n/total:0}%"></div></div>
      <b>${n}</b>
    </div>`).join("")}</div>`;
}

function renderTable(rows){
  $("counter").textContent=`${rows.length} ${mode==="proyectos"?"proyectos":"grupos"}`;
  if(mode==="proyectos"){
    $("tableTitle").textContent="Detalle de proyectos";
    $("tableHint").textContent="Haz clic en una fila para abrir la ficha completa del proyecto.";
    $("thead").innerHTML=`<tr><th>Proyecto</th><th>Departamento / ámbito</th><th>Municipio / ubicación</th><th>Sector</th><th>Monto referido</th><th>Físico</th><th>Financiero</th><th>Situación / estado</th><th>Fuente</th></tr>`;
    $("tb").innerHTML=rows.map(g=>{const p=g.project;return `<tr data-id="${p.id}">
      <td class="name">${safe(p.project)}</td><td>${safe(p.dep)}</td><td>${safe(p.mun)}</td><td>${safe(p.sec)}</td>
      <td class="nowrap">${money(p.amount)}</td><td>${pct(p.fis)}</td><td>${pct(p.fin)}</td>
      <td><span class="pill">${safe(p.state)}</span></td><td>${safe(p.source)}</td></tr>`}).join("");
  }else{
    const label=mode==="departamentos"?"Departamento / ámbito":"Sector";
    $("tableTitle").textContent=`Resumen por ${mode==="departamentos"?"departamento / ámbito":"sector"}`;
    $("tableHint").textContent="Haz clic en una fila para ver los proyectos que componen el grupo.";
    $("thead").innerHTML=`<tr><th>${label}</th><th>Proyectos</th><th>Monto referido</th><th>Con monto</th><th>Físico</th><th>Financiero</th><th>Con avance comparable</th><th>Fuente dominante</th></tr>`;
    $("tb").innerHTML=rows.map(g=>`<tr data-id="${safe(g.id)}">
      <td class="name">${safe(g.name)}</td><td>${g.projects}</td><td>${money(g.amount)}</td><td>${g.amountCount}/${g.projects}</td>
      <td>${pct(g.fis)}</td><td>${pct(g.fin)}</td><td>${g.progressCount}/${g.projects}</td><td>${safe(g.domSource)}</td></tr>`).join("");
  }
  $("tb").querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>openRow(el.dataset.id));
}

function field(label,value,allowHtml=false){
  const v=value===null||value===undefined||String(value).trim()===""?"s/d":value;
  return `<div class="field"><small>${safe(label)}</small><div>${allowHtml?v:safe(v)}</div></div>`;
}
function urlHtml(url){
  if(!url)return "s/d";
  try{const u=new URL(url);return `<a href="${safe(u.href)}" target="_blank" rel="noopener">Abrir fuente ↗</a>`}catch{return safe(url)}
}
function openProject(id){
  const p=D.find(x=>String(x.id)===String(id));if(!p)return;
  const gap=Number.isFinite(p.fis)&&Number.isFinite(p.fin)?p.fin-p.fis:null;
  $("detail").innerHTML=`
    <h2>${safe(p.project)}</h2>
    <div class="sub">${safe(p.dep)} · ${safe(p.mun)} · ${safe(p.sec)}</div>
    <div class="cards">
      <div><small>Monto referido</small><b>${money(p.amount)}</b></div>
      <div><small>Valor total</small><b>${money(p.total)}</b></div>
      <div><small>Avance físico</small><b>${pct(p.fis)}</b></div>
      <div><small>Avance financiero</small><b>${pct(p.fin)}</b></div>
      <div><small>Brecha</small><b>${Number.isFinite(gap)?(gap>0?"+":"")+fmt(gap)+" pp":"s/d"}</b></div>
      <div><small>Beneficiarios</small><b>${Number.isFinite(p.beneficiaries)?new Intl.NumberFormat("es-CO").format(p.beneficiaries):"s/d"}</b></div>
    </div>
    <div class="detail-grid">
      ${field("Objeto / descripción",p.object)}
      ${field("Entidad responsable",p.entity)}
      ${field("Situación / estado",p.state)}
      ${field("Clasificación / acción",p.classif)}
      ${field("Estrategia / intervención",p.strategy)}
      ${field("Acción o compromiso",p.action)}
      ${field("Plazo / horizonte",p.horizon)}
      ${field("Alcance del avance",p.scope)}
      ${field("Fecha de corte",p.cut)}
      ${field("Fuente",p.source)}
      ${field("Coincidencia con otras bases",p.match)}
      ${field("Observaciones",p.obs)}
      ${field("Regalías Nación",money(p.nation))}
      ${field("Regalías Departamento",money(p.deptAmount))}
      ${field("Regalías Municipio",money(p.munAmount))}
      ${field("URL",urlHtml(p.url),true)}
    </div>`;
  $("detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function openGroup(name){
  const key=mode==="departamentos"?"dep":"sec";
  const projects=filtered().filter(p=>p[key]===name);
  const amount=projects.filter(x=>Number.isFinite(x.amount)).reduce((s,x)=>s+x.amount,0);
  const fis=avg(projects.map(x=>x.fis)),fin=avg(projects.map(x=>x.fin));
  $("detail").innerHTML=`
    <h2>${safe(name)}</h2><div class="sub">${projects.length} proyectos en la selección actual</div>
    <div class="cards">
      <div><small>Proyectos</small><b>${projects.length}</b></div>
      <div><small>Monto referido</small><b>${money(amount)}</b></div>
      <div><small>Avance físico</small><b>${pct(fis)}</b></div>
      <div><small>Avance financiero</small><b>${pct(fin)}</b></div>
      <div><small>Con monto</small><b>${projects.filter(x=>Number.isFinite(x.amount)).length}</b></div>
      <div><small>Con avance comparable</small><b>${projects.filter(x=>Number.isFinite(x.fis)&&Number.isFinite(x.fin)).length}</b></div>
    </div>
    <h3>Proyectos del grupo</h3>
    <div class="project-list">${projects.sort((a,b)=>(b.amount||-1)-(a.amount||-1)).map(p=>`
      <div class="project-item" data-project-id="${p.id}">
        <b>${safe(p.project)}</b><span>${safe(p.mun)}</span><span>${safe(p.sec)}</span><span>${money(p.amount)}</span><span>${pct(p.fis)} / ${pct(p.fin)}</span>
      </div>`).join("")}</div>`;
  $("detail").querySelectorAll("[data-project-id]").forEach(el=>el.onclick=()=>openProject(el.dataset.projectId));
  $("detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function openRow(id){mode==="proyectos"?openProject(id):openGroup(id)}

function render(){
  refreshProjectOptions();
  const rows=currentRows();
  renderStats();renderBars(rows);renderNarrative();renderTable(rows);
}
function setMode(m){
  mode=m;
  document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("on",b.dataset.mode===m));
  render();
}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
["dep","sec","source","classif","state"].forEach(id=>$(id).onchange=()=>{refreshProjectOptions();render()});
$("project").onchange=render;
$("metric").onchange=e=>{metric=e.target.value;render()};
$("q").oninput=e=>{term=e.target.value.trim().toLowerCase();refreshProjectOptions();render()};
$("onlyProgress").onchange=()=>{refreshProjectOptions();render()};
$("onlyAmount").onchange=()=>{refreshProjectOptions();render()};
$("reset").onclick=()=>{
  term="";$("q").value="";$("metric").value="amount";metric="amount";
  ["dep","sec","source","classif","state","project"].forEach(id=>$(id).value="TODOS");
  $("onlyProgress").checked=false;$("onlyAmount").checked=false;render();
};
$("export").onclick=()=>{
  const cols=["ID","Proyecto","Departamento","Municipio / ubicación","Sector","Entidad responsable","Estado / situación","Avance físico","Avance financiero","Monto referido (millones COP)","Valor total (millones COP)","Clasificación / acción","Fuente","Fecha de corte"];
  const lines=[cols];
  for(const p of filtered())lines.push([p.id,p.project,p.dep,p.mun,p.sec,p.entity,p.state,p.fis??"",p.fin??"",p.amount??"",p.total??"",p.classif,p.source,p.cut]);
  const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\ufeff"+lines.map(r=>r.map(esc).join(";")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="proyectos_consolidados_filtrados.csv";a.click();URL.revokeObjectURL(a.href);
};
refreshProjectOptions();render();
