'use strict';

/**
 * API REST de tareas - Node.js + Express + PostgreSQL.
 * La cadena de conexión NO está en el código: se lee de la variable de entorno
 * DATABASE_URL definida en el panel de la PaaS.
 */
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const connectionString = process.env.DATABASE_URL;
const usarSSL = process.env.PGSSL === 'true' || /\.render\.com/.test(connectionString || '');
const pool = connectionString
  ? new Pool({ connectionString, ssl: usarSSL ? { rejectUnauthorized: false } : false })
  : null;

const ESTADOS = ['pendiente', 'en_progreso', 'completada'];

async function iniciarBD() {
  if (!pool) {
    console.error('Falta la variable de entorno DATABASE_URL');
    return;
  }
  for (let intento = 1; intento <= 5; intento++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tareas (
          id SERIAL PRIMARY KEY,
          titulo VARCHAR(150) NOT NULL,
          descripcion TEXT,
          estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
            CHECK (estado IN ('pendiente','en_progreso','completada')),
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      console.log('Base de datos lista (tabla tareas)');
      return;
    } catch (err) {
      console.error(`Intento ${intento} de conexión a la BD falló: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

function requerirBD(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'Base de datos no configurada (DATABASE_URL)' });
  next();
}

function validar(body, parcial = false) {
  const errores = [];
  const datos = {};
  if (!parcial || body.titulo !== undefined) {
    const titulo = String(body.titulo ?? '').trim();
    if (!titulo || titulo.length > 150) errores.push('titulo es obligatorio (máximo 150 caracteres)');
    datos.titulo = titulo;
  }
  if (body.descripcion !== undefined) datos.descripcion = String(body.descripcion).trim() || null;
  if (body.estado !== undefined) {
    if (!ESTADOS.includes(body.estado)) errores.push(`estado debe ser uno de: ${ESTADOS.join(', ')}`);
    datos.estado = body.estado;
  }
  return { errores, datos };
}

app.get('/health', async (req, res) => {
  if (!pool) return res.status(503).json({ status: 'error', db: 'no configurada' });
  try {
    const r = await pool.query('SELECT version()');
    res.json({ status: 'ok', db: 'conectada', postgres: r.rows[0].version.split(' ').slice(0, 2).join(' ') });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'sin conexión' });
  }
});

app.get('/api/tareas', requerirBD, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tareas ORDER BY id DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

app.get('/api/tareas/:id', requerirBD, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tareas WHERE id = $1', [Number(req.params.id) || 0]);
    if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.post('/api/tareas', requerirBD, async (req, res, next) => {
  try {
    const { errores, datos } = validar(req.body || {});
    if (errores.length) return res.status(400).json({ errores });
    const { rows } = await pool.query(
      'INSERT INTO tareas (titulo, descripcion, estado) VALUES ($1, $2, COALESCE($3, \'pendiente\')) RETURNING *',
      [datos.titulo, datos.descripcion ?? null, datos.estado ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

app.put('/api/tareas/:id', requerirBD, async (req, res, next) => {
  try {
    const { errores, datos } = validar(req.body || {}, true);
    if (errores.length) return res.status(400).json({ errores });
    const { rows } = await pool.query(
      `UPDATE tareas SET
         titulo = COALESCE($1, titulo),
         descripcion = CASE WHEN $2::boolean THEN $3 ELSE descripcion END,
         estado = COALESCE($4, estado)
       WHERE id = $5 RETURNING *`,
      [datos.titulo ?? null, datos.descripcion !== undefined, datos.descripcion ?? null, datos.estado ?? null, Number(req.params.id) || 0]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.delete('/api/tareas/:id', requerirBD, async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM tareas WHERE id = $1', [Number(req.params.id) || 0]);
    if (!r.rowCount) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.status(204).end();
  } catch (err) { next(err); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en el puerto ${PORT}`);
  iniciarBD();
});
