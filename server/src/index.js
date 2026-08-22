import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './db.js';
import { seedFirstAdmin } from './seed.js';
import { authRouter } from './routes/auth.js';
import { azureRouter } from './routes/azure.js';
import { roomsRouter } from './routes/rooms.js';

const port = Number(process.env.PORT) || 3000;
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';

const app = express();
app.use(cors({ origin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/azure', azureRouter);
app.use('/api/rooms', roomsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
});

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is missing. Copy server/.env.example to server/.env');
  process.exit(1);
}

const placeholderHost = 'cluster.mongodb.net';
if (uri.includes(`@${placeholderHost}`) || uri.includes('://USER:PASS@')) {
  console.error(
    'MONGODB_URI is still the example placeholder.\n' +
      'Open server/.env and paste a real MongoDB Atlas connection string\n' +
      '(Atlas → Database → Connect → Drivers). It looks like:\n' +
      '  mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/planning-poker-dev'
  );
  process.exit(1);
}

await connectDb(uri);
await seedFirstAdmin();

app.listen(port, () => {
  console.log(`Planning Poker API on http://localhost:${port}`);
});
