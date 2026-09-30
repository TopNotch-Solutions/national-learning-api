/**
 * One-off: rewrite explore image URLs from http://localhost:... to /uploads/...
 * so the app and portal can resolve them against the current API host.
 */
require('dotenv').config();
const { pool } = require('../src/config/db');

function toRelative(url) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('/uploads/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith('/uploads/')) return parsed.pathname;
  } catch {
    // ignore
  }
  return raw;
}

function normalizeJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function run() {
  const [rows] = await pool.query(`SELECT id, featured_image, gallery FROM explore_entries`);
  let updated = 0;

  for (const row of rows) {
    const featured = normalizeJsonField(row.featured_image, null);
    const gallery = normalizeJsonField(row.gallery, []);
    let changed = false;

    if (featured?.url) {
      const next = toRelative(featured.url);
      if (next !== featured.url) {
        featured.url = next;
        changed = true;
      }
    }

    const nextGallery = (Array.isArray(gallery) ? gallery : []).map((item) => {
      if (!item?.url) return item;
      const next = toRelative(item.url);
      if (next !== item.url) changed = true;
      return { ...item, url: next };
    });

    if (!changed) continue;

    await pool.query(
      `UPDATE explore_entries SET featured_image = ?, gallery = ? WHERE id = ?`,
      [JSON.stringify(featured), JSON.stringify(nextGallery), row.id]
    );
    updated += 1;
    console.log(`Normalized media URLs for ${row.id}`);
  }

  console.log(`Done. Updated ${updated} entr${updated === 1 ? 'y' : 'ies'}.`);
  await pool.end();
}

run().catch(async (error) => {
  console.error(error.message);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
