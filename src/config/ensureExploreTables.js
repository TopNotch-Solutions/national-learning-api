const { pool } = require('./db');

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.count) > 0;
}

async function ensureExploreTables() {
  if (!(await tableExists('explore_entries'))) {
    await pool.query(`
      CREATE TABLE explore_entries (
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
      )
    `);
  }

  if (!(await tableExists('explore_sync_meta'))) {
    await pool.query(`
      CREATE TABLE explore_sync_meta (
        id TINYINT PRIMARY KEY DEFAULT 1,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      `INSERT INTO explore_sync_meta (id, version) VALUES (1, 1)
       ON DUPLICATE KEY UPDATE id = id`
    );
  }
}

async function bumpExploreSyncVersion(connection = pool) {
  await connection.query(
    `INSERT INTO explore_sync_meta (id, version) VALUES (1, 1)
     ON DUPLICATE KEY UPDATE version = version + 1, updated_at = CURRENT_TIMESTAMP`
  );
}

module.exports = { ensureExploreTables, bumpExploreSyncVersion };
