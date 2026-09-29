require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const { ensureStaffColumns } = require('./config/ensureStaffColumns');
const { uploadsRoot } = require('./middleware/upload');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: 'https://national-portal.kopanovertex.com' || 'http://localhost:5173',
  })
);
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

app.get('/', (_req, res) => {
  res.json({
    message: 'Edu Learning Namibia API',
    docs: '/api/health',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof Error && /PDF or Word/i.test(err.message)) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

async function start() {
  try {
    await testConnection();
    await ensureStaffColumns();
  } catch (error) {
    console.warn('MySQL not ready yet:', error.message);
    console.warn('Server will start anyway — check DB credentials in .env');
  }

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();
