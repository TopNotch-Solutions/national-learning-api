require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const DEMO_PASSWORD = 'Password123!';

const users = [
  {
    name: 'Portal Admin',
    email: 'admin@edu.na',
    role: 'admin',
  },
  {
    name: 'Demo Teacher',
    email: 'teacher@edu.na',
    role: 'teacher',
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         role = VALUES(role)`,
      [user.name, user.email, passwordHash, user.role]
    );
    console.log(`Seeded ${user.role}: ${user.email} / ${DEMO_PASSWORD}`);
  }

  await pool.end();
}

seed().catch(async (error) => {
  console.error('Failed to seed demo users:', error.message);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
