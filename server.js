const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
const ADMIN_PASSWORD = process.env.STOCK_ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const COOKIE_NAME = "estoque_session";
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, max: 5 });
  pool.on("error", err => console.error("PostgreSQL pool error:", err.message));
}
function safeEqual(a,b){const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);}
function sign(payload){return crypto.createHmac("sha256",SESSION_SECRET).update(payload).digest("base64url");}
function cookieValue(req){const raw=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE_NAME+"="));return raw?decodeURIComponent(raw.slice(COOKIE_NAME.length+1)):"";}
function validSession(req){if(!SESSION_SECRET)return false;const token=cookieValue(req);const dot=token.lastIndexOf(".");if(dot<1)return false;const payload=token.slice(0,dot),signature=token.slice(dot+1);if(!safeEqual(signature,sign(payload)))return false;try{const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));return data.exp>Date.now() && data.role==="admin";}catch{return false;}}
function requireAuth(req,res,next){if(validSession(req))return next();return res.status(401).json({error:"Autenticação necessária."});}
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"Estoque de Aviamentos",databaseConfigured:Boolean(pool),authConfigured:Boolean(ADMIN_PASSWORD&&SESSION_SECRET)}));
app.get("/api/auth/me",(req,res)=>res.json({authenticated:validSession(req),loginConfigured:Boolean(ADMIN_PASSWORD&&SESSION_SECRET)}));
app.post("/api/auth/login",(req,res)=>{
 if(!ADMIN_PASSWORD||!SESSION_SECRET)return res.status(503).json({error:"Configure STOCK_ADMIN_PASSWORD e SESSION_SECRET nas variáveis de ambiente do servidor."});
 const password=req.body&&req.body.password;
 if(typeof password!=="string"||!safeEqual(password,ADMIN_PASSWORD))return res.status(401).json({error:"Senha incorreta."});
 const payload=Buffer.from(JSON.stringify({role:"admin",exp:Date.now()+SESSION_TTL_SECONDS*1000,nonce:crypto.randomBytes(16).toString("hex")}),"utf8").toString("base64url");
 const token=payload+"."+sign(payload);res.setHeader("Set-Cookie",`${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${process.env.NODE_ENV==="production"?"; Secure":""}`);return res.json({ok:true});
});
app.post("/api/auth/logout",(_req,res)=>{res.setHeader("Set-Cookie",`${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV==="production"?"; Secure":""}`);res.json({ok:true});});
app.get("/api/db-status",requireAuth,async(_req,res)=>{if(!pool)return res.status(503).json({configured:false,connected:false,message:"DATABASE_URL ainda não foi configurada."});try{await pool.query("SELECT 1");res.json({configured:true,connected:true,message:"Conexão com PostgreSQL funcionando."});}catch(err){console.error("PostgreSQL status error:",err.message);res.status(503).json({configured:true,connected:false,message:"Não foi possível conectar ao PostgreSQL."});}});
async function ensureStateTable(){if(!pool)throw new Error("DATABASE_URL não configurada.");await pool.query(`CREATE TABLE IF NOT EXISTS estoque_app_state (id INTEGER PRIMARY KEY,state JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),revision BIGINT NOT NULL DEFAULT 1)`);await pool.query("ALTER TABLE estoque_app_state ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1");}
app.get("/api/state",requireAuth,async(_req,res)=>{if(!pool)return res.status(503).json({error:"Banco de dados não configurado."});try{await ensureStateTable();const r=await pool.query("SELECT state, revision FROM estoque_app_state WHERE id=1");if(!r.rowCount)return res.json({empty:true,state:null,revision:0});res.setHeader("ETag",String(r.rows[0].revision));res.json({empty:false,state:r.rows[0].state,revision:Number(r.rows[0].revision)});}catch(err){console.error("State load error:",err.message);res.status(500).json({error:"Não foi possível carregar os dados."});}});
app.put("/api/state",requireAuth,async(req,res)=>{if(!pool)return res.status(503).json({error:"Banco de dados não configurado."});const state=req.body;const keys=["products","moves","cuts","audits"];if(!state||typeof state!=="object"||Array.isArray(state)||!keys.every(k=>Array.isArray(state[k])))return res.status(400).json({error:"Formato de dados inválido."});if(Buffer.byteLength(JSON.stringify(state),"utf8")>9*1024*1024)return res.status(413).json({error:"Estado excede o limite permitido."});try{await ensureStateTable();const expected=Number(req.get("If-Match"));const client=await pool.connect();try{await client.query("BEGIN");const current=await client.query("SELECT revision FROM estoque_app_state WHERE id=1 FOR UPDATE");if(current.rowCount){const actual=Number(current.rows[0].revision);if(!Number.isFinite(expected)||expected!==actual){await client.query("ROLLBACK");return res.status(409).json({error:"Os dados mudaram no servidor. Recarregue antes de salvar para evitar sobrescrever alterações.",revision:actual});}const updated=await client.query("UPDATE estoque_app_state SET state=$1::jsonb,updated_at=NOW(),revision=revision+1 WHERE id=1 RETURNING revision",[JSON.stringify(state)]);await client.query("COMMIT");return res.json({ok:true,revision:Number(updated.rows[0].revision)});}if(Number.isFinite(expected)&&expected!==0){await client.query("ROLLBACK");return res.status(409).json({error:"O estado do servidor foi alterado. Recarregue os dados.",revision:0});}const inserted=await client.query("INSERT INTO estoque_app_state(id,state,revision) VALUES(1,$1::jsonb,1) ON CONFLICT(id) DO NOTHING RETURNING revision",[JSON.stringify(state)]);if(!inserted.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Outro usuário inicializou o estoque. Recarregue os dados."});}await client.query("COMMIT");return res.json({ok:true,revision:1});}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}}catch(err){console.error("State save error:",err.message);res.status(500).json({error:"Não foi possível salvar os dados."});}});
app.use(express.static(ROOT));app.use(express.static(path.join(ROOT,"public")));app.get("/",(_req,res)=>res.sendFile(path.join(ROOT,"index.html"),err=>{if(err&&!res.headersSent)res.status(404).send("Arquivo index.html não encontrado.");}));app.use("/api",(_req,res)=>res.status(404).json({error:"Rota da API não encontrada."}));app.use((err,_req,res,_next)=>{console.error("Application error:",err.message);res.status(500).json({error:"Erro interno do servidor."});});
const server=app.listen(PORT,"0.0.0.0",()=>console.log(`Estoque de Aviamentos rodando na porta ${PORT}`));
async function shutdown(){server.close(async()=>{if(pool)await pool.end().catch(()=>{});process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
