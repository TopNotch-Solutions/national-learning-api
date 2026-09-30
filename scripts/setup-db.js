require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { ensureStaffColumns } = require('../src/config/ensureStaffColumns');
const { ensureExploreTables } = require('../src/config/ensureExploreTables');

const DEMO_PASSWORD = 'Password123!';

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      first_name VARCHAR(80) NOT NULL DEFAULT '',
      last_name VARCHAR(80) NOT NULL DEFAULT '',
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
      grade VARCHAR(40) NULL,
      subject VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      token VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      description TEXT,
      body TEXT NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_contents_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      description TEXT,
      questions_json JSON NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_quizzes_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS past_papers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      year INT NOT NULL,
      description TEXT,
      file_url VARCHAR(500),
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_past_papers_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      year INT NOT NULL,
      description TEXT,
      file_url VARCHAR(500),
      past_paper_id INT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_memos_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_memos_past_paper
        FOREIGN KEY (past_paper_id) REFERENCES past_papers(id) ON DELETE SET NULL
    )
  `);

  await ensureStaffColumns();
  await ensureExploreTables();
  console.log('Explore tables ready');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    {
      name: 'Portal Admin',
      first_name: 'Portal',
      last_name: 'Admin',
      email: 'admin@edu.na',
      role: 'admin',
      grade: null,
      subject: null,
    },
    {
      name: 'Demo Teacher',
      first_name: 'Demo',
      last_name: 'Teacher',
      email: 'teacher@edu.na',
      role: 'teacher',
      grade: 'Grade 10',
      subject: 'Mathematics',
    },
  ];

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (name, first_name, last_name, email, password_hash, role, grade, subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         first_name = VALUES(first_name),
         last_name = VALUES(last_name),
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         grade = VALUES(grade),
         subject = VALUES(subject)`,
      [
        user.name,
        user.first_name,
        user.last_name,
        user.email,
        passwordHash,
        user.role,
        user.grade,
        user.subject,
      ]
    );
    console.log(`Added ${user.role}: ${user.email} / ${DEMO_PASSWORD}`);
  }

  await pool.end();
}

setup().catch(async (error) => {
  console.error('Setup failed:', error.message);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
