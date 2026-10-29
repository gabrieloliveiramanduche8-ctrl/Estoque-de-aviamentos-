const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
function extractFunction(name){const re=new RegExp('function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{','m');const m=re.exec(html);assert(m,'function not found: '+name);let i=m.index+m[0].length,depth=1,quote=null,esc=false;for(;i<html.length;i++){const c=html[i];if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return html.slice(m.index,i+1);}throw Error('unterminated '+name)}
const ctx={Number,String,Array,Set,Math,JSON};vm.createContext(ctx);vm.runInContext(extractFunction('validateImportedBackup')+';this.validateImportedBackup=validateImportedBackup;',ctx);
let pass=0,fail=0;function test(name,fn){try{fn();console.log('PASS',name);pass++;}catch(e){console.error('FAIL',name,e.message);fail++;}}
test('aceita backup válido com campos opcionais ausentes',()=>assert.strictEqual(ctx.validateImportedBackup({products:[{name:'Zíper',qty:10}],moves:[],cuts:[]}).ok,true));
test('rejeita JSON que não seja objeto',()=>assert.strictEqual(ctx.validateImportedBackup([]).ok,false));
test('rejeita listas principais ausentes',()=>assert.strictEqual(ctx.validateImportedBackup({products:[],moves:[]}).ok,false));
test('rejeita registro nulo em lista',()=>assert.strictEqual(ctx.validateImportedBackup({products:[null],moves:[],cuts:[]}).ok,false));
test('rejeita produto sem nome',()=>assert.strictEqual(ctx.validateImportedBackup({products:[{name:' '}],moves:[],cuts:[]}).ok,false));
test('rejeita saldo negativo ou não numérico',()=>{assert.strictEqual(ctx.validateImportedBackup({products:[{name:'X',qty:-1}],moves:[],cuts:[]}).ok,false);assert.strictEqual(ctx.validateImportedBackup({products:[{name:'X',qty:'abc'}],moves:[],cuts:[]}).ok,false)});
test('rejeita conteúdo de embalagem inválido',()=>assert.strictEqual(ctx.validateImportedBackup({products:[{name:'X',packSize:-2}],moves:[],cuts:[]}).ok,false));
test('rejeita códigos duplicados no backup',()=>assert.strictEqual(ctx.validateImportedBackup({products:[{name:'A',code:'123'},{name:'B',code:'123'}],moves:[],cuts:[]}).ok,false));
test('rejeita quantidade inválida em movimentação',()=>assert.strictEqual(ctx.validateImportedBackup({products:[],moves:[{qty:-4}],cuts:[]}).ok,false));
test('código duplicado também é bloqueado no cadastro',()=>assert(html.includes("String(x.code||'').trim()===p.code")));
test('conferência usa tolerância numérica para diferenças de ponto flutuante',()=>assert(html.includes('const tolerance=Math.max(0.001,Math.abs(planned)*1e-9)')));
test('backup exportado identifica a versão 1.4.5',()=>assert(html.includes("version:'1.4.5'")));
test('restauração pede confirmação com quantidades e valida os dados antes',()=>assert(html.includes('const validation=validateImportedBackup(data)')&&html.includes('${data.products.length} produto(s)')));
test('não altera regras de consumo já cadastradas',()=>{assert(html.includes('amount:total,unit:\'unidades\''));assert(html.includes('const meters=total*1.3'));assert(html.includes('g.qty*.35'));assert(html.includes('total*.4'));});
test('novas páginas de reservas, embalagens, previsão e assistente existem',()=>{for(const id of ['reservas','embalagens','previsao','assistente'])assert(html.includes('id="page-'+id+'"'));});
test('reservas não baixam estoque físico',()=>assert(html.includes('Reserva criada. O saldo físico não foi baixado.')));
test('bloqueia reserva acima do disponível',()=>assert(html.includes('qty>availableQty(p)+1e-9')));
test('código de embalagem é único',()=>assert(html.includes("x.code.toLowerCase()===code.toLowerCase()")));
test('rastreio de embalagem não altera saldo geral',()=>assert(html.includes('sem alterar o saldo geral')));
test('previsão usa somente saídas registradas na unidade do produto',()=>assert(html.includes("m.type==='saida'&&m.productId===p.id")&&html.includes('String(m.unit||p.unit)===String(p.unit)')));
test('assistente identifica explicitamente que não é IA generativa',()=>assert(html.includes('não é um modelo de IA generativa')));
test('estado antigo continua aceito sem arrays novos',()=>assert(html.includes("reservations:Array.isArray(s.reservations)?s.reservations:[],packages:Array.isArray(s.packages)?s.packages:[],workshopStock:Array.isArray(s.workshopStock)?s.workshopStock:[]")));
test('backup valida reservas e códigos de embalagem antes de restaurar',()=>{const fn=extractFunction('validateImportedBackup');const c={Number,String,Array,Set,Math,JSON};vm.createContext(c);vm.runInContext(fn+';this.f=validateImportedBackup;',c);assert.strictEqual(c.f({products:[],moves:[],cuts:[],reservations:[{oc:'',productId:'p',qty:1,status:'ativa'}]}).ok,false);assert.strictEqual(c.f({products:[],moves:[],cuts:[],packages:[{code:'X',productId:'p',initial:2,remaining:-1,unit:'rolo'}]}).ok,false);});
test('backup restaura reservas e embalagens sem descartá-las',()=>assert(html.includes("reservations:Array.isArray(data.reservations)?data.reservations:[],packages:Array.isArray(data.packages)?data.packages:[],workshopStock:Array.isArray(data.workshopStock)?data.workshopStock:[]")));
test('saídas comuns respeitam o saldo livre após reservas',()=>assert(html.includes("qty>availableQty(p)+1e-9")));
test('migração protege reservas e embalagens locais antes de sincronizar',()=>assert(html.includes("(localBefore.reservations||[]).length||(localBefore.packages||[]).length")));

