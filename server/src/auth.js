import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const COOKIE = 'pp_admin';

export function signAdmin(admin) {
  return jwt.sign(
    { sub: String(admin._id), email: admin.email, name: admin.name, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function setAdminCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAdminCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function readAdmin(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res, next) {
  const admin = readAdmin(req);
  if (!admin) {
    res.status(401).json({ message: 'Admin sign-in required' });
    return;
  }
  req.admin = admin;
  next();
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}
