import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from '../src/db.js';
import { Admin } from '../src/models/Admin.js';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : '';
}

const email = arg('--email')?.trim().toLowerCase();
const password = arg('--password');
const name = arg('--name')?.trim() || email.split('@')[0];

if (!email || !password) {
  console.error('Usage: node scripts/add-admin.js --email ba@company.com --password "StrongPass!" --name "Anita"');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI missing in server/.env');
  process.exit(1);
}

await connectDb(process.env.MONGODB_URI);

const existing = await Admin.findOne({ email });
if (existing) {
  console.error(`Admin already exists: ${email}`);
  process.exit(1);
}

await Admin.create({
  email,
  name,
  passwordHash: await bcrypt.hash(password, 12),
  role: 'admin',
});

console.log(`Added admin ${name} <${email}>`);
process.exit(0);
