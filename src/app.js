require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pagosRoutes = require('./routes/pagos.routes');
const { db } = require('./db/database');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) =>
  res.status(200).json({ status: 'ok', fecha: new Date().toISOString() })
);

app.use('/api/pagos', pagosRoutes);

// 404 para rutas no definidas
app.use((req, res) =>
  res.status(404).json({ error: 'Recurso no encontrado', ruta: req.originalUrl })
);

// Manejo central de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ error: err.message || 'Error interno del servidor', status });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
  console.log(`[SERVER] API escuchando en http://localhost:${PORT}`)
);

// Cierre ordenado (Ctrl+C)
const shutdown = (signal) => {
  console.log(`\n[SERVER] Recibido ${signal}. Cerrando...`);
  server.close(() => {
    db.close((err) => {
      if (err) console.error('[DB] Error al cerrar:', err.message);
      else console.log('[DB] Conexión cerrada correctamente.');
      process.exit(0);
    });
  });
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;