import bcrypt from 'bcryptjs';
import { Admin } from './models/Admin.js';

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function seedFirstAdmin() {
  const count = await Admin.countDocuments();
  if (count > 0) {
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME?.trim() || '';

  if (!email || !password || !name) {
    console.warn(
      'No admins yet. Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME to seed the first facilitator.'
    );
    return;
  }

  if (!isEmail(email)) {
    console.warn('ADMIN_EMAIL must be a valid email address.');
    return;
  }

  if (name.length < 2) {
    console.warn('ADMIN_NAME is required (at least 2 characters).');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ email, name, passwordHash, role: 'admin' });
  console.log(`Seeded first admin: ${name} <${email}>`);
}