const cutCtx={String,Number,Boolean,Math};vm.createContext(cutCtx);vm.runInContext(extractFunction('parseCutSheetText')+';this.parseCutSheetText=parseCutSheetText;',cutCtx);
test('OCR de ficha reconhece OC, corte, pares e grade',()=>{const r=cutCtx.parseCutSheetText('OC: OC-2080\nCorte: C-19\n130 pares\n1 2 3 4 4 2');assert.strictEqual(r.oc,'OC-2080');assert.strictEqual(r.cut,'C-19');assert.strictEqual(r.pairs,130);assert.deepStrictEqual(Array.from(r.grade),[1,2,3,4,4,2]);});
test('OCR não inventa grade quando ela não está no texto',()=>{const r=cutCtx.parseCutSheetText('OC 2080, 120 pares');assert.strictEqual(r.grade,null);assert.strictEqual(r.pairs,120);});
test('OCR não aplica nem salva automaticamente',()=>assert(html.includes('nunca salva automaticamente')&&html.includes('Revise e calcule manualmente.')));

test('envio de corte considera reservas de outras OCs e permite a própria OC',()=>assert(html.includes('availableForOC(p,currentCalc.oc)')));
test('envio para oficina registra OC e consome reserva correspondente',()=>assert(html.includes("oc:currentCalc.oc||''")&&html.includes('fulfillReservationsForOC(productId,currentCalc.oc,totalQty)')));
test('reserva mantém histórico de quantidade consumida',()=>assert(html.includes('fulfilledQty')));
test('saída por foto/voz respeita reservas ativas',()=>assert(html.includes('v.qty>availableQty(p)+1e-9')));
test('saídas por foto/voz somam itens repetidos antes de confirmar',()=>assert(html.includes('const totals=new Map();for(const x of prepared)totals.set(x.p.id,(totals.get(x.p.id)||0)+x.v.qty)')));
test('backup valida vínculo de reservas e embalagens com produtos existentes',()=>assert(html.includes('!productIds.has(String(r.productId))')&&html.includes('!productIds.has(String(p.productId))')));
const forecastCtx={Number,Math};vm.createContext(forecastCtx);vm.runInContext(extractFunction('calculateForecastMetrics')+';this.calculateForecastMetrics=calculateForecastMetrics;',forecastCtx);
test('previsão calcula média diária e cobertura após reservas',()=>{const r=forecastCtx.calculateForecastMetrics({used:300,windowDays:30,available:50,leadDays:7,safetyDays:7});assert.strictEqual(r.daily,10);assert.strictEqual(r.daysLeft,5);assert.strictEqual(r.suggested,90);assert.strictEqual(r.status,'Reposição urgente');});
test('previsão nunca sugere quantidade negativa',()=>{const r=forecastCtx.calculateForecastMetrics({used:10,windowDays:30,available:100,leadDays:7,safetyDays:7});assert.strictEqual(r.suggested,0);});
test('previsão respeita prazo e margem configurados',()=>{const r=forecastCtx.calculateForecastMetrics({used:300,windowDays:30,available:80,leadDays:7,safetyDays:7});assert.strictEqual(r.suggested,60);assert.strictEqual(r.status,'Planejar reposição');});
test('previsão trata janela zero como valor padrão seguro',()=>{const r=forecastCtx.calculateForecastMetrics({used:30,windowDays:0,available:0,leadDays:7,safetyDays:7});assert.strictEqual(r.daily,1);assert.strictEqual(r.suggested,14);});
test('previsão considera somente datas válidas e não futuras',()=>assert(html.includes('Number.isFinite(t)&&t<=Date.now()&&t>=since')));
test('previsão mantém sugestões na unidade cadastrada e sem conversões',()=>assert(html.includes('Sugestão de reposição')&&html.includes('Ela não converte metros, unidades, rolos ou caixas')));

