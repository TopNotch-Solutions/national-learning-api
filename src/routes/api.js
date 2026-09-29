const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'edu-learning-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'edu-learning-backend',
      database: 'disconnected',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// --- Admin: manage admins & teachers ---

function fullName(firstName, lastName) {
  return `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
}

function mapStaffRow(row) {
  return {
    id: row.id,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    name: row.name || fullName(row.first_name, row.last_name),
    email: row.email,
    role: row.role,
    grade: row.grade || null,
    subject: row.subject || null,
    created_at: row.created_at,
  };
}

router.get('/admin/staff', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const role = req.query.role;
    const params = [];
    let where = `role IN ('admin', 'teacher')`;

    if (role === 'admin' || role === 'teacher') {
      where = 'role = ?';
      params.push(role);
    }

    const [rows] = await pool.query(
      `SELECT id, name, first_name, last_name, email, role, grade, subject, created_at
       FROM users
       WHERE ${where}
       ORDER BY last_name ASC, first_name ASC`,
      params
    );
    res.json(rows.map(mapStaffRow));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch staff', error: error.message });
  }
});

router.get('/admin/staff/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, first_name, last_name, email, role, grade, subject, created_at
       FROM users
       WHERE id = ? AND role IN ('admin', 'teacher')
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    res.json(mapStaffRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch staff member', error: error.message });
  }
});

router.post('/admin/staff', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      role,
      grade = null,
      subject = null,
    } = req.body;

    if (!first_name || !last_name || !email || !password || !role) {
      return res.status(400).json({
        message: 'first_name, last_name, email, password, and role are required',
      });
    }

    if (!['admin', 'teacher'].includes(role)) {
      return res.status(400).json({ message: 'role must be admin or teacher' });
    }

    if (role === 'teacher' && (!grade || !subject)) {
      return res.status(400).json({ message: 'grade and subject are required for teachers' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const name = fullName(first_name, last_name);
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, first_name, last_name, email, password_hash, role, grade, subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        String(first_name).trim(),
        String(last_name).trim(),
        email,
        passwordHash,
        role,
        role === 'teacher' ? grade : null,
        role === 'teacher' ? subject : null,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      name,
      email,
      role,
      grade: role === 'teacher' ? grade : null,
      subject: role === 'teacher' ? subject : null,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Failed to create staff user', error: error.message });
  }
});

router.put('/admin/staff/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const {
      first_name,
      last_name,
      email,
      password,
      role,
      grade = null,
      subject = null,
    } = req.body;

    const [existingRows] = await pool.query(
      `SELECT id, role FROM users WHERE id = ? AND role IN ('admin', 'teacher') LIMIT 1`,
      [staffId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    if (!first_name || !last_name || !email || !role) {
      return res.status(400).json({
        message: 'first_name, last_name, email, and role are required',
      });
    }

    if (!['admin', 'teacher'].includes(role)) {
      return res.status(400).json({ message: 'role must be admin or teacher' });
    }

    if (role === 'teacher' && (!grade || !subject)) {
      return res.status(400).json({ message: 'grade and subject are required for teachers' });
    }

    if (password && String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const name = fullName(first_name, last_name);
    const nextGrade = role === 'teacher' ? grade : null;
    const nextSubject = role === 'teacher' ? subject : null;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users
         SET name = ?, first_name = ?, last_name = ?, email = ?, password_hash = ?,
             role = ?, grade = ?, subject = ?
         WHERE id = ?`,
        [
          name,
          String(first_name).trim(),
          String(last_name).trim(),
          email,
          passwordHash,
          role,
          nextGrade,
          nextSubject,
          staffId,
        ]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET name = ?, first_name = ?, last_name = ?, email = ?, role = ?, grade = ?, subject = ?
         WHERE id = ?`,
        [
          name,
          String(first_name).trim(),
          String(last_name).trim(),
          email,
          role,
          nextGrade,
          nextSubject,
          staffId,
        ]
      );
    }

    res.json({
      id: staffId,
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      name,
      email,
      role,
      grade: nextGrade,
      subject: nextSubject,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Failed to update staff user', error: error.message });
  }
});

router.delete('/admin/staff/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const staffId = Number(req.params.id);

    if (staffId === Number(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const [result] = await pool.query(
      `DELETE FROM users WHERE id = ? AND role IN ('admin', 'teacher')`,
      [staffId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    res.json({ message: 'Staff member deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete staff user', error: error.message });
  }
});

// --- Teacher: learning materials ---

router.get('/teacher/contents', requireAuth, requireRole('teacher', 'admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.subject, c.description, c.created_at, u.name AS author
       FROM contents c
       JOIN users u ON u.id = c.created_by
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch content', error: error.message });
  }
});

router.post('/teacher/contents', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { title, description = '', body } = req.body;
    const subject = req.user.subject;

    if (!subject) {
      return res.status(400).json({
        message: 'Your teacher profile has no registered subject. Ask an admin to set it.',
      });
    }

    if (!title || !body) {
      return res.status(400).json({ message: 'title and body are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO contents (title, subject, description, body, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, subject, description, body, req.user.id]
    );

    res.status(201).json({
      id: result.insertId,
      title,
      subject,
      description,
      body,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create content', error: error.message });
  }
});

router.get('/teacher/quizzes', requireAuth, requireRole('teacher', 'admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT q.id, q.title, q.subject, q.description, q.questions_json, q.created_at,
              q.created_by, u.name AS author
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       ORDER BY q.created_at DESC`
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        description: row.description,
        questions: normalizeQuestions(row.questions_json),
        question_count: normalizeQuestions(row.questions_json).length,
        created_at: row.created_at,
        created_by: row.created_by,
        author: row.author,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch quizzes', error: error.message });
  }
});

