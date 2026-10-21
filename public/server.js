const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 10000;
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não configurada no Render.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const EMPTY_STATE = { products: [], moves: [], cuts: [], audits: [] };

async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(
    `INSERT INTO app_state (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(EMPTY_STATE)]
  );
}
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); }
  catch (err) { console.error(err.message); res.status(503).json({ ok: false, database: 'unavailable' }); }
});
app.get('/api/state', async (_req, res) => {
  try {
    const result = await pool.query('SELECT payload FROM app_state WHERE id = 1');
    res.json(result.rows[0]?.payload || EMPTY_STATE);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Não foi possível carregar os dados.' }); }
});
app.put('/api/state', async (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.moves) ||
      !Array.isArray(payload.cuts) || !Array.isArray(payload.audits)) {
    return res.status(400).json({ error: 'Formato de dados inválido.' });
  }
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 1500000) {
    return res.status(413).json({ error: 'Dados excedem o limite permitido.' });
  }
  try {
    const result = await pool.query(
      'UPDATE app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1 RETURNING updated_at',
      [JSON.stringify(payload)]
    );
    res.json({ ok: true, updatedAt: result.rows[0]?.updated_at });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Não foi possível salvar os dados.' }); }
});
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
initializeDatabase()
  .then(() => app.listen(port, '0.0.0.0', () => console.log('Estoque de Aviamentos ouvindo na porta ' + port)))
  .catch(err => { console.error('Falha ao inicializar PostgreSQL:', err.message); process.exit(1); });
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
