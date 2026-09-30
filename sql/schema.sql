CREATE DATABASE IF NOT EXISTS edu_learning;
USE edu_learning;

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
);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

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
);

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
);

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
);

-- Demo password for all seed users: Password123!
INSERT INTO users (name, first_name, last_name, email, password_hash, role, grade, subject) VALUES
  ('Demo Student', 'Demo', 'Student', 'student@edu.na', '$2b$10$ZAYlH6NImMh0Uswq2hwPBO96H9OBgwVoGDDGeF7J1.OBxx1YPnZBm', 'student', NULL, NULL),
  ('Demo Teacher', 'Demo', 'Teacher', 'teacher@edu.na', '$2b$10$ZAYlH6NImMh0Uswq2hwPBO96H9OBgwVoGDDGeF7J1.OBxx1YPnZBm', 'teacher', 'Grade 10', 'Mathematics'),
  ('Portal Admin', 'Portal', 'Admin', 'admin@edu.na', '$2b$10$ZAYlH6NImMh0Uswq2hwPBO96H9OBgwVoGDDGeF7J1.OBxx1YPnZBm', 'admin', NULL, NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  grade = VALUES(grade),
  subject = VALUES(subject);

CREATE TABLE IF NOT EXISTS explore_entries (
  id VARCHAR(80) PRIMARY KEY,
  region_id VARCHAR(40) NOT NULL,
  category VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  short_description TEXT,
  full_description MEDIUMTEXT,
  featured_image JSON,
  gallery JSON,
  location JSON,
  tags JSON,
  rating_score DECIMAL(2,1) NULL,
  category_data JSON,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_explore_region_category (region_id, category),
  INDEX idx_explore_status (status),
  CONSTRAINT fk_explore_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS explore_sync_meta (
  id TINYINT PRIMARY KEY DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO explore_sync_meta (id, version) VALUES (1, 1)
ON DUPLICATE KEY UPDATE id = id;
