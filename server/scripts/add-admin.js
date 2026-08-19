import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from '../src/db.js';
import { Admin } from '../src/models/Admin.js';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const email = arg('--email')?.trim().toLowerCase();
const password = arg('--password');
const name = arg('--name')?.trim();
const shouldUpdate = process.argv.includes('--update');

if (!email || !password || !name) {
  console.error(
    'Usage: node scripts/add-admin.js --email ba@company.com --password "StrongPass!" --name "Anita"'
  );
  console.error('Email and name are required.');
  process.exit(1);
}

if (!isEmail(email)) {
  console.error('Enter a valid email address.');
  process.exit(1);
}

if (name.length < 2) {
  console.error('Name is required (at least 2 characters).');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI missing in server/.env');
  process.exit(1);
}

await connectDb(process.env.MONGODB_URI);

const existing = await Admin.findOne({ email });
const passwordHash = await bcrypt.hash(password, 12);

if (existing) {
  if (!shouldUpdate) {
    console.error(`Admin already exists: ${email}. Pass --update to change name or password.`);
    process.exit(1);
  }
  existing.name = name;
  existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`Updated admin ${name} <${email}>`);
  process.exit(0);
}

await Admin.create({
  email,
  name,
  passwordHash,
  role: 'admin',
});

console.log(`Added admin ${name} <${email}>`);
process.exit(0);
