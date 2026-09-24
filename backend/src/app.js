const express = require('express');
const cors = require('cors');
const path = require('path');

const checkoutRoutes = require('./routes/checkout.routes');
const pagosRoutes = require('./routes/pagos.routes');
const adminRoutes = require('./routes/admin.routes');
const configRoutes = require('./routes/config.routes');
const eventosRoutes = require('./routes/eventos.routes');

const app = express();

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
