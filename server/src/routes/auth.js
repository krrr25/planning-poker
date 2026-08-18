import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { clearAdminCookie, readAdmin, setAdminCookie, signAdmin } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  setAdminCookie(res, signAdmin(admin));
  res.json({ email: admin.email, name: admin.name, role: admin.role });
});

authRouter.post('/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const admin = readAdmin(req);
  if (!admin) {
    res.status(401).json({ message: 'Not signed in' });
    return;
  }
  res.json({ email: admin.email, name: admin.name, role: admin.role });
});