test('envio de corte permite quantidade zero para registrar falta sem baixar saldo',()=>assert(html.includes('line.physicalQty<0')&&html.includes('if(line.qty<=0)continue')&&html.includes('lastDispatch')));
test('envio parcial não exige igualdade com o cálculo',()=>assert(!html.includes('Math.abs(line.qty-expected)>0.0005')&&html.includes('Envio parcial; faltam')));
test('saída parcial continua bloqueando quantidade acima do saldo livre',()=>assert(html.includes('if(totalQty>available+1e-9)')));
test('pendência e sobra são registradas na descrição da movimentação',()=>assert(html.includes('Envio parcial; faltam')&&html.includes('Envio extra de')));
test('painel inicial inclui gráfico de atividade de entradas e saídas',()=>assert(html.includes('id="movementActivityChart"')&&html.includes('function renderMovementActivityChart()')));
test('gráfico de atividade conta registros sem somar unidades incompatíveis',()=>assert(html.includes('d[m.type]++')&&html.includes('conta registros, não quantidades de unidades incompatíveis')));

console.log(`RESULT: ${pass} PASS, ${fail} FAIL`);if(fail)process.exitCode=1;

test('cordão calcula 1 por peça e pacote de 1.000',()=>assert(html.includes("if(pn.includes('cordao') && base==='unidade')")&&html.includes("if(pu==='pacote') return 1000")&&html.includes('cordões necessários')));
test('elástico é baixado por rolos/pacotes, com sobras do pacote aberto',()=>assert(html.includes('const rolls=Math.ceil(amount/25)')&&html.includes('return rolls/15')&&html.includes('sobrando ${15-loose} rolo(s)')));
test('refletivo considera 20 rolos por caixa e 50 m por rolo',()=>assert(html.includes("if(pu==='caixa' || pu==='pacote') return 1000")&&html.includes('const rolls=Math.ceil(meters/50), boxes=Math.floor(rolls/20)')&&html.includes('sobrando ${20-loose} rolo(s)')));
test('botão e courinho ficam associados a Acabamento nos produtos iniciais',()=>assert(html.includes("(n.includes('botao')||n.includes('courinho'))?'Acabamento':'Costura'")));


test('cálculo individual pode ser apagado com confirmação e preserva movimentos',()=>assert(html.includes('data-delete-cut') && html.includes('state.cuts=state.cuts.filter(x=>x.id!==deleteCut)') && html.includes('Não apaga movimentações, saídas, reservas ou altera o saldo do estoque')));
test('apagar todos os cálculos tem confirmação e preserva estoque',()=>assert(html.includes('id=\"deleteAllCuts\"') && html.includes('state.cuts=[]') && html.includes('Não apaga movimentações, saídas para oficina, reservas, produtos ou saldos de estoque')));
console.log(`RESULT: ${pass} PASS, ${fail} FAIL`);
process.exitCode=fail?1:0;