router.get('/teacher/quizzes/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT q.id, q.title, q.subject, q.description, q.questions_json, q.created_at,
              q.created_by, u.name AS author
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       WHERE q.id = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const row = rows[0];
    res.json({
      id: row.id,
      title: row.title,
      subject: row.subject,
      description: row.description,
      questions: normalizeQuestions(row.questions_json),
      created_at: row.created_at,
      created_by: row.created_by,
      author: row.author,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch quiz', error: error.message });
  }
});

router.post('/teacher/quizzes', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const { title, description = '', questions } = req.body;
    const subject = req.user.subject;

    if (!subject) {
      return res.status(400).json({
        message: 'Your teacher profile has no registered subject. Ask an admin to set it.',
      });
    }

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'title and at least one question are required',
      });
    }

    const cleaned = sanitizeQuestions(questions);
    if (cleaned.error) {
      return res.status(400).json({ message: cleaned.error });
    }

    const [result] = await pool.query(
      `INSERT INTO quizzes (title, subject, description, questions_json, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, subject, description, JSON.stringify(cleaned.questions), req.user.id]
    );

    res.status(201).json({
      id: result.insertId,
      title,
      subject,
      description,
      questions: cleaned.questions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create quiz', error: error.message });
  }
});

router.put('/teacher/quizzes/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const { title, description = '', questions } = req.body;

    const [existingRows] = await pool.query(
      `SELECT q.id, q.created_by, u.subject AS teacher_subject
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       WHERE q.id = ?
       LIMIT 1`,
      [quizId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (req.user.role !== 'admin' && Number(existing.created_by) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only update your own quizzes' });
    }

    const subject =
      req.user.role === 'admin'
        ? existing.teacher_subject || req.user.subject
        : req.user.subject;

    if (!subject) {
      return res.status(400).json({
        message: 'Teacher profile has no registered subject. Ask an admin to set it.',
      });
    }

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'title and at least one question are required',
      });
    }

    const cleaned = sanitizeQuestions(questions);
    if (cleaned.error) {
      return res.status(400).json({ message: cleaned.error });
    }

    await pool.query(
      `UPDATE quizzes
       SET title = ?, subject = ?, description = ?, questions_json = ?
       WHERE id = ?`,
      [title, subject, description, JSON.stringify(cleaned.questions), quizId]
    );

    res.json({
      id: quizId,
      title,
      subject,
      description,
      questions: cleaned.questions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update quiz', error: error.message });
  }
});

router.delete('/teacher/quizzes/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const [existingRows] = await pool.query(
      `SELECT id, created_by FROM quizzes WHERE id = ? LIMIT 1`,
      [quizId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (req.user.role !== 'admin' && Number(existing.created_by) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only delete your own quizzes' });
    }

    await pool.query(`DELETE FROM quizzes WHERE id = ?`, [quizId]);
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete quiz', error: error.message });
  }
});

function normalizeQuestions(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map((question) => {
    const type = ['true_false', 'single', 'multiple'].includes(question?.type)
      ? question.type
      : 'single';
    const options = Array.isArray(question?.options)
      ? question.options.map((option) => String(option))
      : type === 'true_false'
        ? ['True', 'False']
        : [];
    let answers = [];
    if (Array.isArray(question?.answers)) {
      answers = question.answers.map((answer) => String(answer));
    } else if (question?.answer != null) {
      answers = [String(question.answer)];
    }
    return {
      type,
      prompt: String(question?.prompt || ''),
      options,
      answers,
    };
  });
}

function sanitizeQuestions(questions) {
  const cleaned = [];

  for (const [index, question] of questions.entries()) {
    const type = question?.type;
    if (!['true_false', 'single', 'multiple'].includes(type)) {
      return { error: `Question ${index + 1}: type must be true_false, single, or multiple` };
    }

    const prompt = String(question?.prompt || '').trim();
    if (!prompt) {
      return { error: `Question ${index + 1}: prompt is required` };
    }

    let options = Array.isArray(question?.options)
      ? question.options.map((option) => String(option || '').trim()).filter(Boolean)
      : [];

    if (type === 'true_false') {
      options = ['True', 'False'];
    }

    if (options.length < 2) {
      return { error: `Question ${index + 1}: at least 2 options are required` };
    }

    let answers = Array.isArray(question?.answers)
      ? question.answers.map((answer) => String(answer || '').trim()).filter(Boolean)
      : question?.answer != null
        ? [String(question.answer).trim()].filter(Boolean)
        : [];

    answers = [...new Set(answers)];

    if (type === 'true_false' || type === 'single') {
      if (answers.length !== 1) {
        return { error: `Question ${index + 1}: exactly one correct answer is required` };
      }
    } else if (answers.length < 1) {
      return { error: `Question ${index + 1}: select at least one correct answer` };
    }

    if (answers.some((answer) => !options.includes(answer))) {
      return { error: `Question ${index + 1}: answers must match the options` };
    }

    cleaned.push({ type, prompt, options, answers });
  }

  return { questions: cleaned };
}

router.get('/teacher/past-papers', requireAuth, requireRole('teacher', 'admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.title, p.subject, p.year, p.description, p.file_url, p.created_at, u.name AS author
       FROM past_papers p
       JOIN users u ON u.id = p.created_by
       ORDER BY p.year DESC, p.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch past papers', error: error.message });
  }
});

router.post(
  '/teacher/past-papers',
  requireAuth,
  requireRole('teacher'),
  upload.single('file'),
  async (req, res) => {
    try {
      const title = String(req.body.title || '').trim();
      const year = Number(req.body.year);
      const subject = req.user.subject;

      if (!subject) {
        return res.status(400).json({
          message: 'Your teacher profile has no registered subject. Ask an admin to set it.',
        });
      }

      if (!title || !year) {
        return res.status(400).json({ message: 'title and year are required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'A PDF or Word file is required' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;

      const [result] = await pool.query(
        `INSERT INTO past_papers (title, subject, year, description, file_url, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, subject, year, null, fileUrl, req.user.id]
      );

      res.status(201).json({
        id: result.insertId,
        title,
        subject,
        year,
        description: null,
        file_url: fileUrl,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create past paper', error: error.message });
    }
  }
);

