

const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const STATE_TABLE = "estoque_app_state_store";

app.use(express.json({ limit: "10mb" }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })
  : null;

async function ensureStateTable() {
  if (!pool) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  // Cria uma tabela separada sem apagar as tabelas antigas.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
      id INTEGER PRIMARY KEY,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/api/health", (_req, res) => {
  res.json({
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
      message: "DATABASE_URL não está configurada.",
    });
  }

  try {
    await pool.query("SELECT 1");

    return res.json({
      configured: true,
      connected: true,
      message: "Conexão com PostgreSQL funcionando.",
    });
  } catch (error) {
    console.error("Erro ao testar PostgreSQL:", error.message);

    return res.status(503).json({
      configured: true,
      connected: false,
      message: "Não foi possível conectar ao PostgreSQL.",
    });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    await ensureStateTable();

    const result = await pool.query(
      `SELECT state
       FROM ${STATE_TABLE}
       WHERE id = $1`,
      [1]
    );

    if (result.rowCount === 0) {
      return res.json({
        empty: true,
        state: null,
      });
    }

    return res.json({
      empty: false,
      state: result.rows[0].state,
    });
  } catch (error) {
    console.error("Erro ao carregar dados:", error.message);

    return res.status(500).json({
      error: "Não foi possível carregar os dados.",
    });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    await ensureStateTable();

    const state = req.body && req.body.state;

    if (
      !state ||
      typeof state !== "object" ||
      Array.isArray(state)
    ) {
      return res.status(400).json({
        error: "Envie um objeto state válido.",
      });
    }

    for (const key of ["products", "moves", "cuts", "audits"]) {
      if (state[key] !== undefined && !Array.isArray(state[key])) {
        return res.status(400).json({
          error: `O campo "${key}" deve ser uma lista.`,
        });
      }
    }

    await pool.query(
      `INSERT INTO ${STATE_TABLE} (id, state, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET
         state = EXCLUDED.state,
         updated_at = NOW()`,
      [1, JSON.stringify(state)]
    );

    return res.json({
      ok: true,
      message: "Dados salvos no PostgreSQL.",
    });
  } catch (error) {
    console.error("Erro ao salvar dados:", error.message);

    return res.status(500).json({
      error: "Não foi possível salvar os dados.",
    });
  }
});

// Disponibiliza os arquivos da aplicação.
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Resposta JSON para rotas de API inexistentes.
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "Rota da API não encontrada.",
  });
});

app.use((error, _req, res, _next) => {
  console.error("Erro inesperado:", error.message);

  res.status(500).json({
    error: "Erro interno do servidor.",
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Estoque de Aviamentos rodando na porta ${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    if (pool) {
      await pool.end().catch(() => {});
    }

    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
