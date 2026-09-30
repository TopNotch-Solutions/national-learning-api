require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const { ensureStaffColumns } = require('./config/ensureStaffColumns');
const { ensureExploreTables } = require('./config/ensureExploreTables');
const { uploadsRoot } = require('./middleware/upload');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const exploreRoutes = require('./routes/explore');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'https://national-portal.kopanovertex.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Native mobile apps and same-origin tools often send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, true);
    },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsRoot));

app.get('/', (_req, res) => {
  res.json({
    message: 'Edu Learning Namibia API',
    docs: '/api/health',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api', apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof Error && /PDF or Word|JPEG, PNG, WebP, or GIF/i.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  try {
    await testConnection();
    await ensureStaffColumns();
    await ensureExploreTables();
  } catch (error) {
    console.warn('MySQL not ready yet:', error.message);
    console.warn('Server will start anyway — check DB credentials in .env');
  }

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();
