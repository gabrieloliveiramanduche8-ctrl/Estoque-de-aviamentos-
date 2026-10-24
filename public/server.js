const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Permissions-Policy","camera=(self), microphone=(self), geolocation=()");
  if(req.path.startsWith("/api/")) res.setHeader("Cache-Control","no-store");
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, max: 5 });
  pool.on("error", err => console.error("PostgreSQL pool error:", err.message));
}
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"Estoque de Aviamentos",databaseConfigured:Boolean(pool),authConfigured:false}));
app.get("/api/db-status",async(_req,res)=>{if(!pool)return res.status(503).json({configured:false,connected:false,message:"DATABASE_URL ainda não foi configurada."});try{await pool.query("SELECT 1");res.json({configured:true,connected:true,message:"Conexão com PostgreSQL funcionando."});}catch(err){console.error("PostgreSQL status error:",err.message);res.status(503).json({configured:true,connected:false,message:"Não foi possível conectar ao PostgreSQL."});}});
async function ensureStateTable(){if(!pool)throw new Error("DATABASE_URL não configurada.");await pool.query(`CREATE TABLE IF NOT EXISTS estoque_app_state (id INTEGER PRIMARY KEY,state JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),revision BIGINT NOT NULL DEFAULT 1)`);await pool.query("ALTER TABLE estoque_app_state ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1");}
app.get("/api/state",async(_req,res)=>{if(!pool)return res.status(503).json({error:"Banco de dados não configurado."});try{await ensureStateTable();const r=await pool.query("SELECT state, revision FROM estoque_app_state WHERE id=1");if(!r.rowCount)return res.json({empty:true,state:null,revision:0});res.setHeader("ETag",String(r.rows[0].revision));res.json({empty:false,state:r.rows[0].state,revision:Number(r.rows[0].revision)});}catch(err){console.error("State load error:",err.message);res.status(500).json({error:"Não foi possível carregar os dados."});}});
app.put("/api/state",async(req,res)=>{if(!pool)return res.status(503).json({error:"Banco de dados não configurado."});const state=req.body;const keys=["products","moves","cuts","audits"];if(!state||typeof state!=="object"||Array.isArray(state)||!keys.every(k=>Array.isArray(state[k])))return res.status(400).json({error:"Formato de dados inválido."});if(Buffer.byteLength(JSON.stringify(state),"utf8")>9*1024*1024)return res.status(413).json({error:"Estado excede o limite permitido."});try{await ensureStateTable();const expected=Number(req.get("If-Match"));const client=await pool.connect();try{await client.query("BEGIN");const current=await client.query("SELECT revision FROM estoque_app_state WHERE id=1 FOR UPDATE");if(current.rowCount){const actual=Number(current.rows[0].revision);if(!Number.isFinite(expected)||expected!==actual){await client.query("ROLLBACK");return res.status(409).json({error:"Os dados mudaram no servidor. Recarregue antes de salvar para evitar sobrescrever alterações.",revision:actual});}const updated=await client.query("UPDATE estoque_app_state SET state=$1::jsonb,updated_at=NOW(),revision=revision+1 WHERE id=1 RETURNING revision",[JSON.stringify(state)]);await client.query("COMMIT");return res.json({ok:true,revision:Number(updated.rows[0].revision)});}if(Number.isFinite(expected)&&expected!==0){await client.query("ROLLBACK");return res.status(409).json({error:"O estado do servidor foi alterado. Recarregue os dados.",revision:0});}const inserted=await client.query("INSERT INTO estoque_app_state(id,state,revision) VALUES(1,$1::jsonb,1) ON CONFLICT(id) DO NOTHING RETURNING revision",[JSON.stringify(state)]);if(!inserted.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Outro usuário inicializou o estoque. Recarregue os dados."});}await client.query("COMMIT");return res.json({ok:true,revision:1});}catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}}catch(err){console.error("State save error:",err.message);res.status(500).json({error:"Não foi possível salvar os dados."});}});
// Serve apenas a pasta pública; não exponha server.js, package.json nem arquivos de backup.
app.use(express.static(path.join(ROOT,"public"),{index:false,dotfiles:"deny"}));
app.get("/",(_req,res)=>res.sendFile(path.join(ROOT,"index.html"),err=>{if(err&&!res.headersSent)res.status(404).send("Arquivo index.html não encontrado.");}));
app.get("/index.html",(_req,res)=>res.sendFile(path.join(ROOT,"index.html"),err=>{if(err&&!res.headersSent)res.status(404).send("Arquivo index.html não encontrado.");}));app.use("/api",(_req,res)=>res.status(404).json({error:"Rota da API não encontrada."}));app.use((err,_req,res,_next)=>{console.error("Application error:",err.message);res.status(500).json({error:"Erro interno do servidor."});});
const server=app.listen(PORT,"0.0.0.0",()=>console.log(`Estoque de Aviamentos rodando na porta ${PORT}`));
async function shutdown(){server.close(async()=>{if(pool)await pool.end().catch(()=>{});process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);
