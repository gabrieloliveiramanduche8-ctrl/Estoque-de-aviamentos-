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
test('backup exportado identifica a versão 1.2.2',()=>assert(html.includes("version:'1.2.2'")));
test('restauração pede confirmação com quantidades e valida os dados antes',()=>assert(html.includes('const validation=validateImportedBackup(data)')&&html.includes('${data.products.length} produto(s)')));
test('não altera regras de consumo já cadastradas',()=>{assert(html.includes('amount:0,unit:\'unidades\',requiresManual:true'));assert(html.includes('const meters=total*1.3'));assert(html.includes('g.qty*.35'));assert(html.includes('total*.4'));});
test('bloqueia número de corte duplicado ao salvar cálculo',()=>assert(html.includes('Já existe um cálculo salvo com este número de corte.')));
test('exige número do corte e cálculo salvo antes da saída vinculada',()=>assert(html.includes('Informe o número do corte antes de registrar uma saída vinculada.')&&html.includes('Salve o cálculo antes de registrar a saída.')));
test('saída em lote tem guarda contra clique duplo',()=>assert(html.includes('let bulkIssueInProgress=false')&&html.includes('if(bulkIssueInProgress)return')));
console.log(`RESULT: ${pass} PASS, ${fail} FAIL`);if(fail)process.exitCode=1;
