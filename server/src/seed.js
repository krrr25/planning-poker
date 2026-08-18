import bcrypt from 'bcryptjs';
import { Admin } from './models/Admin.js';

export async function seedFirstAdmin() {
  const count = await Admin.countDocuments();
  if (count > 0) {
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Facilitator';

  if (!email || !password) {
    console.warn('No admins yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first facilitator.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ email, name, passwordHash, role: 'admin' });
  console.log(`Seeded first admin: ${email}`);
}