router.get('/teacher/memos', requireAuth, requireRole('teacher', 'admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.title, m.subject, m.year, m.description, m.file_url, m.past_paper_id,
              m.created_at, u.name AS author, p.title AS past_paper_title
       FROM memos m
       JOIN users u ON u.id = m.created_by
       LEFT JOIN past_papers p ON p.id = m.past_paper_id
       ORDER BY m.year DESC, m.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memos', error: error.message });
  }
});

router.post(
  '/teacher/memos',
  requireAuth,
  requireRole('teacher'),
  upload.single('file'),
  async (req, res) => {
    try {
      const pastPaperId = Number(req.body.past_paper_id);
      const subject = req.user.subject;

      if (!subject) {
        return res.status(400).json({
          message: 'Your teacher profile has no registered subject. Ask an admin to set it.',
        });
      }

      if (!pastPaperId) {
        return res.status(400).json({ message: 'past_paper_id is required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'A PDF or Word file is required' });
      }

      const [paperRows] = await pool.query(
        `SELECT id, title, subject, year FROM past_papers WHERE id = ? LIMIT 1`,
        [pastPaperId]
      );
      const paper = paperRows[0];
      if (!paper) {
        return res.status(404).json({ message: 'Past paper not found' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const title = `Memo — ${paper.title}`;

      const [result] = await pool.query(
        `INSERT INTO memos (title, subject, year, description, file_url, past_paper_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, subject, Number(paper.year), null, fileUrl, pastPaperId, req.user.id]
      );

      res.status(201).json({
        id: result.insertId,
        title,
        subject,
        year: Number(paper.year),
        description: null,
        file_url: fileUrl,
        past_paper_id: pastPaperId,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create memo', error: error.message });
    }
  }
);

module.exports = router;
