import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './db.js';
import { seedFirstAdmin } from './seed.js';
import { authRouter } from './routes/auth.js';
import { roomsRouter } from './routes/rooms.js';

const port = Number(process.env.PORT) || 3000;
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';

const app = express();
app.use(cors({ origin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
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

await connectDb(uri);
await seedFirstAdmin();

app.listen(port, () => {
  console.log(`Planning Poker API on http://localhost:${port}`);
});
