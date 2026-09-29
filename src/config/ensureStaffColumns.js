const { pool } = require('./db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.count) > 0;
}

async function ensureStaffColumns() {
  const columns = [
    { name: 'first_name', ddl: "ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER name" },
    { name: 'last_name', ddl: "ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT '' AFTER first_name" },
    { name: 'grade', ddl: 'ADD COLUMN grade VARCHAR(40) NULL AFTER role' },
    { name: 'subject', ddl: 'ADD COLUMN subject VARCHAR(120) NULL AFTER grade' },
  ];

  for (const column of columns) {
    if (!(await columnExists('users', column.name))) {
      await pool.query(`ALTER TABLE users ${column.ddl}`);
    }
  }

  await pool.query(`
    UPDATE users
    SET
      first_name = CASE
        WHEN first_name = '' OR first_name IS NULL THEN TRIM(SUBSTRING_INDEX(name, ' ', 1))
        ELSE first_name
      END,
      last_name = CASE
        WHEN last_name = '' OR last_name IS NULL THEN TRIM(SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 2))
        ELSE last_name
      END
    WHERE name IS NOT NULL AND name <> ''
  `);
}

module.exports = { ensureStaffColumns };
