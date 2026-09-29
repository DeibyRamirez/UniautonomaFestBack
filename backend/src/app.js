const express = require('express');
const cors = require('cors');
const path = require('path');

const { precalentarFirebase } = require('./config/firebase');
const checkoutRoutes = require('./routes/checkout.routes');
const pagosRoutes = require('./routes/pagos.routes');
const adminRoutes = require('./routes/admin.routes');
const configRoutes = require('./routes/config.routes');
const eventosRoutes = require('./routes/eventos.routes');

const app = express();

// Vercel antepone un proxy; sin esto el rate limit ve la IP del proxy y no la del cliente.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'uniautonoma-fest-api' });
});

app.get('/api/checkout/warmup', async (req, res) => {
  try {
    const db = precalentarFirebase();
    if (!db) {
      const err = new Error('Firebase no configurado');
      err.codigo = 503;
      throw err;
    }

    await db.collection('payments').limit(1).get();

    return res.json({ ok: true, warmed: true });
  } catch (error) {
    const codigo = error.codigo || 503;
    return res.status(codigo).json({
      ok: false,
      mensaje: error.message || 'No se pudo precalentar el checkout',
    });
  }
});

app.get('/api/eventos/warmup', async (req, res) => {
  try {
    const db = precalentarFirebase();
    if (!db) {
      const err = new Error('Firebase no configurado');
      err.codigo = 503;
      throw err;
    }

    await db.collection('eventos').doc('uaf2026').collection('Hackton').limit(1).get();
    return res.json({ ok: true, warmed: true });
  } catch (error) {
    const codigo = error.codigo || 503;
    return res.status(codigo).json({
      ok: false,
      mensaje: error.message || 'No se pudo precalentar el registro de eventos',
    });
  }
});

app.get('/api/admin/warmup', async (req, res) => {
  try {
    const db = precalentarFirebase();
    if (!db) {
      const err = new Error('Firebase no configurado');
      err.codigo = 503;
      throw err;
    }

    await db.collection('payments').limit(1).get();
    return res.json({ ok: true, warmed: true });
  } catch (error) {
    const codigo = error.codigo || 503;
    return res.status(codigo).json({
      ok: false,
      mensaje: error.message || 'No se pudo precalentar el panel admin',
    });
  }
});

app.use('/api/checkout', checkoutRoutes);
app.use('/api/payments', pagosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/eventos', eventosRoutes);

const raizProyecto = path.join(__dirname, '../..');

if (process.env.NODE_ENV !== 'production' || process.env.SERVIR_ESTATICOS === 'true') {
  app.use(express.static(raizProyecto));
  app.use('/admin', express.static(path.join(raizProyecto, 'admin')));
  app.use('/checkout', express.static(path.join(raizProyecto, 'checkout')));
  app.use('/eventos', express.static(path.join(raizProyecto, 'eventos')));
}

app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

module.exports = app;
