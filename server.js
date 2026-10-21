const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, "public");

// Usa uma tabela nova para evitar conflito com tabelas antigas do projeto.
const STATE_TABLE = "estoque_app_state_store";

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render PostgreSQL gerenciado normalmente requer TLS.
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    })
  : null;

if (pool) {
  pool.on("error", (err) => {
    console.error("Erro inesperado no pool PostgreSQL:", err.message);
  });
}

async function ensureStateTable() {
  if (!pool) throw new Error("DATABASE_URL não configurada.");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
      id INTEGER PRIMARY KEY,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "Estoque de Aviamentos",
    databaseConfigured: Boolean(pool),
  });
});

app.get("/api/db-status", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      configured: false,
      connected: false,
      message: "DATABASE_URL não está configurada no Render.",
    });
  }

  try {
    await pool.query("SELECT 1");
    await ensureStateTable();
    return res.status(200).json({
      configured: true,
      connected: true,
      message: "Conexão PostgreSQL funcionando e tabela da aplicação disponível.",
    });
  } catch (err) {
    console.error("Falha ao testar PostgreSQL:", err.message);
    return res.status(503).json({
      configured: true,
      connected: false,
      message: "Não foi possível consultar o PostgreSQL.",
    });
  }
});

app.get("/api/state", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "Banco de dados não configurado." });
  }

  try {
    await ensureStateTable();
    const result = await pool.query(
      `SELECT state FROM ${STATE_TABLE} WHERE id = $1`,
      [1]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({ empty: true, state: null });
    }

    return res.status(200).json({
      empty: false,
      state: result.rows[0].state,
    });
  } catch (err) {
    console.error("Erro ao carregar dados:", err.message);
    return res.status(500).json({
      error: "Não foi possível carregar os dados.",
    });
  }
});

app.put("/api/state", async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: "Banco de dados não configurado." });
  }

  // O index.html envia o próprio objeto de estado, não { state: ... }.
  const state = req.body;
  const requiredArrays = ["products", "moves", "cuts", "audits"];

  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    !requiredArrays.every((key) => Array.isArray(state[key]))
  ) {
    return res.status(400).json({
      error: "Formato inválido. Esperados: products, moves, cuts e audits como listas.",
    });
  }

  try {
    await ensureStateTable();
    await pool.query(
      `INSERT INTO ${STATE_TABLE} (id, state, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
      [1, JSON.stringify(state)]
    );

    return res.status(200).json({
      ok: true,
      message: "Dados salvos no PostgreSQL.",
    });
  } catch (err) {
    console.error("Erro ao salvar dados:", err.message);
    return res.status(500).json({
      error: "Não foi possível salvar os dados.",
    });
  }
});

// Publica a interface em public/index.html e também suporta index.html na raiz.
app.use(express.static(PUBLIC_DIR));
app.use(express.static(APP_DIR));

app.get("/", (_req, res) => {
  const publicIndex = path.join(PUBLIC_DIR, "index.html");
  const rootIndex = path.join(APP_DIR, "index.html");
  res.sendFile(publicIndex, (err) => {
    if (err && !res.headersSent) {
      res.sendFile(rootIndex, (rootErr) => {
        if (rootErr && !res.headersSent) {
          res.status(404).send("index.html não encontrado.");
        }
      });
    }
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Rota da API não encontrada." });
});

app.use((err, _req, res, _next) => {
  console.error("Erro na aplicação:", err.message);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Estoque de Aviamentos rodando na porta ${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    if (pool) await pool.end().catch((err) => {
      console.error("Erro ao encerrar pool PostgreSQL:", err.message);
    });
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
