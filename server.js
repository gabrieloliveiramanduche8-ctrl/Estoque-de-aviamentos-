
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Conexão com PostgreSQL
let pool = null;

if (process.env.DATABASE_URL) {
  const isProduction = process.env.NODE_ENV === "production";

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
  });

  pool.on("error", (err) => {
    console.error("Erro PostgreSQL:", err.message);
  });
}

// Criar a tabela automaticamente
async function ensureStateTable() {
  if (!pool) {
    throw new Error("DATABASE_URL não configurada.");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS estoque_app_state (
      id INTEGER PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// TESTE DO SERVIDOR
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Estoque de Aviamentos",
    databaseConfigured: Boolean(process.env.DATABASE_URL)
  });
});

// TESTE DO BANCO
app.get("/api/db-status", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      configured: false,
      connected: false,
      message: "DATABASE_URL não configurada."
    });
  }

  try {
    await pool.query("SELECT 1");

    return res.json({
      configured: true,
      connected: true,
      message: "Conexão com PostgreSQL funcionando."
    });
  } catch (err) {
    console.error("Erro ao conectar ao banco:", err.message);

    return res.status(503).json({
      configured: true,
      connected: false,
      message: "Falha na conexão com PostgreSQL."
    });
  }
});

// CARREGAR DADOS DO BANCO
app.get("/api/state", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Banco de dados não configurado."
    });
  }

  try {
    await ensureStateTable();

    const result = await pool.query(
      "SELECT state FROM estoque_app_state WHERE id = 1"
    );

    if (result.rows.length === 0) {
      return res.json({
        empty: true,
        state: null
      });
    }

    return res.json({
      empty: false,
      state: result.rows[0].state
    });
  } catch (err) {
    console.error("Erro ao carregar dados:", err.message);

    return res.status(500).json({
      error: "Não foi possível carregar os dados."
    });
  }
});

// SALVAR DADOS NO BANCO
app.put("/api/state", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Banco de dados não configurado."
    });
  }

  const state = req.body;
  const requiredArrays = [
    "products",
    "moves",
    "cuts",
    "audits"
  ];

  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    !requiredArrays.every(
      (key) => Array.isArray(state[key])
    )
  ) {
    return res.status(400).json({
      error: "Formato de dados inválido."
    });
  }

  try {
    await ensureStateTable();

    await pool.query(
      `INSERT INTO estoque_app_state
         (id, state, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         state = EXCLUDED.state,
         updated_at = NOW()`,
      [JSON.stringify(state)]
    );

    return res.json({
      ok: true,
      message: "Dados salvos no PostgreSQL."
    });
  } catch (err) {
    console.error("Erro ao salvar dados:", err.message);

    return res.status(500).json({
      error: "Não foi possível salvar os dados."
    });
  }
});

// PUBLICAR ARQUIVOS DO SITE
app.use(express.static(ROOT));
app.use(express.static(path.join(ROOT, "public")));

app.get("/", (_req, res) => {
  res.sendFile(
    path.join(ROOT, "index.html"),
    (err) => {
      if (err && !res.headersSent) {
        res.status(404).send(
          "Arquivo index.html não encontrado."
        );
      }
    }
  );
});

// API NÃO ENCONTRADA
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "Rota da API não encontrada."
  });
});

// TRATAMENTO DE ERROS
app.use((err, _req, res, _next) => {
  console.error("Erro na aplicação:", err.message);

  res.status(500).json({
    error: "Erro interno do servidor."
  });
});

// INICIAR SERVIDOR
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Estoque de Aviamentos rodando na porta ${PORT}`
  );
});

// ENCERRAMENTO SEGURO
async function shutdown() {
  server.close(async () => {
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error(
          "Erro ao encerrar PostgreSQL:",
          err.message
        );
      }
    }

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

