const { pool } = require('../config/db');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.grade, u.subject, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?
       LIMIT 1`,
      [token]
    );

    const session = rows[0];
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
      return res.status(401).json({ message: 'Session expired' });
    }

    req.user = {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
      grade: session.grade || null,
      subject: session.subject || null,
    };
    req.token = token;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Auth check failed', error: error.message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
