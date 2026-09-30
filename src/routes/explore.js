const express = require('express');
const { pool } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const {
  NAMIBIA_REGIONS,
  EXPLORE_CATEGORIES,
  CATEGORY_IDS,
  REGION_IDS,
} = require('../config/exploreConstants');
const { bumpExploreSyncVersion } = require('../config/ensureExploreTables');

const router = express.Router();

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapEntryRow(row) {
  return {
    id: row.id,
    region_id: row.region_id,
    category: row.category,
    title: row.title,
    short_description: row.short_description || '',
    full_description: row.full_description || '',
    featured_image: parseJsonField(row.featured_image, null),
    gallery: parseJsonField(row.gallery, []),
    location: parseJsonField(row.location, null),
    tags: parseJsonField(row.tags, []),
    rating_score: row.rating_score != null ? Number(row.rating_score) : null,
    category_data: parseJsonField(row.category_data, {}),
    status: row.status,
    sort_order: Number(row.sort_order) || 0,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRelativeUploadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith('/uploads/')) return parsed.pathname;
  } catch {
    // ignore
  }
  return raw;
}

function normalizeFeaturedImage(input) {
  if (!input || typeof input !== 'object') return null;
  const url = toRelativeUploadUrl(input.url);
  if (!url) return null;
  return {
    url,
    alt: String(input.alt || '').trim(),
    caption: String(input.caption || '').trim(),
    credit: String(input.credit || '').trim(),
  };
}

function normalizeGallery(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const url = toRelativeUploadUrl(item.url);
      if (!url) return null;
      return {
        url,
        type: item.type === 'video' ? 'video' : 'photo',
        alt: String(item.alt || '').trim(),
        caption: String(item.caption || '').trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 5); // featured + up to 5 gallery = 6 total images
}

function normalizeLocation(input) {
  if (!input || typeof input !== 'object') return null;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    address: String(input.address || '').trim(),
    map_marker: String(input.map_marker || '').trim(),
    google_place_id: String(input.google_place_id || '').trim(),
  };
}

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return input.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[,#\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  const next = {};

  if (!partial || body.id !== undefined) {
    const id = String(body.id || '').trim();
    if (!/^[a-z0-9_]{3,80}$/i.test(id)) {
      errors.push('id must be 3–80 alphanumeric characters or underscores');
    } else {
      next.id = id.toLowerCase();
    }
  }

  if (!partial || body.region_id !== undefined) {
    const regionId = String(body.region_id || '').trim();
    if (!REGION_IDS.has(regionId)) {
      errors.push('region_id must be a valid Namibia region');
    } else {
      next.region_id = regionId;
    }
  }

  if (!partial || body.category !== undefined) {
    const category = String(body.category || '').trim();
    if (!CATEGORY_IDS.has(category)) {
      errors.push('category is invalid');
    } else {
      next.category = category;
    }
  }

  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) errors.push('title is required');
    else next.title = title.slice(0, 200);
  }

  if (!partial || body.short_description !== undefined) {
    next.short_description = String(body.short_description || '').trim();
  }

  if (!partial || body.full_description !== undefined) {
    next.full_description = String(body.full_description || '').trim();
  }

  if (!partial || body.featured_image !== undefined) {
    next.featured_image = normalizeFeaturedImage(body.featured_image);
  }

  if (!partial || body.gallery !== undefined) {
    next.gallery = normalizeGallery(body.gallery);
  }

  if (!partial || body.location !== undefined) {
    next.location = normalizeLocation(body.location);
    if (!next.location) errors.push('location with valid latitude and longitude is required');
  }

  if (!partial || body.tags !== undefined) {
    next.tags = normalizeTags(body.tags);
  }

  if (!partial || body.rating_score !== undefined) {
    if (body.rating_score === null || body.rating_score === '' || body.rating_score === undefined) {
      next.rating_score = null;
    } else {
      const score = Number(body.rating_score);
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        errors.push('rating_score must be between 1 and 5');
      } else {
        next.rating_score = Math.round(score * 10) / 10;
      }
    }
  }

  if (!partial || body.status !== undefined) {
    const status = String(body.status || 'draft');
    if (!['draft', 'published'].includes(status)) {
      errors.push('status must be draft or published');
    } else {
      next.status = status;
    }
  }

  if (!partial || body.sort_order !== undefined) {
    next.sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
  }

  // Same simplified model for every category — no category-specific fields.
  if (!partial || body.category_data !== undefined || body.category !== undefined) {
    next.category_data = {};
  }

  return { errors, next };
}

// --- Public catalogue (app sync) ---

router.get('/taxonomy', (_req, res) => {
  res.json({
    regions: NAMIBIA_REGIONS,
    categories: EXPLORE_CATEGORIES,
  });
});

