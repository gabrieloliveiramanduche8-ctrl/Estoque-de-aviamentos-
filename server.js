const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

let pool = null;
if (process.env.DATABASE_URL) {
  const isProduction = process.env.NODE_ENV === "production";
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
  });
  pool.on("error", err => console.error("Erro inesperado no PostgreSQL:", err.message));
}

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "Estoque de Aviamentos",
    databaseConfigured: Boolean(process.env.DATABASE_URL)
  });
});

app.get("/api/db-status", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      configured: false,
      connected: false,
      message: "DATABASE_URL ainda não foi configurada no Render."
    });
  }
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({
      configured: true,
      connected: true,
      message: "Conexão com PostgreSQL funcionando."
    });
  } catch (err) {
    console.error("Falha ao testar PostgreSQL:", err.message);
    return res.status(503).json({
      configured: true,
      connected: false,
      message: "Não foi possível conectar ao PostgreSQL. Confira DATABASE_URL no Render."
    });
  }
});

let schemaReady = null;
function ensureSchema() {
  if (!pool) throw new Error("DATABASE_URL não configurada.");
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS estoque_app_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL DEFAULT '{"products":[],"moves":[],"cuts":[],"audits":[]}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

function normalizeState(value) {
  const s = value && typeof value === "object" ? value : {};
  return {
    products: Array.isArray(s.products) ? s.products : [],
    moves: Array.isArray(s.moves) ? s.moves : [],
    cuts: Array.isArray(s.cuts) ? s.cuts : [],
    audits: Array.isArray(s.audits) ? s.audits : []
  };
}

app.get("/api/state", async (_req, res) => {
  if (!pool) return res.status(503).json({ error: "Banco não configurado. Confira DATABASE_URL no Render." });
  try {
    await ensureSchema();
    const result = await pool.query("SELECT payload FROM estoque_app_state WHERE id = 1");
    if (!result.rowCount) return res.status(200).json({ empty: true, state: null });
    return res.status(200).json({ empty: false, state: normalizeState(result.rows[0].payload) });
  } catch (err) {
    console.error("Erro ao ler estado do estoque:", err.message);
    return res.status(503).json({ error: "Não foi possível ler os dados do PostgreSQL." });
  }
});

app.put("/api/state", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Banco não configurado. Confira DATABASE_URL no Render." });
  try {
    const state = normalizeState(req.body);
    await ensureSchema();
    await pool.query(
      "INSERT INTO estoque_app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()",
      [JSON.stringify(state)]
    );
    return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Erro ao salvar estado do estoque:", err.message);
    return res.status(503).json({ error: "Não foi possível salvar os dados no PostgreSQL." });
  }
});

app.use(express.static(ROOT));
app.use(express.static(path.join(ROOT, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"), err => {
    if (err && !res.headersSent) res.status(404).send("Arquivo index.html não encontrado na raiz do repositório.");
  });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Rota da API não encontrada." }));
app.use((err, _req, res, _next) => {
  console.error("Erro na aplicação:", err.message);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Estoque de Aviamentos rodando na porta ${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    if (pool) {
      try { await pool.end(); }
      catch (err) { console.error("Erro ao encerrar PostgreSQL:", err.message); }
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
