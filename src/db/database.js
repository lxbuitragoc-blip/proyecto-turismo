require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.DB_FILE || './data/app.db';
const dbPath = path.resolve(__dirname, '../../', DB_FILE);

// Crea la carpeta ./data si no existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Conexión única y centralizada
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error al conectar con SQLite:', err.message);
    process.exit(1);
  }
  console.log(`[DB] Conectado a SQLite en ${dbPath}`);
});

// Script controlado de inicialización
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON;');

  db.run(
    `CREATE TABLE IF NOT EXISTS pagos (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_tour       TEXT    NOT NULL,
      nombre_tour       TEXT    NOT NULL,
      ciudad            TEXT    NOT NULL,
      proveedor         TEXT    NOT NULL,
      concepto          TEXT    NOT NULL
                        CHECK (concepto IN ('alojamiento','traslado','alimentacion','guia','intermediario','otro')),
      fecha_servicio    TEXT    NOT NULL,
      fecha_pago        TEXT,
      costo             REAL    NOT NULL CHECK (costo > 0),
      venta             REAL    NOT NULL CHECK (venta >= costo),
      estrellas         INTEGER CHECK (estrellas IS NULL OR (estrellas BETWEEN 1 AND 5)),
      comision_vendedor REAL    NOT NULL DEFAULT 0 CHECK (comision_vendedor >= 0),
      estado            TEXT    NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','pagado','anulado')),
      creado_en         TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (codigo_tour, ciudad, proveedor, concepto, fecha_servicio)
    );`,
    (err) => {
      if (err) console.error('[DB] Error al crear tabla pagos:', err.message);
      else console.log('[DB] Tabla "pagos" lista.');
    }
  );

  // Índices para acelerar los reportes
  db.run('CREATE INDEX IF NOT EXISTS idx_pagos_ciudad ON pagos(ciudad);');
  db.run('CREATE INDEX IF NOT EXISTS idx_pagos_tour ON pagos(codigo_tour);');
  db.run('CREATE INDEX IF NOT EXISTS idx_pagos_proveedor ON pagos(ciudad, proveedor);');
});

// Helpers promisificados para usar async/await en repositorio
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

module.exports = { db, run, get, all };