test('dashboard possui filtro de período de 7, 30 e 90 dias',()=>assert(html.includes('id="homeChartPeriod"')&&html.includes('value="90">90 dias</option>')));
test('dashboard compara saldos de produtos sem misturar unidades',()=>assert(html.includes('function renderProductStockChart()')&&html.includes('Mostrando os menores saldos por unidade')));
test('histórico de movimentações tem busca, tipo e período',()=>{for(const id of ['moveSearch','moveFilterType','moveFilterPeriod'])assert(html.includes(`id="${id}"`));});
test('controle de oficina permite consumo, devolução e saldo conhecido',()=>{for(const value of ['consumo','devolucao','saldo'])assert(html.includes(`value="${value}"`));assert(html.includes('function workshopBalance(')&&html.includes('function setWorkshopBalance('));});
test('envios novos aumentam saldo registrado da oficina',()=>assert(html.includes("setWorkshopBalance(workshop,p.id,wb+line.qty")));
test('consumo da oficina não altera estoque central',()=>assert(html.includes("action==='consumo'")));
test('devolução da oficina gera entrada no estoque central',()=>assert(html.includes('Devolução da oficina.')&&html.includes("type:'entrada'")));
test('saldo da oficina é validado na restauração do backup',()=>assert(html.includes("data.workshopStock||[]")&&html.includes('Saldo de oficina')));
test('relatórios exibem estoque atual e exportação CSV',()=>assert(html.includes('id="reportStockTable"')&&html.includes('id="reportStockCsv"')));
test('saldos da oficina são exportáveis em CSV',()=>assert(html.includes('id="exportWorkshopCsv"')&&html.includes("downloadCsv('saldos-oficina.csv'")));
test('backup de estado inclui a nova coleção workshopStock',()=>assert(html.includes("workshopStock:Array.isArray(saved.workshopStock)?saved.workshopStock:[]")&&html.includes("workshopStock:local.workshopStock||[]")));

const workshopCtx={Number,String,Array,Set,Math,JSON,Date,uid:()=>"test-id",norm:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),state:{products:[{id:'p1',name:'Cordão',unit:'pacote'}],workshopStock:[]},productLabel:p=>p.name+' ('+p.unit+')'};
vm.createContext(workshopCtx);vm.runInContext(extractFunction('ensureCollections')+';'+extractFunction('workshopKey')+';'+extractFunction('setWorkshopBalance')+';'+extractFunction('workshopBalance')+';this.setWorkshopBalance=setWorkshopBalance;this.workshopBalance=workshopBalance;',workshopCtx);
test('saldo da oficina inicia no zero e aceita saldo conferido',()=>{assert.strictEqual(workshopCtx.workshopBalance('Oficina A','p1'),0);workshopCtx.setWorkshopBalance('Oficina A','p1',3,{action:'saldo inicial',before:0,delta:3});assert.strictEqual(workshopCtx.workshopBalance('oficina a','p1'),3);});
test('histórico da oficina registra unidade e antes/depois',()=>{const h=workshopCtx.state.workshopStock[0].history[0];assert.strictEqual(h.unit,'pacote');assert.strictEqual(h.before,0);assert.strictEqual(h.after,3);});
test('backup rejeita saldo negativo na oficina',()=>{const c={Number,String,Array,Set,Math,JSON};vm.createContext(c);vm.runInContext(extractFunction('validateImportedBackup')+';this.f=validateImportedBackup;',c);assert.strictEqual(c.f({products:[{id:'p1',name:'Cordão',qty:5}],moves:[],cuts:[],workshopStock:[{workshop:'A',productId:'p1',qty:-1,unit:'pacote'}]}).ok,false);});
test('painel mostra histórico de consumo, envio e devolução',()=>assert(html.includes('id="workshopLedgerHistory"')&&html.includes('Histórico de consumo, envio e devolução')));
test("servidor aceita ajuste físico",()=>assert(fs.readFileSync("server.js","utf8").includes("['entrada','saida','ajuste'].includes(m.type)")));

