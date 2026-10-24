
(() => {
'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'estoque_aviamentos_indep_v1';
const SIZES = [38,40,42,44,46,48];
const REFERENCES = [
 {id:'work-sem-faixa',name:'Work RW sem faixa',items:['Cordão','Elástico']},
 {id:'work-com-faixa',name:'Work RW com faixa',items:['Cordão','Elástico','Refletivo']},
 {id:'5710',name:'5710 — Calça básica reta',items:['Etiqueta de composição jeans','Etiqueta de tamanho','Zíper 15 cm']},
 {id:'776102',name:'776102 — Calça alfaiataria',items:['Etiqueta de composição sarja','Etiqueta de tamanho','Zíper 15 cm']},
 {id:'9910',name:'9910 — Calça Wide Leg',items:['Etiqueta de tamanho','Zíper 15 cm']},
 {id:'rw107',name:'RW 107',items:['Etiqueta de composição sarja','Etiqueta de tamanho','Zíper 15 cm']},
 {id:'8120',name:'8120 — Calça alfaiataria bolso redondo (Pedido do Torra)',items:['Zíper 15 cm','Etiqueta de composição sarja','Etiqueta de tamanho']},
 {id:'8190A',name:'8190A — Calça alfaiataria com Cós',items:['Cós','Etiqueta de composição sarja','Etiqueta de tamanho','Zíper 15 cm']}
];
const defaultProducts = [
 ['Botão de ferro','Botão','', 'unidade',0,100,'Consumo de referência: 2,1 g por peça, conforme regra informada'],
 ['Botão coquinho','Botão','', 'unidade',0,100,'Consumo de referência: 0,78 g por peça, conforme regra informada'],
 ['Etiqueta de tamanho','Etiqueta','', 'unidade',0,0,'Tamanhos 38 a 48; cálculo por quantidade de cada tamanho'],
 ['Etiqueta de composição jeans','Etiqueta','', 'unidade',0,0,'Consumo informado: 0,4 g por peça'],
 ['Etiqueta de composição sarja','Etiqueta','', 'unidade',0,0,'Consumo informado: 0,4 g por peça'],
 ['Cós','Aviamento','', 'metro',0,0,'Consumo em metros; cada rolo contém 50 m'],
 ['Courinho preto','Aviamento','Preto', 'unidade',0,0,''],
 ['Courinho marrom','Aviamento','Marrom', 'unidade',0,0,''],
 ['Refletivo','Aviamento','', 'metro',0,0,'Consumo em metros; cada rolo contém 50 m'],
 ['Elástico','Aviamento','', 'metro',0,0,'Consumo em metros; rolo com 25 m; pacote com 15 rolos (375 m por pacote)'],
 ['Cordão','Aviamento','', 'unidade',0,0,'1 cordão por peça; pacote com 1.000 cordões'],
 ...['azul','bege','cinza','preto','caqui','areia'].map(c=>['Zíper 15 cm','Fechamento',c,'unidade',0,100,'Pacote de 100 unidades (valor padrão editável no cadastro)'])
];
let state = loadState();
let remoteReady = false;
let remoteRevision = 0;
let remoteSaveChain = Promise.resolve();
let currentCalc = null;
let currentPhoto = null;
let voiceRecognition = null;
function loadState(){
 try { const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); return {products:Array.isArray(s.products)?s.products:[],moves:Array.isArray(s.moves)?s.moves:[],cuts:Array.isArray(s.cuts)?s.cuts:[],audits:Array.isArray(s.audits)?s.audits:[],reservations:Array.isArray(s.reservations)?s.reservations:[],packages:Array.isArray(s.packages)?s.packages:[],workshopStock:Array.isArray(s.workshopStock)?s.workshopStock:[]}; }
 catch(e){return {products:[],moves:[],cuts:[],audits:[]};}
}
function persist(){
 const snapshot=JSON.stringify(state);
 try{localStorage.setItem(STORAGE_KEY,snapshot);}catch(e){console.warn('Não foi possível salvar o cache local:',e);}
 if(!remoteReady)return;
 remoteSaveChain=remoteSaveChain.then(async()=>{
  const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','Accept':'application/json','If-Match':String(remoteRevision)},body:snapshot});
  if(response.status===409){remoteReady=false;throw new Error('Conflito: os dados do servidor mudaram. Recarregue e compare os dados antes de continuar.');}
  if(!response.ok)throw new Error('HTTP '+response.status);
  const result=await response.json();if(Number.isFinite(Number(result.revision)))remoteRevision=Number(result.revision);
  const status=$('apiStatus');if(status)status.value='Sincronizado com PostgreSQL';
  return result;
 }).catch(error=>{
  console.error('Falha ao sincronizar com PostgreSQL:',error);
  const status=$('apiStatus');if(status)status.value='Falha ao sincronizar — dados locais preservados';
  toast('Não foi possível sincronizar com o servidor. Os dados continuam salvos neste navegador.');
 });
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(n){return Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});}
function money(n){return fmt(n);}
function toast(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),3200);}
function productLabel(p){return p.name+(p.color?' — '+p.color:'')+' ('+p.unit+')';}
function stockTotal(){return state.products.length;}
function stockUnitSummary(){const groups=new Map();state.products.forEach(p=>{const u=String(p.unit||'unidade');groups.set(u,(groups.get(u)||0)+(Number(p.qty)||0));});return [...groups].map(([u,q])=>fmt(q)+' '+u).join(' · ');}
function productMatch(name,color=''){
 const n=norm(name), c=norm(color);
 const sameName=state.products.filter(p=>norm(p.name)===n);
 if(c) return sameName.find(p=>norm(p.color||'')===c);
 return sameName.find(p=>!norm(p.color||'')) || (sameName.length===1?sameName[0]:undefined);
}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function renderAll(){renderStats();renderStock();renderProductSelects();renderMoves();renderCuts();renderHome();renderWorkshops();refreshInvProducts();renderAuditHistory();renderReports();renderReservations();renderPackages();renderForecast();}
function renderStats(){
 $('statProducts').textContent=state.products.length;
 $('statStock').textContent=String(stockTotal());const stockNote=$('statStock')?.parentElement?.querySelector('.statnote');if(stockNote)stockNote.textContent=state.products.length?'Saldos por unidade: '+stockUnitSummary():'Nenhum produto cadastrado';
 $('statCuts').textContent=state.cuts.length;
 $('statOut').textContent=state.moves.filter(m=>m.type==='saida').length;
}
function renderHome(){
 const products=[...state.products].sort((a,b)=>Number(a.qty)-Number(b.qty)).slice(0,7);
 $('homeStock').innerHTML=products.length?products.map(p=>`<div class="productrow"><div><strong>${esc(p.name)} ${p.color?'<span class="muted">· '+esc(p.color)+'</span>':''}</strong><small>${esc(p.unit)}${p.notes?' · '+esc(p.notes):''}</small></div><span class="pill ${Number(p.qty)<=0?'badge-low':'badge-ok'}">${fmt(p.qty)} ${esc(p.unit)}</span></div>`).join(''):'<div class="empty">Nenhum produto cadastrado. Use “Adicionar lista de aviamentos” para começar.</div>';
 renderProductStockChart();
 renderCategoryChart();
 renderMovementActivityChart();
 renderStockAlerts();
 const ms=[...state.moves].slice(-6).reverse();
 $('homeMoves').innerHTML=ms.length?table(['Data','Tipo','Produto','Quantidade','Destino'],ms.map(m=>[dateFmt(m.date),m.type==='entrada'?'Entrada':'Saída',m.productName,fmt(m.qty)+' '+m.unit,m.workshop||'—'])):'<div class="empty">Ainda não há movimentações.</div>';
}
function renderStockAlerts(){
 const el=$('stockAlerts'), badge=$('alertCount'); if(!el||!badge)return;
 const alerts=state.products.filter(p=>{const q=Number(p.qty)||0;return q<=0||(p.minQty!==null&&p.minQty!==undefined&&p.minQty!==''&&Number.isFinite(Number(p.minQty))&&q<=Number(p.minQty));});
 badge.textContent=alerts.length+(alerts.length===1?' alerta':' alertas');
 if(!state.products.length){el.innerHTML='<div class="alert-clear">Cadastre aviamentos para começar a receber alertas de estoque.</div>';return;}
 if(!alerts.length){el.innerHTML='<div class="alert-clear">✓ Nenhum alerta no momento. Os saldos estão acima dos mínimos definidos.</div>';return;}
 el.innerHTML=alerts.sort((a,b)=>(Number(a.qty)||0)-(Number(b.qty)||0)).map(p=>{
  const q=Number(p.qty)||0, critical=q<=0, hasMin=p.minQty!==null&&p.minQty!==undefined&&p.minQty!==''&&Number.isFinite(Number(p.minQty));
  const msg=critical?'Saldo zerado':(hasMin?'Mínimo: '+fmt(Number(p.minQty))+' '+esc(p.unit):'Defina um mínimo para este produto');
  return `<div class="alert-item ${critical?'critical':''}"><div class="alert-icon">${critical?'!':'⌁'}</div><div class="alert-copy"><strong>${esc(p.name)}${p.color?' · '+esc(p.color):''}</strong><small>${msg} · Atual: ${fmt(q)} ${esc(p.unit)}</small></div><span class="alert-status">${critical?'ZERADO':'BAIXO'}</span></div>`;
 }).join('');
}
function renderMovementActivityChart(){
 const el=$('movementActivityChart');if(!el)return;
 const count=Math.max(7,Math.min(90,Number($('homeChartPeriod')?.value||30)));
 const days=[];const today=new Date();today.setHours(0,0,0,0);
 for(let i=count-1;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');days.push({key,label:count>14?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit'}),entrada:0,saida:0});}
 const index=new Map(days.map(d=>[d.key,d]));
 (state.moves||[]).forEach(m=>{const t=new Date(m.date);if(!Number.isFinite(t.getTime()))return;const key=[t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-');const d=index.get(key);if(d&&(m.type==='entrada'||m.type==='saida'))d[m.type]++;});
 const max=Math.max(1,...days.map(d=>Math.max(d.entrada,d.saida)));
 if(!state.moves.length){el.innerHTML='<div class="chart-empty">Ainda não há movimentações para comparar.</div>';return;}
 const visible=count>30?days.filter((_,i)=>i%Math.ceil(count/30)===0||i===days.length-1):days;
 el.innerHTML=visible.map(d=>`<div class="chart-row"><div class="chart-label">${esc(d.label)}<div class="muted" style="font-size:11px;font-weight:400">${d.entrada+d.saida} registro(s)</div></div><div style="display:grid;gap:4px"><div class="chart-track" title="Entradas: ${d.entrada}"><div class="chart-bar" style="width:${d.entrada/max*100}%;background:linear-gradient(90deg,#10b981,#6ee7b7)"></div></div><div class="chart-track" title="Saídas: ${d.saida}"><div class="chart-bar" style="width:${d.saida/max*100}%;background:linear-gradient(90deg,#f97316,#fdba74)"></div></div></div><div class="chart-value">+${d.entrada} / −${d.saida}</div></div>`).join('')+`<div class="chart-legend">🟢 Entradas · 🟠 Saídas · Período: ${count} dias. Cada barra conta registros, não quantidades de unidades incompatíveis.</div>`;
}
function renderProductStockChart(){
 const el=$('homeProductChart');if(!el)return;const unit=$('homeProductUnit')?.value||'';let products=state.products.filter(p=>!unit||String(p.unit||'unidade')===unit);
 if(!products.length){el.innerHTML='<div class="chart-empty">Nenhum produto para a unidade selecionada.</div>';return;}
 if(!unit){const byUnit=new Map();products.forEach(p=>{const u=String(p.unit||'unidade');if(!byUnit.has(u))byUnit.set(u,[]);byUnit.get(u).push(p);});products=[...byUnit.values()].flatMap(list=>list.sort((a,b)=>(Number(a.qty)||0)-(Number(b.qty)||0)).slice(0,3));}
 else products=products.sort((a,b)=>(Number(a.qty)||0)-(Number(b.qty)||0)).slice(0,10);
 const max=Math.max(1,...products.map(p=>Number(p.qty)||0));
 el.innerHTML=products.map(p=>{const q=Math.max(0,Number(p.qty)||0),w=q?Math.max(2,q/max*100):0;return `<div class="chart-row"><div class="chart-label">${esc(p.name)}${p.color?' · '+esc(p.color):''}<div class="muted" style="font-size:11px;font-weight:400">${esc(p.category||'Aviamento')} · ${esc(p.unit)}</div></div><div class="chart-track"><div class="chart-bar" style="width:${w.toFixed(2)}%;background:${q===0?'linear-gradient(90deg,#ef4444,#fca5a5)':'linear-gradient(90deg,#4d8dff,#8b72ff,#4de0cf)'}"></div></div><div class="chart-value">${fmt(q)} ${esc(p.unit)}</div></div>`;}).join('')+'<div class="chart-legend">Mostrando os menores saldos por unidade; com “Todas”, cada unidade é comparada separadamente.</div>';
}
$('homeProductUnit')?.addEventListener('change',renderProductStockChart);

function renderCategoryChart(){
 const el=$('stockCategoryChart');
 if(!el)return;
 const products=Array.isArray(state.products)?state.products:[];
 if(!products.length){el.innerHTML='<div class="chart-empty">Ainda não há aviamentos cadastrados. Cadastre produtos para visualizar o gráfico.</div>';return;}
 const groups=new Map();
 products.forEach(p=>{
  const category=String(p.category||'Aviamento').trim()||'Aviamento';
  const unit=String(p.unit||'unidade');
  // Não somar metros, unidades, caixas etc. no mesmo total: cada unidade vira uma série separada.
  const key=category+'\u0000'+unit;
  if(!groups.has(key))groups.set(key,{category,unit,qty:0,count:0});
  const g=groups.get(key);g.qty+=Number(p.qty)||0;g.count+=1;
 });
 const rows=[...groups.entries()].map(([key,v])=>[key,v]).sort((a,b)=>b[1].qty-a[1].qty||a[1].category.localeCompare(b[1].category,'pt-BR')||a[1].unit.localeCompare(b[1].unit,'pt-BR'));
 const max=Math.max(...rows.map(([,v])=>v.qty),0);
 el.innerHTML=rows.map(([,v])=>{
  const width=max>0?Math.max(v.qty>0?3:0,(v.qty/max)*100):0;
  return `<div class="chart-row"><div class="chart-label">${esc(v.category)}<div class="muted" style="font-size:11px;font-weight:400">${v.count} produto(s) · ${esc(v.unit)}</div></div><div class="chart-track"><div class="chart-bar" style="width:${width.toFixed(2)}%"></div></div><div class="chart-value">${fmt(v.qty)} ${esc(v.unit)}</div></div>`;
 }).join('')+`<div class="chart-legend">${products.length} produto(s) cadastrado(s). Categorias com unidades diferentes aparecem separadas para evitar somas incorretas.</div>`;
}
function dateFmt(v){try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch(e){return '—';}}
function table(headers, rows, empty='Nenhum registro encontrado.'){
 if(!rows.length)return `<div class="empty">${empty}</div>`;
 return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c==null?'—':c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderStock(){
 const q=norm($('stockSearch')?.value||''), u=$('stockUnit')?.value||'';
 const list=state.products.filter(p=>(!q||norm([p.name,p.category,p.color,p.notes].join(' ')).includes(q))&&(!u||p.unit===u));
 $('stockTable').innerHTML=table(['Produto','Categoria','Cor','Saldo','Unidade','Conteúdo por pacote/caixa','Ações'],list.map(p=>[
 esc(p.name),esc(p.category||'Aviamento'),esc(p.color||'—'),`<strong>${fmt(p.qty)}</strong>`,esc(p.unit),p.packSize?fmt(p.packSize):'—',
 `<button class="secondary small" data-edit-product="${esc(p.id)}">Editar</button> <button class="danger small" data-delete-product="${esc(p.id)}">Excluir</button>`
 ]));
}
function renderProductSelects(){
 const opts=state.products.map(p=>`<option value="${esc(p.id)}">${esc(productLabel(p))} — saldo ${fmt(p.qty)}</option>`).join('');
 $('moveProduct').innerHTML='<option value="">Selecione um produto</option>'+opts;
 $('moveReference').innerHTML='<option value="">Sem referência</option>'+REFERENCES.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
 $('cutReference').innerHTML='<option value="">Selecione a referência</option>'+REFERENCES.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
}
function renderMoves(){
 const q=norm($('moveSearch')?.value||''),type=$('moveFilterType')?.value||'',period=$('moveFilterPeriod')?.value||'30';
 const since=period==='all'?0:Date.now()-Number(period)*86400000;
 const filtered=[...state.moves].filter(m=>{const t=new Date(m.date).getTime();const hay=norm([m.productName,m.workshop,m.oc,m.cut,m.referenceName,m.notes,m.type,m.unit].join(' '));return (!q||hay.includes(q))&&(!type||m.type===type)&&Number.isFinite(t)&&t>=since;}).reverse();
 const rows=filtered.map(m=>[dateFmt(m.date),m.type==='entrada'?'<span class="pill badge-ok">Entrada</span>':m.type==='ajuste'?'<span class="pill">Ajuste</span>':'<span class="pill badge-low">Saída</span>',esc(m.productName),fmt(m.qty)+' '+esc(m.unit),esc(m.workshop||'—'),esc(m.oc||'—'),esc(m.cut||'—'),esc(m.referenceName||'—'),esc(m.notes||'—')]);
 $('movesTable').innerHTML=table(['Data','Tipo','Produto','Quantidade','Oficina/destino','OC','Corte','Referência','Descrição'],rows, 'Nenhuma movimentação corresponde aos filtros.');
}
function workshopKey(workshop,productId){return norm(workshop)+'|'+String(productId);}
function workshopBalance(workshop,productId){ensureCollections();const row=state.workshopStock.find(x=>workshopKey(x.workshop,x.productId)===workshopKey(workshop,productId));return row?Number(row.qty)||0:0;}
function setWorkshopBalance(workshop,productId,qty,meta={}){ensureCollections();let row=state.workshopStock.find(x=>workshopKey(x.workshop,x.productId)===workshopKey(workshop,productId));if(!row){const p=state.products.find(x=>x.id===productId);row={id:uid(),workshop:workshop.trim(),productId,productName:p?productLabel(p):meta.productName||'Produto',unit:p?.unit||meta.unit||'unidade',qty:0,history:[]};state.workshopStock.push(row);}row.qty=Number(Math.max(0,qty).toFixed(3));row.updatedAt=new Date().toISOString();row.history=Array.isArray(row.history)?row.history:[];row.history.push({date:row.updatedAt,action:meta.action||'ajuste',qty:meta.delta??qty,delta:meta.delta??qty,unit:row.unit,cut:meta.cut||'',notes:meta.notes||'',before:meta.before??null,after:row.qty});return row;}
function renderWorkshops(){
 ensureCollections();
 const search=norm($('workshopSearch')?.value||'');
 const rows=[...state.moves].filter(m=>m.type==='saida'&&m.workshop).filter(m=>!search||norm([m.workshop,m.productName,m.oc,m.cut,m.referenceName,m.notes].join(' ')).includes(search)).reverse().map(m=>[dateFmt(m.date),esc(m.workshop),esc(m.productName),fmt(m.qty)+' '+esc(m.unit),esc(m.oc||'—'),esc(m.cut||'—'),esc(m.referenceName||'—'),esc(m.notes||'—')]);
 $('workshopTable').innerHTML=table(['Data','Oficina','Aviamento','Quantidade enviada','OC','Corte','Referência','Observação'],rows,'Nenhum envio corresponde à busca.');
 $('workshopBalanceTable').innerHTML=table(['Oficina','Produto','Saldo registrado','Unidade','Última atualização'],state.workshopStock.filter(x=>Number(x.qty)>0||x.history?.length).map(x=>[esc(x.workshop),esc(x.productName),`<strong>${fmt(x.qty)}</strong>`,esc(x.unit),dateFmt(x.updatedAt)]),'Ainda não há saldos de oficina registrados. Registre o saldo conhecido ou envie material por um corte novo.');
 const ledgerRows=state.workshopStock.flatMap(x=>(x.history||[]).map(h=>({workshop:x.workshop,productName:x.productName,unit:x.unit,...h}))).filter(h=>!search||norm([h.workshop,h.productName,h.action,h.cut,h.notes].join(' ')).includes(search)).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(h=>[dateFmt(h.date),esc(h.workshop),esc(h.productName),esc(h.action),`${Number(h.delta)>0?'+':''}${fmt(h.delta??h.qty)} ${esc(h.unit||'')}`,esc(h.cut||'—'),esc(h.notes||'—')]);
 $('workshopLedgerHistory').innerHTML=table(['Data','Oficina','Produto','Operação','Variação','OC / corte','Observação'],ledgerRows,'Nenhum registro de consumo, envio ou devolução encontrado.');
 const wsSel=$('wsLedgerProduct');if(wsSel){const old=wsSel.value;wsSel.innerHTML='<option value="">Selecione produto</option>'+state.products.map(p=>`<option value="${esc(p.id)}">${esc(productLabel(p))}</option>`).join('');if(state.products.some(p=>p.id===old))wsSel.value=old;}
 const reconcile=[];
 [...state.cuts].slice().reverse().forEach(c=>{
  (c.items||[]).forEach(item=>{
   const planned=Number(item.amount)||0;
   const related=(state.moves||[]).filter(m=>Boolean(String(c.number||'').trim()) && m.type==='saida' && String(m.cut||'').trim()===String(c.number||'').trim() && (!c.workshop || norm(m.workshop)===norm(c.workshop)) && (norm(m.referenceName||'')===norm(c.referenceName||'') || !m.referenceName) && (norm(m.productName||'').includes(norm(item.name)) || norm(item.name)==='ziper 15 cm'&&norm(m.productName||'').includes('ziper')) && (norm(m.baseUnit||'')===norm(item.unit||'') || (!m.baseUnit && norm(m.unit||'')===norm(item.unit||''))));
   const sent=related.reduce((sum,m)=>sum+Number(m.baseQty??m.qty??0),0);
   const missing=Math.max(0,planned-sent);
   const extra=Math.max(0,sent-planned);
   const tolerance=Math.max(0.001,Math.abs(planned)*1e-9);
   const status=sent<=tolerance?'NÃO ENVIADO':missing>tolerance?'FALTA '+fmt(missing)+' '+item.unit:extra>tolerance?'SOBRA '+fmt(extra)+' '+item.unit:'CONFERIDO';
   reconcile.push([dateFmt(c.date),esc(c.number||'—'),esc(c.workshop||'—'),esc(item.name),fmt(planned)+' '+esc(item.unit),fmt(sent)+' '+esc(item.unit),`<strong>${fmt(missing)} ${esc(item.unit)}</strong>`,`<strong>${fmt(extra)} ${esc(item.unit)}</strong>`,status]);
  });
 });
 $('workshopReconcile').innerHTML=table(['Data do cálculo','Corte','Oficina','Aviamento','Necessário','Enviado','Falta enviar','Sobra / a mais','Situação'],reconcile,'Salve um cálculo de corte para começar a conferência.');
}
function renderCuts(){
 $('cutsTable').innerHTML=table(['Data','Corte','Referência','Peças','Oficina','Resumo de aviamentos','Ações'],[...state.cuts].reverse().map(c=>[
 dateFmt(c.date),esc(c.number||'—'),esc(c.referenceName),fmt(c.totalPieces),esc(c.workshop||'—'),
 esc(c.items.map(i=>i.name+': '+fmt(i.amount)+' '+i.unit).join('; ')),
 `<div class="actions"><button class="secondary small" data-view-cut="${esc(c.id)}">Ver</button><button class="danger small" data-delete-cut="${esc(c.id)}">Apagar</button></div>`
 ]));
}
function seed(){
 let added=0;
 defaultProducts.forEach(d=>{if(!productMatch(d[0],d[2])){const n=norm(d[0]);const destination=(n.includes('botao')||n.includes('courinho'))?'Acabamento':'Costura';state.products.push({id:uid(),name:d[0],category:destination,color:d[2],unit:d[3],qty:d[4],packSize:d[5],notes:d[6],destination});added++;}});
 persist();renderAll();$('seedStatus').textContent=added?`${added} produtos adicionados. Confira unidades e conteúdo de cada embalagem.`:'Os produtos sugeridos já estão cadastrados.';
 toast(added?`${added} produtos adicionados.`:'Lista já cadastrada.');
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function goto(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.goto)));
$('stockSearch').addEventListener('input',renderStock);$('stockUnit').addEventListener('change',renderStock);
$('seedProducts').addEventListener('click',seed);
function clearProductForm(){ $('productForm').reset();$('productId').value='';$('productQty').value='0';$('productMinQty').value='';$('productCode').value='';$('productFormTitle').textContent='Novo produto';}
$('clearProduct').addEventListener('click',clearProductForm);
$('productForm').addEventListener('submit',e=>{
 e.preventDefault();
 const id=$('productId').value, p={id:id||uid(),name:$('productName').value.trim(),category:$('productCategory').value,color:$('productColor').value.trim(),unit:$('productUnit').value,qty:Number($('productQty').value),packSize:Number($('productPackSize').value)||0,code:$('productCode').value.trim(),minQty:$('productMinQty').value===''?null:Number($('productMinQty').value),notes:$('productNotes').value.trim()}; p.destination=p.category;
 if(!p.name||!Number.isFinite(p.qty)||p.qty<0||!Number.isFinite(p.packSize)||p.packSize<0)return toast('Confira nome, quantidade e conteúdo da embalagem.');
 if(id){const old=state.products.find(x=>x.id===id);if(old && p.qty!==Number(old.qty))return toast('Não altere o saldo pelo cadastro. Use Movimentações ou Inventário para manter o histórico.');if(old && p.unit!==old.unit)return toast('Não altere a unidade de um produto com cadastro existente. Crie um novo produto na unidade correta e faça o inventário.');}
 if(p.code && state.products.some(x=>x.id!==id && String(x.code||'').trim()===p.code))return toast('Este código já está cadastrado em outro produto.');
 const duplicate=state.products.find(x=>x.id!==id&&norm(x.name)===norm(p.name)&&norm(x.color||'')===norm(p.color||''));
 if(duplicate&&!confirm('Já existe um produto com este nome e cor. Deseja cadastrar mesmo assim?'))return;
 if(id){const i=state.products.findIndex(x=>x.id===id);if(i>=0)state.products[i]=p;}else state.products.push(p);
 persist();renderAll();clearProductForm();goto('estoque');toast('Produto salvo.');
});
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-edit-product]')?.dataset.editProduct;
 const del=e.target.closest('[data-delete-product]')?.dataset.deleteProduct;
 const view=e.target.closest('[data-view-cut]')?.dataset.viewCut;
 const deleteCut=e.target.closest('[data-delete-cut]')?.dataset.deleteCut;
 if(edit){const p=state.products.find(x=>x.id===edit);if(!p)return;goto('produto');$('productId').value=p.id;$('productName').value=p.name;$('productCategory').value=p.category||'Aviamento';$('productColor').value=p.color||'';$('productUnit').value=p.unit;$('productQty').value=p.qty;$('productPackSize').value=p.packSize||'';$('productCode').value=p.code||'';$('productMinQty').value=p.minQty??'';$('productNotes').value=p.notes||'';$('productFormTitle').textContent='Editar produto';}
 if(del){const p=state.products.find(x=>x.id===del);if(!p)return;if(Number(p.qty)!==0&&!confirm('Este produto tem saldo. Excluir mesmo assim?'))return;if(!confirm('Excluir '+p.name+'?'))return;state.products=state.products.filter(x=>x.id!==del);persist();renderAll();toast('Produto excluído.');}
 if(deleteCut){const c=state.cuts.find(x=>x.id===deleteCut);if(!c)return;if(!confirm(`Apagar o cálculo do corte ${c.number||'—'} (${c.referenceName||'sem referência'})?\n\nIsso remove somente o cálculo salvo. Não apaga movimentações, saídas, reservas ou altera o saldo do estoque.`))return;state.cuts=state.cuts.filter(x=>x.id!==deleteCut);if(currentCalc?.id===deleteCut){currentCalc=null;$('cutResults').classList.add('hidden');$('bulkIssuePanel').classList.add('hidden');}persist();renderAll();toast('Cálculo apagado. O estoque e as movimentações foram mantidos.');}
 if(view){const c=state.cuts.find(x=>x.id===view);if(c){alert(`Corte: ${c.number||'—'}\nReferência: ${c.referenceName}\nPeças: ${c.totalPieces}\n\n${c.items.map(i=>`${i.name}: ${fmt(i.amount)} ${i.unit}${i.detail?' ('+i.detail+')':''}`).join('\n')}`);}}
});
function buildSizeGrid(){ $('sizeGrid').innerHTML=SIZES.map(s=>`<div class="sizebox"><label for="size${s}">Tam. ${s}</label><input id="size${s}" type="number" min="0" step="1" value="0" inputmode="numeric"></div>`).join('');}
function getGrade(){const pairs=Math.max(0,Math.floor(Number($('cutPairs').value)||0));return SIZES.map(s=>{const perPair=Math.max(0,Math.floor(Number($('size'+s).value)||0));return {size:s,perPair,qty:perPair*pairs};});}
function calculateCut(){
 const ref=REFERENCES.find(r=>r.id===$('cutReference').value);if(!ref){toast('Selecione uma referência.');return null;}
 const pairs=Math.max(0,Math.floor(Number($('cutPairs').value)||0));if(pairs<=0){toast('Informe a quantidade de pares do corte.');return null;}
 const grade=getGrade(), total=grade.reduce((a,x)=>a+x.qty,0);if(total<=0){toast('Informe a grade: quantas peças de cada tamanho há em um par.');return null;}
 const items=[];
 for(const rawName of ref.items){
  const name=rawName;
  if(name==='Etiqueta de tamanho'){
   const labels=grade.filter(g=>g.qty>0).map(g=>({size:g.size,qty:g.qty,grams:g.qty*.35}));
   items.push({name,amount:total,unit:'unidades',detail:`peso total ${fmt(labels.reduce((a,x)=>a+x.grams,0))} g; por tamanho: ${labels.map(x=>`${x.size}: ${fmt(x.qty)} un. / ${fmt(x.grams)} g`).join(', ')}`,grams:labels.reduce((a,x)=>a+x.grams,0),bySize:labels});
  } else if(name.startsWith('Etiqueta de composição')){
   items.push({name,amount:total,unit:'unidades',detail:`peso de referência ${fmt(total*.4)} g`,grams:total*.4});
  } else if(name==='Zíper 15 cm'){
   items.push({name,amount:total,unit:'unidades',detail:`distribuir pela cor cadastrada; pacotes conforme cadastro`});
  } else if(name==='Cordão'){
   items.push({name,amount:total,unit:'unidades',detail:`${fmt(total)} cordões necessários; consumo de 1 cordão por peça. Pacote com 1.000 cordões; a retirada será registrada em pacotes equivalentes e unidades, preservando a sobra na oficina.`});
  } else if(name==='Elástico'){
   const meters=total*.8;
   const rolls=Math.ceil(meters/25);
   const packs=Math.floor(rolls/15);
   const looseRolls=rolls%15;
   const openedPacks=looseRolls>0?1:0;
   const remainingInOpenedPack=looseRolls>0?15-looseRolls:0;
   items.push({
    name, amount:meters, unit:'metros', rolls, packs, looseRolls, openedPacks, remainingInOpenedPack,
    detail:`${fmt(meters)} m necessários; ${fmt(rolls)} rolos de 25 m = ${fmt(packs)} pacote(s) fechado(s)${looseRolls?` + abrir 1 pacote e retirar ${fmt(looseRolls)} rolo(s), sobrando ${fmt(remainingInOpenedPack)} rolo(s) nele`:''}`
   });
  } else if(name==='Refletivo'){
   const meters=total*1, rolls=Math.ceil(meters/50);
   items.push({name,amount:meters,unit:'metros',detail:`${fmt(rolls)} rolos de 50 m`,rolls});
  } else if(name==='Cós'){
   const meters=total*1.3, rolls=Math.ceil(meters/50);
   items.push({name,amount:meters,unit:'metros',detail:`${fmt(rolls)} rolos de 50 m`,rolls});
  } else if(name==='Botão de ferro'){
   items.push({name,amount:total*2.1,unit:'gramas',detail:`${fmt(total*2.1/1000)} kg; confirmar se a regra é peso ou quantidade de botões`,grams:total*2.1});
  } else if(name==='Botão coquinho'){
   items.push({name,amount:total*.78,unit:'gramas',detail:`${fmt(total*.78/1000)} kg; confirmar se a regra é peso ou quantidade de botões`,grams:total*.78});
  } else {
   items.push({name,amount:total,unit:'unidades',detail:'1 por peça assumido para etiqueta/aviamento unitário; confirmar consumo quando aplicável'});
  }
 }
 return {id:uid(),date:new Date().toISOString(),oc:$('cutOC')?.value.trim()||'',number:$('cutNumber').value.trim(),referenceId:ref.id,referenceName:ref.name,pairs,grade,totalPieces:total,workshop:$('cutWorkshop').value.trim(),notes:$('cutNotes').value.trim(),items,extraCalculations:[{name:'Botão de ferro — peso de referência',amount:total*2.1,unit:'g',detail:`${fmt(total*2.1/1000)} kg`},{name:'Botão coquinho — peso de referência',amount:total*.78,unit:'g',detail:`${fmt(total*.78/1000)} kg`}]};
}
function renderCalc(c){
 $('cutResults').classList.remove('hidden');
 const gradeRows=(c.grade||[]).filter(g=>Number(g.perPair)>0).map(g=>({
  Tamanho:g.size, 'Peças por par':g.perPair, 'Pares':c.pairs||0, 'Total de peças':Number(g.perPair)*(Number(c.pairs)||0)
 }));
 const gradeHtml=table(['Tamanho','Peças por par','Pares do corte','Total de peças'],gradeRows.map(g=>[g.Tamanho,fmt(g['Peças por par']),fmt(g.Pares),`<strong>${fmt(g['Total de peças'])}</strong>`]));
 $('cutSummary').innerHTML=`<strong>${esc(c.referenceName)}</strong><br>Quantidade do corte: <strong>${fmt(c.pairs||0)} pares</strong><br>Total calculado: <strong>${fmt(c.totalPieces)} peças</strong><br>Número do corte: ${esc(c.number||'não informado')}<div class="divider"></div><strong>Conferência da grade</strong>${gradeHtml}`;
 const itemCards=c.items.map(i=>{
  let extra='';
  if(i.name==='Etiqueta de tamanho'){
   const bySize=(i.bySize||[]).map(x=>`<div class="label-size-row"><span>Tamanho <strong>${x.size}</strong></span><span>${fmt(x.qty)} etiquetas</span><span>${fmt(x.grams)} g</span></div>`).join('');
   extra=`<div class="label-breakdown"><div class="label-total"><span>Peso total estimado</span><strong>${fmt(i.grams||0)} g</strong></div><div class="label-size-head"><span>Por tamanho</span><span>Quantidade</span><span>Peso</span></div>${bySize}</div>`;
  } else if(String(i.name).startsWith('Etiqueta de composição')) {
   extra=`<div class="label-breakdown"><div class="label-total"><span>Peso total estimado (0,4 g por peça)</span><strong>${fmt(i.grams||0)} g</strong></div></div>`;
  } else if(i.detail) extra=`<p class="aviamento-detail">${esc(i.detail)}</p>`;
  return `<article class="aviamento-result"><div class="aviamento-result-top"><strong>${esc(i.name)}</strong><span class="aviamento-amount">${fmt(i.amount)} ${esc(i.unit)}</span></div>${extra}</article>`;
 }).join('');
 $('cutTable').innerHTML=`<div class="aviamento-results">${itemCards}</div><div class="divider"></div><h4>Pesos de referência dos botões (não somados ao consumo da referência)</h4>` + table(['Item','Peso calculado','Equivalência'],(c.extraCalculations||[]).map(i=>[esc(i.name),`<strong>${fmt(i.amount)} ${esc(i.unit)}</strong>`,esc(i.detail)]));
}
$('cutForm').addEventListener('submit',e=>{e.preventDefault();currentCalc=calculateCut();if(currentCalc)renderCalc(currentCalc);});
$('resetCut').addEventListener('click',()=>{SIZES.forEach(s=>$('size'+s).value=0);$('cutPairs').value='';$('cutOC').value='';$('cutNumber').value='';$('cutWorkshop').value='';$('cutNotes').value='';currentCalc=null;$('cutResults').classList.add('hidden');});
$('saveCut').addEventListener('click',()=>{if(!currentCalc)return;if(state.cuts.some(c=>c.id===currentCalc.id)){toast('Este cálculo já foi salvo.');return;}const number=String(currentCalc.number||'').trim();if(number&&state.cuts.some(c=>String(c.number||'').trim()===number)){toast('Já existe um cálculo salvo com este número de corte. Use outro número ou consulte o cálculo existente.');return;}state.cuts.push(currentCalc);persist();renderAll();toast('Cálculo salvo.');});
$('deleteAllCuts').addEventListener('click',()=>{if(!state.cuts.length)return toast('Não há cálculos salvos para apagar.');if(!confirm(`Apagar TODOS os ${state.cuts.length} cálculos salvos?\n\nEsta ação remove somente os cálculos. Não apaga movimentações, saídas para oficina, reservas, produtos ou saldos de estoque. Essa ação não pode ser desfeita sem um backup.`))return;const ids=new Set(state.cuts.map(c=>c.id));state.cuts=[];if(currentCalc&&ids.has(currentCalc.id)){currentCalc=null;$('cutResults').classList.add('hidden');$('bulkIssuePanel').classList.add('hidden');}persist();renderAll();toast('Todos os cálculos foram apagados. Estoque e movimentações preservados.');});
function stockUnitFactor(product, calculatedUnit){
 const pu=norm(product.unit||'unidade'), cu=norm(calculatedUnit||'unidades');
 const pn=norm(product.name||'');
 const unitAliases={unidades:'unidade',metros:'metro',gramas:'grama'};
 const base=unitAliases[cu]||cu;
 // Factores de embalagem conhecidos pelo processo informado pelo usuário.
 // Elástico: 15 rolos por pacote, 25 m por rolo = 375 m/pacote.
 // Refletivo: 20 rolos por caixa/pacote, 50 m por rolo = 1.000 m.
 // Cordão: 1.000 cordões por pacote; 1 cordão por peça.
 if(pn.includes('cordao') && base==='unidade'){
  if(pu==='pacote') return 1000;
  if(pu==='caixa' && Number(product.packSize)>0) return Number(product.packSize);
  if(pu==='unidade') return 1;
 }
 if(base==='metro' && pn.includes('elastic')){
  if(pu==='pacote') return 375;
  if(pu==='rolo' || pu==='unidade') return 25;
  if(pu==='metro') return 1;
 }
 if(base==='metro' && pn.includes('refletivo')){
  if(pu==='caixa' || pu==='pacote') return 1000;
  if(pu==='unidade' || pu==='rolo') return 50;
  if(pu==='metro') return 1;
 }
 if(pu===base) return 1;
 if(base==='grama'&&pu==='kg') return 1000;
 if(base==='metro'&&['pacote','caixa'].includes(pu)) return Number(product.packSize)||0;
 if(base==='metro'&&pu==='rolo') return Number(product.packSize)||50;
 if(base==='metro'&&pu==='unidade') return Number(product.packSize)||0;
 if(base==='unidade'&&['pacote','caixa','rolo'].includes(pu)) return Number(product.packSize)||0;
 if(base==='grama'&&pu==='pacote') return Number(product.packSize)||0;
 return 0;
}
function packagingBreakdown(item, product){
 const name=norm(item.name), unit=norm(item.unit), pu=norm(product.unit||'');
 const amount=Number(item.amount)||0;
 if(name==='cordao' && unit==='unidades'){
  const units=Math.ceil(amount), packs=Math.floor(units/1000), loose=units%1000, remainder=loose?1000-loose:0;
  const equivalent=units/1000;
  return `Separação: ${packs} pacote(s) fechado(s)${loose?` + ${loose} cordão(ões) de 1 pacote aberto, sobrando ${remainder} cordão(ões) nesse pacote`:''}. Baixa equivalente no estoque por pacote: ${fmt(equivalent)} pacote(s).`;
 }
 if(unit!=='metros') return '';
 const meters=amount;
 if(name==='elastic' || name==='elastico'){
  const rolls=Math.ceil(meters/25), packs=Math.floor(rolls/15), loose=rolls%15;
  const stockEquivalent=rolls/15;
  const roundedMeters=rolls*25;
  return `Separação física: ${packs} pacote(s) fechado(s)${loose?` + ${loose} rolo(s) retirado(s) de 1 pacote aberto, sobrando ${15-loose} rolo(s) nesse pacote`:''}; ${rolls} rolos no total (${fmt(roundedMeters)} m separados). Baixa equivalente no estoque por pacote: ${fmt(stockEquivalent)} pacote(s). A baixa é por pacote/rolo, não por metros.`;
 }
 if(name==='refletivo'){
  const rolls=Math.ceil(meters/50), boxes=Math.floor(rolls/20), loose=rolls%20;
  const stockEquivalent=rolls/20;
  const roundedMeters=rolls*50;
  return `Separação física: ${boxes} caixa(s) fechada(s)${loose?` + ${loose} rolo(s) retirado(s) de 1 caixa aberta, sobrando ${20-loose} rolo(s) nessa caixa`:''}; ${rolls} rolos no total (${fmt(roundedMeters)} m separados). Baixa equivalente no estoque por caixa/pacote: ${fmt(stockEquivalent)} caixa(s). A baixa é por caixa/rolo, não por metros.`;
 }
 return '';
}
function stockWithdrawalQty(item, product){
 const name=norm(item.name), unit=norm(item.unit), pu=norm(product.unit||'');
 const amount=Number(item.amount)||0;
 if(unit==='unidades' && name==='cordao'){
  const units=Math.ceil(amount);
  if(pu==='pacote') return units/1000;
  if(pu==='unidade') return units;
  if(pu==='caixa' && Number(product.packSize)>0) return units/Number(product.packSize);
 }
 if(unit==='metros' && (name==='elastic'||name==='elastico')){
  const rolls=Math.ceil(amount/25);
  if(pu==='pacote') return rolls/15;
  if(pu==='rolo'||pu==='unidade') return rolls;
  if(pu==='metro') return amount;
 }
 if(unit==='metros' && name==='refletivo'){
  const rolls=Math.ceil(amount/50);
  if(pu==='caixa'||pu==='pacote') return rolls/20;
  if(pu==='unidade'||pu==='rolo') return rolls;
  if(pu==='metro') return amount;
 }
 const factor=stockUnitFactor(product,item.unit);
 return factor>0?amount/factor:0;
}
function updateBulkRow(index){
 const select=$(`[data-bulk-product="${index}"]`), qty=$(`[data-bulk-qty="${index}"]`), hint=$(`[data-bulk-conversion="${index}"]`);
 if(!select||!qty||!hint||!currentCalc)return;
 const item=currentCalc.items[index], product=state.products.find(p=>p.id===select.value);
 if(!product){hint.textContent='Selecione um produto compatível com a unidade calculada.';return;}
 const factor=stockUnitFactor(product,item.unit);
 if(!(factor>0)){hint.textContent=`Unidade incompatível: o cálculo está em ${item.unit}, mas o estoque está em ${product.unit}. Informe o conteúdo por pacote/caixa ou cadastre uma unidade compatível.`;qty.value='0';return;}
 const converted=stockWithdrawalQty(item,product);
 qty.value=converted.toFixed(3);
 const breakdown=packagingBreakdown(item,product);
 hint.textContent=`Conversão: ${fmt(item.amount)} ${item.unit} = ${fmt(converted)} ${product.unit} (1 ${product.unit} = ${fmt(factor)} ${item.unit}).`+(breakdown?' '+breakdown:'');
}
function openBulkIssue(){
 if(!currentCalc)return;
 const panel=$('bulkIssuePanel');panel.classList.remove('hidden');
 $('bulkWorkshop').value=currentCalc.workshop||'';$('bulkCutNumber').value=currentCalc.number||'Não informado';$('bulkOC').value=currentCalc.oc||'';
 const products=state.products;
 const rows=(currentCalc.items||[]).map((item,index)=>{
  const itemName=norm(item.name);
  let matches=products.filter(p=>norm(p.name)===itemName);
  // Zíper: não selecionar uma cor automaticamente. A pessoa deve escolher a cor correta.
  if(!matches.length && itemName.startsWith('etiqueta de composicao')) matches=products.filter(p=>norm(p.name)===itemName);
  const selected=(itemName==='ziper 15 cm'?'':(matches[0]?.id||''));
  const compatible=products.filter(p=>matches.some(m=>m.id===p.id));
  const options=compatible.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(productLabel(p))} — saldo ${fmt(p.qty)}</option>`).join('');
  const selectedProduct=products.find(p=>p.id===selected);
  const factor=selectedProduct?stockUnitFactor(selectedProduct,item.unit):1;
  const defaultQty=selectedProduct&&factor>0&&!item.requiresManual?stockWithdrawalQty(item,selectedProduct):0;
  return `<div class="card bulk-line" style="margin-bottom:10px" data-bulk-line="${index}"><div class="fieldgrid"><div class="field"><label>Aviamento calculado</label><input readonly value="${esc(item.name)}"></div><div class="field"><label>Necessidade calculada</label><input readonly value="${fmt(item.amount)} ${esc(item.unit)}"></div><div class="field"><label>Produto do estoque</label><select data-bulk-product="${index}"><option value="">${compatible.length?'Selecione o produto':'Nenhum produto compatível cadastrado'}</option>${options}</select></div><div class="field"><label>Quantidade a retirar (unidade do estoque)</label><input data-bulk-qty="${index}" type="number" min="0" step="0.001" value="${defaultQty.toFixed(3)}"></div><div class="field full"><small class="muted" data-bulk-conversion="${index}">${item.requiresManual?'Consumo não definido: informe a quantidade manualmente e selecione o produto correto.':(selectedProduct&&factor>0?`Conversão: ${fmt(item.amount)} ${esc(item.unit)} = ${fmt(defaultQty)} ${esc(selectedProduct.unit)}. ${esc(packagingBreakdown(item,selectedProduct))}`:'Selecione um produto compatível com a unidade calculada.')}</small></div></div></div>`;
 }).join('');
 $('bulkIssueItems').innerHTML=rows||'<div class="empty">Este cálculo não possui aviamentos para enviar.</div>';
 (currentCalc.items||[]).forEach((item,index)=>{const sel=$(`[data-bulk-product="${index}"]`);if(sel)sel.addEventListener('change',()=>updateBulkRow(index));});
 panel.scrollIntoView({behavior:'smooth',block:'start'});
}
$('cutToIssue').addEventListener('click',openBulkIssue);
$('cancelBulkIssue').addEventListener('click',()=>$('bulkIssuePanel').classList.add('hidden'));
let bulkIssueInProgress=false;
$('confirmBulkIssue').addEventListener('click',()=>{
 if(bulkIssueInProgress)return;
 if(!currentCalc)return;
 const cutNumber=String(currentCalc.number||'').trim();
 if(!cutNumber)return toast('Informe o número do corte antes de registrar uma saída vinculada.');
 if(!state.cuts.some(c=>c.id===currentCalc.id))return toast('Salve o cálculo antes de registrar a saída. Isso permite conferir calculado × enviado no histórico.');
 const workshop=$('bulkWorkshop').value.trim();if(!workshop)return toast('Informe o nome da oficina.');
 const lines=(currentCalc.items||[]).map((item,index)=>({item,index,productId:$(`[data-bulk-product="${index}"]`)?.value||'',qty:Number($(`[data-bulk-qty="${index}"]`)?.value)}));
 if(!lines.length)return toast('Este corte não possui aviamentos para enviar.');
 const incomplete=lines.find(line=>!line.productId||!Number.isFinite(line.qty)||line.qty<0);
 if(incomplete)return toast(`Envio cancelado: preencha produto e quantidade para todos os aviamentos, incluindo ${incomplete.item.name}. Nenhuma saída foi registrada.`);
 const totalsByProduct=new Map();
 for(const line of lines){
  const p=state.products.find(x=>x.id===line.productId);if(!p)return toast(`Selecione o produto do estoque para ${line.item.name}.`);
  if(!Number.isFinite(line.qty)||line.qty<0)return toast(`Confira a quantidade de ${line.item.name}. Informe zero se não houver material para enviar.`);
  const factor=stockUnitFactor(p,line.item.unit);if(!(factor>0))return toast(`Unidade incompatível para ${line.item.name}. Cadastre conteúdo por pacote/caixa ou escolha produto em ${line.item.unit}.`);
  const expected=line.item.requiresManual?null:stockWithdrawalQty(line.item,p);
  // Quantidade enviada pode ser parcial ou extra. A necessidade calculada é referência; o saldo disponível continua sendo respeitado.
  const baseQty=line.qty*factor;line.baseQty=baseQty;line.factor=factor;line.expectedQty=expected;line.missingQty=expected===null?null:Math.max(0,expected-line.qty);line.extraQty=expected===null?null:Math.max(0,line.qty-expected);
  totalsByProduct.set(p.id,(totalsByProduct.get(p.id)||0)+line.qty);
 }
 for(const [productId,totalQty] of totalsByProduct){const p=state.products.find(x=>x.id===productId);const available=currentCalc.oc?availableForOC(p,currentCalc.oc):availableQty(p);if(totalQty>available+1e-9)return toast(`Saldo livre insuficiente para ${p.name}. Você informou ${fmt(totalQty)} ${p.unit}, mas há ${fmt(available)} ${p.unit} disponíveis. Reduza a quantidade para registrar uma saída parcial.`);}
 if(bulkIssueInProgress)return;
 bulkIssueInProgress=true;
 const now=new Date().toISOString();
 const dispatchLines=[];
 for(const line of lines){
  const p=state.products.find(x=>x.id===line.productId),before=Number(p.qty)||0;
  const expected=line.expectedQty;
  dispatchLines.push({productId:p.id,productName:productLabel(p),unit:p.unit,required:expected, sent:line.qty, missing:line.missingQty, extra:line.extraQty, workshop, oc:currentCalc.oc||'', cut:currentCalc.number||'', date:now});
  if(line.qty<=0)continue;
  p.qty=Number((before-line.qty).toFixed(3));
  if(workshop&&line.qty>0){const wb=workshopBalance(workshop,p.id);setWorkshopBalance(workshop,p.id,wb+line.qty,{action:'envio do estoque central',qty:line.qty,cut:currentCalc.number||'',notes:`OC ${currentCalc.oc||'—'}`,before:wb,delta:line.qty});}
  const shortage=line.missingQty>0?`Envio parcial; faltam ${fmt(line.missingQty)} ${p.unit}.`:'';
  const extra=line.extraQty>0?` Envio extra de ${fmt(line.extraQty)} ${p.unit}; conferir sobra na oficina.`:'';
  state.moves.push({id:uid(),date:now,type:'saida',productId:p.id,productName:productLabel(p),qty:line.qty,unit:p.unit,baseQty:line.baseQty,baseUnit:line.item.unit,workshop,oc:currentCalc.oc||'',cut:currentCalc.number||'',referenceId:currentCalc.referenceId||'',referenceName:currentCalc.referenceName||'',notes:`Envio de corte. ${shortage}${extra}`.trim(),balanceBefore:before,balanceAfter:Number(p.qty),actor:'Local user'});
 }
 currentCalc.lastDispatch={date:now,workshop,oc:currentCalc.oc||'',cut:currentCalc.number||'',lines:dispatchLines};
 const savedCut=state.cuts.find(c=>c.id===currentCalc.id);if(savedCut)savedCut.lastDispatch=currentCalc.lastDispatch;
 if(currentCalc.oc){for(const [productId,totalQty] of totalsByProduct)fulfillReservationsForOC(productId,currentCalc.oc,totalQty);}
 persist();renderAll();$('bulkIssuePanel').classList.add('hidden');bulkIssueInProgress=false;const pending=lines.filter(line=>line.missingQty>0);toast(pending.length?`Envio registrado para ${workshop}. ${pending.length} item(ns) ficaram pendentes por falta de material; consulte o corte salvo.`:`Envio registrado para ${workshop}. Confira as quantidades enviadas e eventuais sobras.`);
});
$('moveForm').addEventListener('submit',e=>{
 e.preventDefault();const p=state.products.find(x=>x.id===$('moveProduct').value);if(!p)return toast('Selecione um produto.');
 const type=$('moveType').value,qty=Number($('moveQty').value),before=Number(p.qty)||0;if(!Number.isFinite(qty)||qty<=0)return toast('Informe uma quantidade válida.');
 if(type==='saida'&&qty>availableQty(p)+1e-9)return toast(`Saldo livre insuficiente após reservas. Disponível para saída: ${fmt(availableQty(p))} ${p.unit}; saldo físico: ${fmt(p.qty)} ${p.unit}.`);
 p.qty=Number((Number(p.qty)+(type==='entrada'?qty:-qty)).toFixed(3));
 const ref=REFERENCES.find(r=>r.id===$('moveReference').value);
 state.moves.push({id:uid(),date:new Date().toISOString(),type,productId:p.id,productName:productLabel(p),qty,unit:p.unit,workshop:$('moveWorkshop').value.trim(),cut:$('moveCut').value.trim(),referenceId:ref?.id||'',referenceName:ref?.name||'',notes:$('moveNotes').value.trim(),balanceBefore:before,balanceAfter:Number(p.qty),actor:'Local user'});
 persist();renderAll();$('moveQty').value='';$('moveWorkshop').value='';$('moveCut').value='';$('moveReference').value='';$('moveNotes').value='';toast(type==='entrada'?'Entrada registrada.':'Saída registrada.');
});
function openPhoto(){goto('foto');$('photoFile').click();}
$('photoTop').addEventListener('click',openPhoto);
$('voiceTop').addEventListener('click',()=>{goto('foto');startVoice();});
$('photoFile').addEventListener('change',()=>{currentPhoto=$('photoFile').files[0]||null;if(currentPhoto)toast('Foto selecionada. Clique em “Ler texto da foto”.');});
$('runOcr').addEventListener('click',async()=>{
 if(!currentPhoto)return toast('Selecione ou tire uma foto primeiro.');
 if(!('createWorker' in (window.Tesseract||{}))){
  try{await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');}catch(e){return toast('Não foi possível carregar o leitor de texto. Cole o texto manualmente.');}
 }
 try{
  $('runOcr').disabled=true;$('runOcr').textContent='Lendo foto…';
  const worker=await Tesseract.createWorker('por');const res=await worker.recognize(currentPhoto);$('ocrText').value=res.data.text||'';await worker.terminate();toast('Leitura concluída. Confira o texto antes de interpretar.');
 }catch(e){toast('Não foi possível ler a foto. Tente uma imagem mais nítida ou digite a lista.');}
 finally{$('runOcr').disabled=false;$('runOcr').textContent='Ler texto da foto';}
});
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
function parseLines(text){
 return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
  // Supports examples like "500 zíper preto", "Zíper preto - 500 unidades", "Elástico: 4 pacotes".
  let qty=null,unit=null,name=line;
  let m=line.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(unidades?|unid\.?|pacotes?|caixas?|rolos?|metros?|m|gramas?|g|kg)?\s*(?:de\s+)?(.+)$/i);
  if(m){qty=Number(m[1].replace(',','.'));unit=normalizeUnit(m[2]||'unidade');name=m[3].replace(/^[-:–]\s*/,'').trim();}
  else {m=line.match(/^(.+?)[\s:–-]+(\d+(?:[.,]\d+)?)\s*(unidades?|unid\.?|pacotes?|caixas?|rolos?|metros?|m|gramas?|g|kg)?$/i);if(m){name=m[1].trim();qty=Number(m[2].replace(',','.'));unit=normalizeUnit(m[3]||'unidade');}}
  if(qty===null||!name)return null;
  return {raw:line,name,qty,unit};
 }).filter(Boolean);
}
function normalizeUnit(u){u=norm(u);if(u.startsWith('pacot'))return'pacote';if(u.startsWith('caix'))return'caixa';if(u.startsWith('rolo'))return'rolo';if(u==='m'||u.startsWith('metro'))return'metro';if(u==='g'||u.startsWith('gram'))return'grama';if(u==='kg')return'kg';return'unidade';}
function renderDraft(target,items,mode){
 if(!items.length){$(target).innerHTML='<div class="notice warning">Não consegui identificar linhas com quantidade. Revise o texto ou preencha manualmente.</div>';return;}
 $(target).innerHTML=`<div class="divider"></div><h4>Itens interpretados — revise antes de confirmar</h4>${items.map((x,i)=>`<div class="fieldgrid" style="margin:10px 0"><div class="field"><label>Produto ${i+1}</label><input data-draft-name="${i}" value="${esc(x.name)}"></div><div class="field"><label>Quantidade / unidade</label><div style="display:flex;gap:6px"><input data-draft-qty="${i}" type="number" min="0" step="0.001" value="${x.qty}" style="width:55%"><select data-draft-unit="${i}" style="width:45%">${['unidade','pacote','caixa','rolo','metro','grama','kg'].map(u=>`<option ${u===x.unit?'selected':''}>${u}</option>`).join('')}</select></div></div></div>`).join('')}<div class="actions"><button class="primary" id="confirmDraft">Confirmar itens</button></div>`;
 $('confirmDraft').addEventListener('click',()=>{
  const vals=items.map((x,i)=>({name:document.querySelector(`[data-draft-name="${i}"]`).value.trim(),qty:Number(document.querySelector(`[data-draft-qty="${i}"]`).value),unit:document.querySelector(`[data-draft-unit="${i}"]`).value}));
  if(!vals.length||vals.some(x=>!x.name||!Number.isFinite(x.qty)||x.qty<=0))return toast('Confira todos os nomes e quantidades. Nenhuma alteração foi feita.');
  const prepared=[], errors=[];
  for(const v of vals){
   let p=productMatch(v.name);
   // Match common "zíper preto" phrasing to the canonical product and exact color.
   if(!p){const m=norm(v.name).match(/^(?:ziper|fecho)\s+(preto|azul|bege|cinza|caqui|areia)$/);if(m)p=productMatch('Zíper 15 cm',m[1]);}
   if(mode==='entrada'){
    if(p && p.unit!==v.unit){errors.push(`${v.name}: unidade informada ${v.unit}, produto cadastrado em ${p.unit}`);continue;}
    if(!p && /^ziper\s+(preto|azul|bege|cinza|caqui|areia)$/i.test(norm(v.name))){errors.push(`${v.name}: não encontrei a cor correspondente cadastrada. Cadastre/seleciona o zíper correto; não será criado um produto duplicado.`);continue;}
    prepared.push({v,p,create:!p});
   } else if(mode==='saida'){
    if(!p){errors.push(`${v.name}: produto não encontrado no estoque`);continue;}
    if(p.unit!==v.unit){errors.push(`${v.name}: unidade informada ${v.unit}, produto cadastrado em ${p.unit}`);continue;}
    if(v.qty>availableQty(p)+1e-9){errors.push(`${v.name}: saldo disponível insuficiente após reservas (disponível ${fmt(availableQty(p))} ${p.unit}; físico ${fmt(p.qty)} ${p.unit})`);continue;}
    prepared.push({v,p,create:false});
   }
  }
  if(errors.length){alert('Nenhuma movimentação foi registrada. Corrija estes itens e tente novamente:\n'+errors.join('\n'));return;}
  if(mode==='saida'){const totals=new Map();for(const x of prepared)totals.set(x.p.id,(totals.get(x.p.id)||0)+x.v.qty);for(const [id,total] of totals){const p=state.products.find(z=>z.id===id);if(!p||total>availableQty(p)+1e-9){errors.push(`${p?.name||'Produto'}: a soma das saídas excede o saldo disponível após reservas (${fmt(p?availableQty(p):0)} ${p?.unit||''}).`);}}if(errors.length){alert('Nenhuma movimentação foi registrada. Corrija estes itens e tente novamente:\n'+errors.join('\n'));return;}}
  const now=new Date().toISOString();
  for(const x of prepared){const v=x.v;let p=x.p;
   if(x.create){p={id:uid(),name:v.name,category:'Aviamento',color:'',unit:v.unit,qty:0,packSize:0,notes:'Criado por foto/voz'};state.products.push(p);}
   if(mode==='entrada')p.qty=Number((Number(p.qty)+v.qty).toFixed(3));else p.qty=Number((Number(p.qty)-v.qty).toFixed(3));
   state.moves.push({id:uid(),date:now,type:mode==='entrada'?'entrada':'saida',productId:p.id,productName:productLabel(p),qty:v.qty,unit:p.unit,workshop:'',cut:'',referenceName:'',notes:mode==='entrada'?'Cadastro por '+(target==='photoDraft'?'foto':'voz'):'Saída por comando de voz'});
  }
  persist();renderAll();toast(mode==='entrada'?'Itens adicionados ao estoque.':'Saída registrada.');$(target).innerHTML='';
 });
}
$('parseOcr').addEventListener('click',()=>renderDraft('photoDraft',parseLines($('ocrText').value),'entrada'));
function startVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){toast('Este navegador não oferece reconhecimento de voz. Você pode digitar o comando.');goto('foto');return;}
 if(voiceRecognition){try{voiceRecognition.stop();}catch(e){}}
 voiceRecognition=new SR();voiceRecognition.lang='pt-BR';voiceRecognition.continuous=false;voiceRecognition.interimResults=true;
 voiceRecognition.onresult=e=>{let txt='';for(let i=0;i<e.results.length;i++)txt+=e.results[i][0].transcript+' ';$('voiceText').value=txt.trim();};
 voiceRecognition.onerror=e=>toast('Não foi possível reconhecer a voz ('+e.error+'). Confira a permissão do microfone.');
 voiceRecognition.onend=()=>toast('Reconhecimento de voz encerrado. Revise o texto.');
 try{voiceRecognition.start();toast('Pode falar agora.');}catch(e){toast('Não foi possível iniciar o microfone.');}
}
$('startVoice').addEventListener('click',startVoice);
$('stopVoice').addEventListener('click',()=>{if(voiceRecognition)voiceRecognition.stop();});
$('interpretVoice').addEventListener('click',()=>{
 const txt=$('voiceText').value.trim();if(!txt)return toast('Fale ou digite um comando primeiro.');
 const action=/\b(saida|saída|retirar|retirada|baixar|envia|enviar|mandar)\b/i.test(txt)?'saida':'entrada';
 const items=parseLines(txt.replace(/^(cadastrar|adicionar|registrar|dar entrada|dar saída|dar saida)\s+/i,''));
 if(items.length){renderDraft('voiceDraft',items,action==='entrada'?'entrada':'saida');return;}
 // Fallback for natural phrasing: "cadastrar 500 unidades de zíper preto"
 const m=txt.match(/(\d+(?:[.,]\d+)?)\s*(unidades?|unid\.?|pacotes?|caixas?|rolos?|metros?|m|gramas?|g|kg)?\s*(?:de\s+)?(.+)/i);
 if(m){renderDraft('voiceDraft',[{name:m[3].trim(),qty:Number(m[1].replace(',','.')),unit:normalizeUnit(m[2]||'unidade')}],action==='entrada'?'entrada':'saida');return;}
 toast('Não consegui interpretar o comando. Tente “500 unidades de zíper preto”.');
});
$('exportBtn').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),project:'Estoque de Aviamentos',version:'1.4.1',...state},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='backup-estoque-aviamentos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast('Backup exportado. Guarde o arquivo em local seguro.');
});
$('importBtn').addEventListener('click',()=>{ $('backupFile').value=''; $('backupFile').click(); });
function validateImportedBackup(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return {ok:false,message:'O arquivo precisa conter um objeto JSON.'};
 for(const key of ['products','moves','cuts'])if(!Array.isArray(data[key]))return {ok:false,message:`O backup não contém uma lista válida de ${key}.`};
 if(data.audits!==undefined&&!Array.isArray(data.audits))return {ok:false,message:'A lista de conferências do backup está inválida.'};
 for(const key of ['reservations','packages','workshopStock'])if(data[key]!==undefined&&!Array.isArray(data[key]))return {ok:false,message:`O backup contém uma lista inválida de ${key}.`};
 const objectLists=['products','moves','cuts','audits','reservations','packages','workshopStock'];
 for(const key of objectLists){if(!Array.isArray(data[key]))continue;for(let i=0;i<data[key].length;i++){const item=data[key][i];if(!item||typeof item!=='object'||Array.isArray(item))return {ok:false,message:`Registro ${i+1} da lista ${key} está inválido.`};}}
 const codes=new Set();
 for(let i=0;i<data.products.length;i++){
  const p=data.products[i];
  if(typeof p.name!=='string'||!p.name.trim())return {ok:false,message:`Produto ${i+1} está sem nome.`};
  if(p.qty!==undefined&&(!Number.isFinite(Number(p.qty))||Number(p.qty)<0))return {ok:false,message:`Saldo inválido no produto “${p.name}”.`};
  if(p.packSize!==undefined&&p.packSize!==null&&p.packSize!==''&&(!Number.isFinite(Number(p.packSize))||Number(p.packSize)<0))return {ok:false,message:`Conteúdo de embalagem inválido no produto “${p.name}”.`};
  const code=String(p.code||'').trim();if(code){if(codes.has(code))return {ok:false,message:`O código “${code}” aparece em mais de um produto no backup.`};codes.add(code);}
 }
 for(let i=0;i<data.moves.length;i++){const m=data.moves[i];if(m.qty!==undefined&&(!Number.isFinite(Number(m.qty))||Number(m.qty)<0))return {ok:false,message:`Quantidade inválida na movimentação ${i+1}.`};}
 const productIds=new Set(data.products.map(p=>String(p.id||'')));const recordIds=new Set();for(let i=0;i<data.products.length;i++){const id=String(data.products[i].id||'');if(id&&recordIds.has(id))return {ok:false,message:`Identificador de produto duplicado: ${id}.`};if(id)recordIds.add(id);}
 for(let i=0;i<(data.reservations||[]).length;i++){const r=data.reservations[i];if(typeof r.oc!=='string'||!r.oc.trim()||!r.productId||!productIds.has(String(r.productId))||!Number.isFinite(Number(r.qty))||Number(r.qty)<0||!['ativa','liberada','consumida'].includes(r.status))return {ok:false,message:`Reserva ${i+1} inválida ou vinculada a produto inexistente.`};if(r.status==='ativa'&&Number(r.qty)<=0)return {ok:false,message:`Reserva ativa ${i+1} precisa ter quantidade maior que zero.`};}
 const packageCodes=new Set();for(let i=0;i<(data.packages||[]).length;i++){const p=data.packages[i];const code=String(p.code||'').trim();if(!code||!p.productId||!productIds.has(String(p.productId))||!Number.isFinite(Number(p.initial))||Number(p.initial)<0||!Number.isFinite(Number(p.remaining))||Number(p.remaining)<0||Number(p.remaining)>Number(p.initial)||typeof p.unit!=='string'||!p.unit.trim())return {ok:false,message:`Embalagem rastreada ${i+1} inválida ou vinculada a produto inexistente.`};if(packageCodes.has(code.toLowerCase()))return {ok:false,message:`Código de embalagem duplicado: ${code}.`};packageCodes.add(code.toLowerCase());}
 for(let i=0;i<(data.workshopStock||[]).length;i++){const w=data.workshopStock[i];if(!w||typeof w.workshop!=='string'||!w.workshop.trim()||!productIds.has(String(w.productId||''))||!Number.isFinite(Number(w.qty))||Number(w.qty)<0||typeof w.unit!=='string'||!w.unit.trim()||!Array.isArray(w.history||[]))return {ok:false,message:`Saldo de oficina ${i+1} inválido ou vinculado a produto inexistente.`};}
 return {ok:true};
}
$('backupFile').addEventListener('change',async e=>{
 const file=e.target.files&&e.target.files[0]; if(!file)return;
 try{
  if(file.size>10*1024*1024) throw new Error('O arquivo excede o limite de 10 MB.');
  const data=JSON.parse(await file.text());
  const validation=validateImportedBackup(data);
  if(!validation.ok) throw new Error(validation.message);
  const ok=confirm(`ATENÇÃO: restaurar este backup substituirá os dados atuais deste navegador por ${data.products.length} produto(s), ${data.moves.length} movimentação(ões) e ${data.cuts.length} corte(s). Exporte um backup atual antes de continuar. Deseja prosseguir?`);
  if(!ok)return;
  const previous=localStorage.getItem(STORAGE_KEY);
  try{state={products:data.products,moves:data.moves,cuts:data.cuts,audits:Array.isArray(data.audits)?data.audits:[],reservations:Array.isArray(data.reservations)?data.reservations:[],packages:Array.isArray(data.packages)?data.packages:[],workshopStock:Array.isArray(data.workshopStock)?data.workshopStock:[]};persist();renderProductSelects();renderAll();toast('Backup restaurado com sucesso. Confira os saldos e registros.');}
  catch(err){if(previous===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,previous);state=loadState();renderProductSelects();renderAll();throw err;}
 }catch(err){alert('Não foi possível restaurar o backup: '+(err.message||'arquivo inválido'));}
});

// OCR de ficha de corte: apenas sugere campos reconhecidos; nunca salva automaticamente.
function parseCutSheetText(text){
 const raw=String(text||'');const normalized=raw.replace(/\r/g,'\n');
 const pick=(patterns)=>{for(const re of patterns){const m=normalized.match(re);if(m)return m[1].trim();}return '';};
 const oc=pick([/(?:\bOC\b|ordem\s+de\s+corte)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/.]*)/i]);
 const cut=pick([/(?:n[úu]mero\s+do\s+corte|corte)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/.]*)/i]);
 const pairsRaw=pick([/(\d[\d.,]*)\s*pares\b/i,/\bpares\s*[:=\-]?\s*(\d[\d.,]*)/i]);
 const totalRaw=pick([/(\d[\d.,]*)\s*pe[çc]as\b/i,/\btotal\s*[:=\-]?\s*(\d[\d.,]*)/i]);
 const numbers=raw.match(/(?:^|\s)(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})(?:\s|$)/m);
 const parseNum=x=>{if(!x)return null;const cleaned=x.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Number(cleaned);return Number.isFinite(n)&&n>=0?n:null;};
 const grade=numbers?numbers.slice(1).map(Number):null;
 let pairs=parseNum(pairsRaw),total=parseNum(totalRaw);let note='';
 if(pairs===null&&total!==null&&grade){const perPair=grade.reduce((a,b)=>a+b,0);if(perPair>0&&Number.isInteger(total/perPair)){pairs=total/perPair;note='Pares estimados pelo total de peças ÷ soma da grade; confirme antes de aplicar.';}}
 return {oc,cut,pairs,total,grade,note,found:Boolean(oc||cut||pairs!==null||total!==null||grade)};
}
$('parseCutSheet')?.addEventListener('click',()=>{
 const parsed=parseCutSheetText($('ocrText').value);const el=$('cutSheetDraft');el.classList.remove('hidden');
 if(!parsed.found){el.textContent='Não encontrei OC, corte, pares, total ou grade com confiança suficiente. Corrija o texto reconhecido manualmente e tente novamente.';return;}
 const gradeText=parsed.grade?parsed.grade.map((v,i)=>`${[38,40,42,44,46,48][i]}: ${v}`).join(' · '):'Grade não reconhecida';
 el.innerHTML=`<strong>Dados sugeridos — revise antes de aplicar</strong><br>OC: ${esc(parsed.oc||'não identificada')}<br>Número do corte: ${esc(parsed.cut||'não identificado')}<br>Pares: ${parsed.pairs===null?'não identificados':fmt(parsed.pairs)}<br>Total de peças: ${parsed.total===null?'não identificado':fmt(parsed.total)}<br>Grade por par: ${esc(gradeText)}<br><small>${esc(parsed.note||'A leitura pode conter erros de OCR. Nada será salvo automaticamente.')}</small><div class="actions"><button class="primary" id="applyCutSheet">Aplicar campos reconhecidos</button></div>`;
 $('applyCutSheet').addEventListener('click',()=>{if(parsed.oc)$('cutOC').value=parsed.oc;if(parsed.cut)$('cutNumber').value=parsed.cut;if(parsed.pairs!==null)$('cutPairs').value=parsed.pairs;if(parsed.grade)parsed.grade.forEach((v,i)=>{const input=$('size'+[38,40,42,44,46,48][i]);if(input)input.value=v;});if(parsed.total!==null&&parsed.pairs===null&&!parsed.grade)$('cutNotes').value=($('cutNotes').value+' Total OCR detectado: '+parsed.total+' peças.').trim();goto('corte');toast('Campos preenchidos como sugestão. Revise e calcule manualmente.');});
});

// Módulos adicionais: inventário, relatórios, scanner e conexão de API.
let pendingInventory=null, scannerStream=null, scannerFrame=null;
function refreshInvProducts(){const el=$('invProduct');if(el)el.innerHTML='<option value="">Selecione produto</option>'+state.products.map(p=>`<option value="${esc(p.id)}">${esc(productLabel(p))} — saldo ${fmt(p.qty)}</option>`).join('');}
function renderAuditHistory(){const rows=(state.audits||[]).slice().reverse().map(a=>[dateFmt(a.date),esc(a.productName),fmt(a.before)+' → '+fmt(a.counted)+' '+esc(a.unit),`<span class="audit-diff">${a.diff>0?'+':''}${fmt(a.diff)}</span>`,esc(a.actor||'Local user')]);$('invHistory').innerHTML=table(['Data','Produto','Sistema → contado','Diferença','Responsável'],rows,'Nenhum ajuste físico registrado.');}
$('invCompare')?.addEventListener('click',()=>{const p=state.products.find(x=>x.id===$('invProduct').value), raw=$('invCount').value;if(!p||raw==='')return toast('Selecione o produto e informe a quantidade contada.');const counted=Number(raw);if(!Number.isFinite(counted)||counted<0)return toast('A contagem deve ser zero ou maior.');pendingInventory={id:p.id,name:productLabel(p),unit:p.unit,before:Number(p.qty)||0,counted,diff:counted-(Number(p.qty)||0)};$('invResult').innerHTML=`<strong>${esc(p.name)}</strong><br>Saldo no sistema: ${fmt(pendingInventory.before)} ${esc(p.unit)}<br>Contagem física: ${fmt(counted)} ${esc(p.unit)}<br>Diferença: <span class="audit-diff">${pendingInventory.diff>0?'+':''}${fmt(pendingInventory.diff)} ${esc(p.unit)}</span><br><small>O saldo ainda não foi alterado.</small>`;$('invConfirm').disabled=pendingInventory.diff===0;});
$('invConfirm')?.addEventListener('click',()=>{if(!pendingInventory)return;const p=state.products.find(x=>x.id===pendingInventory.id);if(!p)return toast('Produto não encontrado.');if(!confirm(`Confirmar ajuste de ${p.name}? Saldo atual: ${fmt(p.qty)} ${p.unit}; novo saldo: ${fmt(pendingInventory.counted)} ${p.unit}.`))return;const before=Number(p.qty)||0;p.qty=pendingInventory.counted;state.audits=state.audits||[];state.audits.push({id:uid(),date:new Date().toISOString(),productId:p.id,productName:productLabel(p),unit:p.unit,before,counted:p.qty,diff:p.qty-before,actor:'Local user'});state.moves.push({id:uid(),date:new Date().toISOString(),type:'ajuste',productId:p.id,productName:productLabel(p),qty:Math.abs(p.qty-before),unit:p.unit,workshop:'',cut:'',referenceName:'Inventário físico',notes:'Ajuste confirmado após contagem física',balanceBefore:before,balanceAfter:p.qty,actor:'Local user'});persist();renderAll();renderAuditHistory();pendingInventory=null;$('invConfirm').disabled=true;$('invResult').textContent='Ajuste registrado no histórico.';toast('Inventário ajustado e registrado.');});
function renderReports(){const days=$('reportPeriod')?.value||'30',since=days==='all'?0:Date.now()-Number(days)*86400000;const moves=state.moves.filter(m=>{const t=new Date(m.date).getTime();return Number.isFinite(t)&&t>=since;});const outs=moves.filter(m=>m.type==='saida');const groupedIn=new Map(),groupedOut=new Map();moves.filter(m=>m.type==='entrada').forEach(m=>{const k=String(m.unit||'unidade');groupedIn.set(k,(groupedIn.get(k)||0)+Number(m.qty||0));});outs.forEach(m=>{const k=(m.productName||'Produto')+' · '+(m.unit||'');groupedOut.set(k,(groupedOut.get(k)||0)+Number(m.qty||0));});const inSummary=[...groupedIn].map(([u,q])=>fmt(q)+' '+u).join(' · ')||'0';const outSummary=[...new Set(outs.map(m=>String(m.unit||'unidade')))].map(u=>fmt(outs.filter(m=>String(m.unit||'unidade')===u).reduce((n,m)=>n+Number(m.qty||0),0))+' '+u).join(' · ')||'0';$('reportSummary').innerHTML=[['Entradas por unidade',inSummary],['Saídas por unidade',outSummary],['Movimentações',moves.length],['Pendências estimadas',state.cuts.reduce((n,c)=>n+(c.lastDispatch?.lines||[]).filter(l=>Number(l.missing)>0).length,0)]].map(([a,b])=>`<div class="card span3"><div class="statlabel">${esc(a)}</div><div class="statvalue" style="font-size:18px">${esc(b)}</div></div>`).join('');$('consumptionTable').innerHTML=table(['Produto','Quantidade de saída no período'],[...groupedOut].sort((a,b)=>b[1]-a[1]).map(([k,v])=>[esc(k),fmt(v)]),'Nenhuma saída no período selecionado.');$('reportStockTable').innerHTML=table(['Produto','Categoria','Saldo','Unidade','Reservado','Disponível','Mínimo'],state.products.map(p=>[esc(productLabel(p)),esc(p.category||'Aviamento'),fmt(p.qty),esc(p.unit),fmt(activeReservations(p.id)),fmt(availableQty(p)),p.minQty==null?'—':fmt(p.minQty)]),'Nenhum produto cadastrado.');}
$('reportPeriod')?.addEventListener('change',renderReports);$('reportCsv')?.addEventListener('click',()=>{const days=$('reportPeriod').value,since=days==='all'?0:Date.now()-Number(days)*86400000;const rows=[['Data','Tipo','Produto','Quantidade','Unidade','Oficina','Corte','Observação'],...state.moves.filter(m=>new Date(m.date).getTime()>=since).map(m=>[m.date,m.type,m.productName,m.qty,m.unit,m.workshop||'',m.cut||'',m.notes||''])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='relatorio-consumo.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('homeChartPeriod')?.addEventListener('change',renderMovementActivityChart);
['moveSearch','moveFilterType','moveFilterPeriod'].forEach(id=>$(id)?.addEventListener(id==='moveSearch'?'input':'change',renderMoves));
$('workshopSearch')?.addEventListener('input',renderWorkshops);
$('workshopLedgerForm')?.addEventListener('submit',e=>{
 e.preventDefault();ensureCollections();const workshop=$('wsLedgerWorkshop').value.trim(),productId=$('wsLedgerProduct').value,action=$('wsLedgerAction').value,qty=Number($('wsLedgerQty').value),cut=$('wsLedgerCut').value.trim(),notes=$('wsLedgerNotes').value.trim();const p=state.products.find(x=>x.id===productId);if(!workshop||!p)return toast('Informe oficina e produto.');if(!Number.isFinite(qty)||qty<0)return toast('Informe quantidade válida.');const before=workshopBalance(workshop,productId);let after=before;
 if(action==='saldo'){after=qty;setWorkshopBalance(workshop,productId,after,{action:'saldo inicial/conferência',qty,cut,notes,before,delta:qty-before});}
 else if(action==='consumo'){if(qty>before+1e-9)return toast(`Saldo insuficiente na oficina. Há ${fmt(before)} ${p.unit}. Registre primeiro o saldo conhecido ou o envio.`);after=before-qty;setWorkshopBalance(workshop,productId,after,{action:'consumo na oficina',qty,cut,notes,before,delta:-qty});}
 else {if(qty>before+1e-9)return toast(`Devolução maior que o saldo registrado na oficina (${fmt(before)} ${p.unit}).`);after=before-qty;setWorkshopBalance(workshop,productId,after,{action:'devolução ao estoque',qty,cut,notes,before,delta:-qty});const central=Number(p.qty)||0;p.qty=Number((central+qty).toFixed(3));state.moves.push({id:uid(),date:new Date().toISOString(),type:'entrada',productId:p.id,productName:productLabel(p),qty,unit:p.unit,workshop,cut,oc:'',referenceName:'',notes:`Devolução da oficina. ${notes}`.trim(),balanceBefore:central,balanceAfter:p.qty,actor:'Local user'});}
 persist();renderAll();$('wsLedgerQty').value='';$('wsLedgerNotes').value='';toast(action==='saldo'?'Saldo da oficina registrado.':action==='consumo'?'Consumo da oficina registrado.':'Devolução registrada e estoque central atualizado.');
});
$('exportWorkshopCsv')?.addEventListener('click',()=>{const rows=[['Oficina','Produto','Saldo','Unidade','Atualizado'],...state.workshopStock.map(x=>[x.workshop,x.productName,x.qty,x.unit,x.updatedAt||''])];downloadCsv('saldos-oficina.csv',rows);});
$('reportStockCsv')?.addEventListener('click',()=>downloadCsv('estoque-atual.csv',[['Produto','Categoria','Cor','Saldo','Unidade','Reservado','Disponível','Mínimo'],...state.products.map(p=>[productLabel(p),p.category||'',p.color||'',p.qty,p.unit,activeReservations(p.id),availableQty(p),p.minQty??''])]));
function downloadCsv(filename,rows){const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

$('scanFind')?.addEventListener('click',()=>{const code=$('scanCode').value.trim();if(!code)return toast('Digite ou leia um código.');const p=state.products.find(p=>String(p.code||'').trim()===code||String(p.id)===code);$('scanResult').innerHTML=p?`<strong>${esc(productLabel(p))}</strong><br>Saldo: ${fmt(p.qty)} ${esc(p.unit)}<div class="actions"><button class="primary" id="scanGoStock">Abrir estoque</button><button class="secondary" id="scanGoMove">Registrar movimentação</button></div>`:'Nenhum produto encontrado com esse código. Cadastre o código no produto e tente novamente.';$('scanGoStock')?.addEventListener('click',()=>goto('estoque'));$('scanGoMove')?.addEventListener('click',()=>{goto('movimentar');$('moveProduct').value=p.id;});});
$('scanStart')?.addEventListener('click',async()=>{if(!('BarcodeDetector'in window))return toast('Este navegador não oferece leitura nativa de códigos. Use a busca manual ou um leitor USB/Bluetooth.');try{scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('scanVideo');v.srcObject=scannerStream;v.classList.add('video-active');await v.play();const detector=new BarcodeDetector({formats:['qr_code','code_128','ean_13','ean_8','upc_a','upc_e']});const loop=async()=>{if(!scannerStream)return;try{const codes=await detector.detect(v);if(codes.length){$('scanCode').value=codes[0].rawValue;$('scanFind').click();stopScanner();return;}}catch(e){}scannerFrame=requestAnimationFrame(loop);};loop();}catch(e){toast('Não foi possível abrir a câmera. Confira a permissão e use HTTPS.');}});
function stopScanner(){if(scannerFrame)cancelAnimationFrame(scannerFrame);scannerFrame=null;if(scannerStream)scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;const v=$('scanVideo');if(v){v.pause();v.srcObject=null;v.classList.remove('video-active');}}
$('scanStop')?.addEventListener('click',stopScanner);window.addEventListener('pagehide',stopScanner);
$('apiCheck')?.addEventListener('click',async()=>{let base=$('apiBase').value.trim().replace(/\/$/,'');if(!base)return toast('Informe a URL da API.');$('apiStatus').value='Testando…';try{const r=await fetch(base+'/api/health',{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);$('apiStatus').value='Conectado';toast('Servidor respondeu. Isso não confirma login nem sincronização.');}catch(e){$('apiStatus').value='Falha de conexão';toast('Não foi possível validar a API. Confira URL, CORS e servidor.');}});
$('apiExport')?.addEventListener('click',()=> $('exportBtn').click());


// === FASE 1: reservas, rastreio físico, previsão e assistente local ===
function ensureCollections(){state.reservations=Array.isArray(state.reservations)?state.reservations:[];state.packages=Array.isArray(state.packages)?state.packages:[];state.workshopStock=Array.isArray(state.workshopStock)?state.workshopStock:[];}
function activeReservations(productId){ensureCollections();return state.reservations.filter(r=>r.productId===productId&&r.status==='ativa').reduce((n,r)=>n+Number(r.qty||0),0);}
function availableQty(p){return Math.max(0,(Number(p.qty)||0)-activeReservations(p.id));}
function availableForOC(p,oc){const normalized=String(oc||'').trim().toLowerCase();const reservedForOthers=(state.reservations||[]).filter(r=>r.productId===p.id&&r.status==='ativa'&&String(r.oc||'').trim().toLowerCase()!==normalized).reduce((n,r)=>n+Number(r.qty||0),0);return Math.max(0,(Number(p.qty)||0)-reservedForOthers);}
function fulfillReservationsForOC(productId,oc,qty){const normalized=String(oc||'').trim().toLowerCase();if(!normalized||qty<=0)return;for(const r of (state.reservations||[]).filter(r=>r.productId===productId&&r.status==='ativa'&&String(r.oc||'').trim().toLowerCase()===normalized)){if(qty<=1e-9)break;const used=Math.min(Number(r.qty)||0,qty);r.originalQty=r.originalQty??(Number(r.qty)||0);r.fulfilledQty=(Number(r.fulfilledQty)||0)+used;r.qty=Number(((Number(r.qty)||0)-used).toFixed(3));qty=Number((qty-used).toFixed(3));if(r.qty<=1e-9){r.qty=0;r.status='consumida';r.fulfilledAt=new Date().toISOString();}}}
function populateNewFeatureSelects(){
 const opts='<option value="">Selecione produto</option>'+state.products.map(p=>`<option value="${esc(p.id)}">${esc(productLabel(p))} — saldo ${fmt(p.qty)}</option>`).join('');
 ['resProduct','pkgProduct'].forEach(id=>{const el=$(id);if(el){const old=el.value;el.innerHTML=opts;if(state.products.some(p=>p.id===old))el.value=old;}});
 const pkg=$('pkgUpdateId');if(pkg){const old=pkg.value;pkg.innerHTML='<option value="">Selecione embalagem</option>'+state.packages.map(p=>`<option value="${esc(p.id)}">${esc(p.code)} — ${esc(p.productName)} (${fmt(p.remaining)} ${esc(p.unit)})</option>`).join('');if(state.packages.some(p=>p.id===old))pkg.value=old;}
}
function renderReservations(){
 ensureCollections();populateNewFeatureSelects();
 const rows=state.reservations.slice().reverse().map(r=>[esc(r.oc),esc(r.productName),`${fmt(r.qty)} ${esc(r.unit)}${Number(r.fulfilledQty)>0?` (consumido: ${fmt(r.fulfilledQty)})`:''}`,r.status==='ativa'?'<span class="pill">Ativa</span>':(r.status==='consumida'?'Consumida':'Liberada'),dateFmt(r.date),r.status==='ativa'?`<button class="secondary small" data-release-res="${esc(r.id)}">Liberar</button>`:'—']);
 $('reservationTable').innerHTML=table(['OC','Produto','Reservado','Status','Data','Ação'],rows,'Nenhuma reserva registrada.');
 $('reservationAvailability').innerHTML=table(['Produto','Saldo físico','Reservado','Disponível'],state.products.map(p=>[esc(productLabel(p)),`${fmt(p.qty)} ${esc(p.unit)}`,`${fmt(activeReservations(p.id))} ${esc(p.unit)}`,`${fmt(availableQty(p))} ${esc(p.unit)}`]),'Cadastre produtos para consultar disponibilidade.');
 $('reservationTable').querySelectorAll('[data-release-res]').forEach(b=>b.addEventListener('click',()=>{const r=state.reservations.find(x=>x.id===b.dataset.releaseRes);if(!r||r.status!=='ativa')return;if(!confirm(`Liberar a reserva ${r.oc} de ${r.productName}?`))return;r.status='liberada';r.releasedAt=new Date().toISOString();persist();renderAll();toast('Reserva liberada; saldo físico não foi alterado.');}));
}
$('reservationForm')?.addEventListener('submit',e=>{
 e.preventDefault();ensureCollections();
 const oc=$('resOC').value.trim(),p=state.products.find(x=>x.id===$('resProduct').value),qty=Number($('resQty').value);
 if(!oc||!p||!Number.isFinite(qty)||qty<=0)return toast('Informe OC, produto e quantidade válidos.');
 if(state.reservations.some(r=>r.oc.toLowerCase()===oc.toLowerCase()&&r.productId===p.id&&r.status==='ativa'))return toast('Já existe uma reserva ativa desse produto para essa OC. Edite/libere a reserva existente antes de criar outra.');
 if(qty>availableQty(p)+1e-9)return toast(`Quantidade insuficiente. Disponível: ${fmt(availableQty(p))} ${p.unit}.`);
 state.reservations.push({id:uid(),oc,productId:p.id,productName:productLabel(p),qty,unit:p.unit,notes:$('resNotes').value.trim(),status:'ativa',date:new Date().toISOString()});
 persist();$('reservationForm').reset();renderAll();toast('Reserva criada. O saldo físico não foi baixado.');
});
function renderPackages(){
 ensureCollections();populateNewFeatureSelects();
 const rows=state.packages.slice().reverse().map(p=>[esc(p.code),esc(p.productName),esc(p.type),`${fmt(p.initial)} ${esc(p.unit)}`,`${fmt(p.remaining)} ${esc(p.unit)}`,esc(p.location||'—'),esc(p.status||'Aberta'),dateFmt(p.updatedAt||p.createdAt)]);
 $('packageTable').innerHTML=table(['Código','Produto','Tipo','Inicial','Restante','Local','Estado','Atualizado'],rows,'Nenhuma embalagem física cadastrada.');
}
$('packageForm')?.addEventListener('submit',e=>{
 e.preventDefault();ensureCollections();
 const code=$('pkgCode').value.trim(),p=state.products.find(x=>x.id===$('pkgProduct').value),qty=Number($('pkgQty').value),unit=$('pkgUnit').value;
 if(!code||!p||!Number.isFinite(qty)||qty<0)return toast('Confira código, produto e quantidade.');
 if(state.packages.some(x=>x.code.toLowerCase()===code.toLowerCase()))return toast('Esse código de embalagem já existe.');
 if(unit!==p.unit && !confirm(`A embalagem será controlada em ${unit}, enquanto o produto usa ${p.unit}. Não haverá conversão automática. Continuar?`))return;
 const now=new Date().toISOString();state.packages.push({id:uid(),code,productId:p.id,productName:productLabel(p),type:$('pkgType').value,initial:qty,remaining:qty,unit,location:$('pkgLocation').value.trim(),status:qty===0?'Vazia':'Aberta',createdAt:now,updatedAt:now,history:[{date:now,qty,reason:'Cadastro inicial'}]});
 persist();$('packageForm').reset();renderAll();toast('Embalagem rastreável cadastrada sem alterar o saldo geral.');
});
$('packageUpdateForm')?.addEventListener('submit',e=>{
 e.preventDefault();ensureCollections();const p=state.packages.find(x=>x.id===$('pkgUpdateId').value),qty=Number($('pkgRemaining').value),reason=$('pkgUpdateReason').value.trim();
 if(!p||!Number.isFinite(qty)||qty<0||!reason)return toast('Confira embalagem, quantidade e motivo.');
 const before=p.remaining,now=new Date().toISOString();p.remaining=qty;p.status=qty===0?'Vazia':'Aberta';p.updatedAt=now;p.history=Array.isArray(p.history)?p.history:[];p.history.push({date:now,before,qty,reason});persist();$('packageUpdateForm').reset();renderAll();toast('Embalagem atualizada e histórico preservado. O saldo geral não foi alterado.');
});
function calculateForecastMetrics({used,windowDays,available,leadDays,safetyDays}){
 const safeWindow=Math.max(1,Number(windowDays)||30),safeUsed=Math.max(0,Number(used)||0),safeAvailable=Math.max(0,Number(available)||0);
 const daily=safeUsed/safeWindow,daysLeft=daily>0?safeAvailable/daily:null;
 const lead=Math.max(0,Math.min(365,Number(leadDays)||0)),safety=Math.max(0,Math.min(365,Number(safetyDays)||0));
 const targetDemand=daily*(lead+safety),suggested=Math.max(0,targetDemand-safeAvailable);
 let status='Saldo projetado suficiente';
 if(daily===0)status='Sem saída registrada no período';
 else if(daysLeft<=lead)status='Reposição urgente';
 else if(daysLeft<=lead+safety)status='Planejar reposição';
 return {daily,daysLeft,suggested,status,targetDemand};
}
function renderForecast(){
 const el=$('forecastTable');if(!el)return;
 const days=Math.max(1,Number($('forecastWindow')?.value)||30),since=Date.now()-days*86400000;
 const leadDays=Math.max(0,Math.min(365,Number($('forecastLeadDays')?.value)||0));
 const safetyDays=Math.max(0,Math.min(365,Number($('forecastSafetyDays')?.value)||0));
 const rows=state.products.map(p=>{
  const outs=state.moves.filter(m=>{const t=new Date(m.date).getTime();return m.type==='saida'&&m.productId===p.id&&Number.isFinite(t)&&t<=Date.now()&&t>=since&&String(m.unit||p.unit)===String(p.unit)});
  const used=outs.reduce((n,m)=>n+Math.max(0,Number(m.qty)||0),0),available=availableQty(p);
  const metrics=calculateForecastMetrics({used,windowDays:days,available,leadDays,safetyDays});
  return {sort:metrics.daysLeft===null?Infinity:metrics.daysLeft,row:[esc(productLabel(p)),`${fmt(p.qty)} ${esc(p.unit)}`,`${fmt(activeReservations(p.id))} ${esc(p.unit)}`,`${fmt(available)} ${esc(p.unit)}`,`${fmt(used)} ${esc(p.unit)} / ${days} dias`,`${fmt(metrics.daily)} ${esc(p.unit)}/dia`,metrics.daysLeft===null?'—':`${fmt(metrics.daysLeft)} dias`,metrics.suggested>0?`${fmt(metrics.suggested)} ${esc(p.unit)}`:'0',esc(metrics.status)]};
 }).sort((a,b)=>a.sort-b.sort).map(x=>x.row);
 el.innerHTML=table(['Produto','Físico','Reservado','Livre','Saídas no período','Média diária','Dias estimados','Sugestão de reposição','Sinal'],rows,'Cadastre produtos para calcular previsão.');
}
$('forecastWindow')?.addEventListener('change',renderForecast);$('forecastLeadDays')?.addEventListener('input',renderForecast);$('forecastSafetyDays')?.addEventListener('input',renderForecast);$('refreshForecast')?.addEventListener('click',()=>{renderForecast();toast('Previsão atualizada com o histórico disponível.');});
function answerStockQuestion(question){
 const q=norm(question);
 if(!q)return 'Digite uma pergunta.';
 if(q.includes('reserva')){const rs=(state.reservations||[]).filter(r=>r.status==='ativa');return rs.length?`Reservas ativas (${rs.length}): `+rs.map(r=>`${r.oc}: ${r.productName}, ${fmt(r.qty)} ${r.unit}`).join('; '):'Não há reservas ativas.';}
 if(q.includes('movimenta')||q.includes('saidas')||q.includes('saídas')||q.includes('ultimas')||q.includes('últimas')){const ms=state.moves.slice(-8).reverse();return ms.length?`Últimas ${ms.length} movimentações: `+ms.map(m=>`${m.type} — ${m.productName}: ${fmt(m.qty)} ${m.unit} (${dateFmt(m.date)})`).join('; '):'Não há movimentações registradas.';}
 if(q.includes('baixo')||q.includes('mínimo')||q.includes('minimo')||q.includes('zerado')||q.includes('acab')){const ps=state.products.filter(p=>Number(p.qty)<=0||(p.minQty!==undefined&&p.minQty!==null&&p.minQty!==''&&Number(p.qty)<=Number(p.minQty)));return ps.length?'Produtos em alerta: '+ps.map(p=>`${productLabel(p)}: ${fmt(p.qty)} ${p.unit}`).join('; '):'Não há produtos abaixo do mínimo cadastrado ou com saldo zerado.';}
 const matches=state.products.filter(p=>q.includes(norm(p.name))||(p.color&&q.includes(norm(p.color))&&q.includes(norm(p.name))));
 if(matches.length)return matches.map(p=>`${productLabel(p)}: saldo físico ${fmt(p.qty)} ${p.unit}; reserva ativa ${fmt(activeReservations(p.id))} ${p.unit}; disponível ${fmt(availableQty(p))} ${p.unit}.`).join('\n');
 if(q.includes('total')||q.includes('quantos produtos'))return `Há ${state.products.length} produtos cadastrados. Como existem unidades diferentes, os saldos não são somados em um único total.`;
 return 'Ainda não reconheço essa pergunta. Tente consultar um produto pelo nome, reservas ativas, últimas movimentações ou itens abaixo do mínimo. Esta é uma consulta local por regras, não uma IA generativa.';
}
$('askAssistant')?.addEventListener('click',()=>{$('assistantAnswer').textContent=answerStockQuestion($('assistantQuestion').value);});
$('assistantClear')?.addEventListener('click',()=>{$('assistantQuestion').value='';$('assistantAnswer').textContent='Digite uma pergunta para consultar os dados locais.';});
document.querySelectorAll('.assistant-sample').forEach(b=>b.addEventListener('click',()=>{$('assistantQuestion').value=b.dataset.q;$('askAssistant').click();}));

async function init(){
 buildSizeGrid();renderProductSelects();renderAll();refreshInvProducts();renderAuditHistory();renderReports();renderReservations();renderPackages();renderForecast();
 const status=$('apiStatus');
 try{
  if(status)status.value='Conectando ao PostgreSQL…';
  const response=await fetch('/api/state',{headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const remote=await response.json();
  remoteRevision=Number(remote.revision)||0;
  if(remote && remote.empty===false && remote.state && typeof remote.state==='object'){
   const saved=remote.state;
   const localBefore=loadState();
   const localSnapshot=JSON.stringify(localBefore);
   const remoteSnapshot=JSON.stringify({products:Array.isArray(saved.products)?saved.products:[],moves:Array.isArray(saved.moves)?saved.moves:[],cuts:Array.isArray(saved.cuts)?saved.cuts:[],audits:Array.isArray(saved.audits)?saved.audits:[],reservations:Array.isArray(saved.reservations)?saved.reservations:[],packages:Array.isArray(saved.packages)?saved.packages:[],workshopStock:Array.isArray(saved.workshopStock)?saved.workshopStock:[]});
   if((localBefore.products.length||localBefore.moves.length||localBefore.cuts.length||localBefore.audits.length||(localBefore.reservations||[]).length||(localBefore.packages||[]).length||(localBefore.workshopStock||[]).length)&&localSnapshot!==remoteSnapshot){
    const backupKey=STORAGE_KEY+'_backup_'+new Date().toISOString().replace(/[:.]/g,'-');
    try{localStorage.setItem(backupKey,localSnapshot);console.warn('Dados locais diferentes do servidor foram preservados em '+backupKey);if(status)status.value='Conectado — backup local preservado';}catch(e){throw new Error('Dados locais diferentes do servidor; não foi possível criar backup local. Sincronização interrompida para proteger os dados.');}
   }
   state={products:Array.isArray(saved.products)?saved.products:[],moves:Array.isArray(saved.moves)?saved.moves:[],cuts:Array.isArray(saved.cuts)?saved.cuts:[],audits:Array.isArray(saved.audits)?saved.audits:[],reservations:Array.isArray(saved.reservations)?saved.reservations:[],packages:Array.isArray(saved.packages)?saved.packages:[]};
   try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){console.warn('Cache local indisponível:',e);}
   remoteReady=true;
   if(status)status.value='Conectado ao PostgreSQL';
  }else{
   // Banco vazio: preservar e migrar os dados que já existirem neste navegador.
   const local=loadState();
   state={products:local.products,moves:local.moves,cuts:local.cuts,audits:local.audits,reservations:local.reservations||[],packages:local.packages||[],workshopStock:local.workshopStock||[]};
   const snapshot=JSON.stringify(state);
   const saveResponse=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','Accept':'application/json','If-Match':String(remoteRevision)},body:snapshot});
   if(!saveResponse.ok)throw new Error('Não foi possível migrar os dados locais (HTTP '+saveResponse.status+').');
   const migrationResult=await saveResponse.json();remoteRevision=Number(migrationResult.revision)||1;
   remoteReady=true;
   if(status)status.value='Conectado — dados locais migrados';
  }
 }catch(error){
  remoteReady=false;
  state=loadState();
  if(status)status.value='Offline — usando dados locais';
  console.warn('PostgreSQL indisponível; mantendo os dados locais:',error);
 }
 renderProductSelects();renderAll();refreshInvProducts();renderAuditHistory();renderReports();renderReservations();renderPackages();renderForecast();
}
// Acesso sem senha temporariamente, conforme solicitado.
const THEME_KEY='estoque_aviamentos_theme_v1';
function applyTheme(theme){const normalized=theme==='light'?'light':'dark';document.documentElement.setAttribute('data-theme',normalized);const b=$('themeToggle');if(b){b.textContent=normalized==='light'?'🌙 Tema escuro':'☀️ Tema claro';b.setAttribute('aria-pressed',String(normalized==='light'));}try{localStorage.setItem(THEME_KEY,normalized);}catch(e){console.warn('Preferência de tema não pôde ser salva:',e);}}
$('themeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.getAttribute('data-theme')==='light'?'dark':'light'));
let savedTheme='dark';try{savedTheme=localStorage.getItem(THEME_KEY)||'dark';}catch(e){}applyTheme(savedTheme);
init();
})();