router.get('/meta', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT version, updated_at FROM explore_sync_meta WHERE id = 1 LIMIT 1`
    );
    res.json({
      version: Number(rows[0]?.version) || 1,
      updated_at: rows[0]?.updated_at || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch explore meta', error: error.message });
  }
});

router.get('/entries', async (req, res) => {
  try {
    const params = [];
    const where = [`status = 'published'`];

    if (req.query.region_id) {
      where.push('region_id = ?');
      params.push(String(req.query.region_id));
    }
    if (req.query.category) {
      where.push('category = ?');
      params.push(String(req.query.category));
    }

    const [rows] = await pool.query(
      `SELECT *
       FROM explore_entries
       WHERE ${where.join(' AND ')}
       ORDER BY sort_order ASC, title ASC`,
      params
    );

    const [metaRows] = await pool.query(
      `SELECT version, updated_at FROM explore_sync_meta WHERE id = 1 LIMIT 1`
    );

    res.json({
      version: Number(metaRows[0]?.version) || 1,
      updated_at: metaRows[0]?.updated_at || null,
      entries: rows.map(mapEntryRow),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch explore entries', error: error.message });
  }
});

router.get('/entries/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM explore_entries WHERE id = ? AND status = 'published' LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Explore entry not found' });
    }
    res.json(mapEntryRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch explore entry', error: error.message });
  }
});

// --- Admin management ---

router.get('/admin/entries', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const params = [];
    const where = ['1=1'];

    if (req.query.region_id) {
      where.push('region_id = ?');
      params.push(String(req.query.region_id));
    }
    if (req.query.category) {
      where.push('category = ?');
      params.push(String(req.query.category));
    }
    if (req.query.status === 'draft' || req.query.status === 'published') {
      where.push('status = ?');
      params.push(req.query.status);
    }

    const [rows] = await pool.query(
      `SELECT *
       FROM explore_entries
       WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC, title ASC`,
      params
    );
    res.json(rows.map(mapEntryRow));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch admin explore entries', error: error.message });
  }
});

router.get('/admin/entries/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM explore_entries WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Explore entry not found' });
    }
    res.json(mapEntryRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch explore entry', error: error.message });
  }
});

router.post('/admin/entries', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { errors, next } = validatePayload(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const [existing] = await pool.query(`SELECT id FROM explore_entries WHERE id = ? LIMIT 1`, [
      next.id,
    ]);
    if (existing[0]) {
      return res.status(409).json({ message: 'An entry with this id already exists' });
    }

    await pool.query(
      `INSERT INTO explore_entries (
        id, region_id, category, title, short_description, full_description,
        featured_image, gallery, location, tags, rating_score, category_data,
        status, sort_order, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        next.id,
        next.region_id,
        next.category,
        next.title,
        next.short_description,
        next.full_description,
        JSON.stringify(next.featured_image),
        JSON.stringify(next.gallery),
        JSON.stringify(next.location),
        JSON.stringify(next.tags),
        next.rating_score,
        JSON.stringify(next.category_data),
        next.status,
        next.sort_order,
        req.user.id,
      ]
    );

    if (next.status === 'published') {
      await bumpExploreSyncVersion();
    }

    const [rows] = await pool.query(`SELECT * FROM explore_entries WHERE id = ? LIMIT 1`, [next.id]);
    res.status(201).json(mapEntryRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: 'Failed to create explore entry', error: error.message });
  }
});

router.put('/admin/entries/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM explore_entries WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Explore entry not found' });
    }

    const current = mapEntryRow(rows[0]);
    const { errors, next } = validatePayload(
      {
        ...current,
        ...req.body,
        id: current.id,
        category_data: req.body.category_data ?? current.category_data,
        featured_image: req.body.featured_image ?? current.featured_image,
        gallery: req.body.gallery ?? current.gallery,
        location: req.body.location ?? current.location,
        tags: req.body.tags ?? current.tags,
      },
      { partial: false }
    );

    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    await pool.query(
      `UPDATE explore_entries SET
        region_id = ?, category = ?, title = ?, short_description = ?, full_description = ?,
        featured_image = ?, gallery = ?, location = ?, tags = ?, rating_score = ?,
        category_data = ?, status = ?, sort_order = ?
       WHERE id = ?`,
      [
        next.region_id,
        next.category,
        next.title,
        next.short_description,
        next.full_description,
        JSON.stringify(next.featured_image),
        JSON.stringify(next.gallery),
        JSON.stringify(next.location),
        JSON.stringify(next.tags),
        next.rating_score,
        JSON.stringify(next.category_data),
        next.status,
        next.sort_order,
        current.id,
      ]
    );

    if (current.status === 'published' || next.status === 'published') {
      await bumpExploreSyncVersion();
    }

    const [updated] = await pool.query(`SELECT * FROM explore_entries WHERE id = ? LIMIT 1`, [
      current.id,
    ]);
    res.json(mapEntryRow(updated[0]));
  } catch (error) {
    res.status(500).json({ message: 'Failed to update explore entry', error: error.message });
  }
});

router.delete('/admin/entries/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, status FROM explore_entries WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Explore entry not found' });
    }

    await pool.query(`DELETE FROM explore_entries WHERE id = ?`, [req.params.id]);
    if (rows[0].status === 'published') {
      await bumpExploreSyncVersion();
    }
    res.json({ message: 'Explore entry deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete explore entry', error: error.message });
  }
});

router.post(
  '/admin/upload-image',
  requireAuth,
  requireRole('admin'),
  uploadImage.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'An image file is required' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.status(201).json({ url: fileUrl, filename: req.file.filename });
    } catch (error) {
      res.status(500).json({ message: 'Failed to upload image', error: error.message });
    }
  }
);

module.exports = router;
