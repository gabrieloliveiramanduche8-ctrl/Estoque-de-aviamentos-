const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// PostgreSQL é opcional para o servidor iniciar.
// Configure DATABASE_URL nas variáveis de ambiente do Render para conectar o banco.
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

  pool.on("error", (err) => {
    console.error("Erro inesperado na conexão PostgreSQL:", err.message);
  });
}

// Rotas de diagnóstico para verificar o serviço no Render.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "Estoque de Aviamentos",
    databaseConfigured: Boolean(process.env.DATABASE_URL)
  });
});

app.get("/api/db-status", async (_req, res) => {
  if (!pool) {
    return res.status(200).json({
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

// Publica os arquivos estáticos da raiz do repositório e da pasta public.
app.use(express.static(ROOT));
app.use(express.static(path.join(ROOT, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"), (err) => {
    if (err && !res.headersSent) {
      res.status(404).send("Arquivo index.html não encontrado na raiz do repositório.");
    }
  });
});

// Resposta JSON para rotas API desconhecidas.
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
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error("Erro ao encerrar PostgreSQL:", err.message);
      }
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