test('saída de cordão solicita unidades físicas e converte 1.000 por pacote',()=>{assert(html.includes('Quantidade física a enviar (cordões)')&&html.includes("pu==='pacote'?1000")&&html.includes('physicalToStockQty'))});
test('saída de elástico solicita rolos físicos e converte 15 por pacote',()=>{assert(html.includes('Quantidade física a enviar (rolos de 25 m)')&&html.includes("pu==='pacote'?15"))});
test('saída de refletivo solicita rolos físicos e converte 20 por caixa',()=>{assert(html.includes('Quantidade física a enviar (rolos de 50 m)')&&html.includes("pu==='caixa'||pu==='pacote'?20"))});
test('baixa de aviamento especial exige quantidade física inteira',()=>{assert(html.includes('!Number.isInteger(line.physicalQty)'))});
test('histórico guarda quantidade física enviada separada da baixa equivalente',()=>{assert(html.includes('physicalSent:line.physicalQty')&&html.includes('dispatchUnit:line.dispatchUnit'))});
test('trocar oficina recalcula todas as quantidades sugeridas',()=>assert(html.includes("$('bulkWorkshop').addEventListener('change',refreshBulkRowsForWorkshop)")&&html.includes('function refreshBulkRowsForWorkshop()')));
test('envio parcial permite deixar aviamento sem produto cadastrado com quantidade zero',()=>assert(html.includes("(!line.productId&&line.physicalQty>0)")&&html.includes("if(line.skipped){dispatchLines.push")));
test('aviamento sem material fica registrado como pendência sem baixa no estoque',()=>assert(html.includes("reason:'Sem produto cadastrado/sem material; pendente'")&&html.includes('line.missingQty=Math.max(0,requiredPhysical)')));

console.log(`FINAL RESULT: ${pass} PASS, ${fail} FAIL`);process.exitCode=fail?1:0;

// Regression checks for workshop dispatch logic
{ const html=fs.readFileSync('index.html','utf8');
  test('saída desconta saldo físico já existente na oficina',()=>assert(html.includes('function netDispatchRequirement') && html.includes('gross-already')));
  test('itens com nome aproximado não escolhem automaticamente cor/variação',()=>assert(html.includes('const exactMatch=products.find(p=>norm(p.name)===itemName)')));
}

const physicalCtx={Number,String,Math,norm:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()};vm.createContext(physicalCtx);vm.runInContext(extractFunction('workshopPhysicalSpec')+';'+extractFunction('workshopToPhysical')+';'+extractFunction('physicalToWorkshop')+';this.workshopPhysicalSpec=workshopPhysicalSpec;this.workshopToPhysical=workshopToPhysical;this.physicalToWorkshop=physicalToWorkshop;',physicalCtx);
test('saldo de oficina converte pacotes de cordão para cordões físicos',()=>{const p={name:'Cordão',unit:'pacote'};assert.strictEqual(physicalCtx.workshopToPhysical(p,1.4).qty,1400);assert.strictEqual(physicalCtx.physicalToWorkshop(p,600),0.6);});
test('saldo de oficina converte pacote de elástico em rolos físicos',()=>{const p={name:'Elástico preto',unit:'pacote'};assert.strictEqual(physicalCtx.workshopToPhysical(p,1).qty,15);assert.strictEqual(physicalCtx.physicalToWorkshop(p,6),0.4);});
test('saldo de oficina converte caixa de refletivo em rolos físicos',()=>{const p={name:'Refletivo prata',unit:'caixa'};assert.strictEqual(physicalCtx.workshopToPhysical(p,1).qty,20);assert.strictEqual(physicalCtx.physicalToWorkshop(p,5),0.25);});
test('lançamento manual de consumo usa quantidade física e converte para unidade de estoque',()=>assert(html.includes('Quantidade física (${spec.unit}) *')&&html.includes('const qty=physicalToWorkshop(p,physicalQty)')&&html.includes('beforePhysical=workshopToPhysical(p,before).qty')));
test('tabela e CSV de saldos mostram unidade física, não fração de pacote',()=>assert(html.includes('Saldo físico na oficina')&&html.includes('Saldo físico','Unidade física')&&html.includes("downloadCsv('saldos-oficina.csv',rows)")));
console.log(`FINAL PATCH TESTS: ${pass} PASS, ${fail} FAIL`);process.exitCode=fail?1:0;
