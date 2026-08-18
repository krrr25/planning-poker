import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { Room } from '../models/Room.js';
import { hashToken, randomToken, readAdmin, requireAdmin } from '../auth.js';
import { DECK, isExpired, toPublicRoom } from '../room-state.js';

const codeId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 6);
const participantId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 10);

export const roomsRouter = Router();

function ttlHours() {
  const n = Number(process.env.ROOM_TTL_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

async function loadRoom(code) {
  return Room.findOne({ code: String(code || '').toLowerCase() });
}

function findParticipant(room, req) {
  const token = req.header('x-participant-token');
  if (!token) {
    return null;
  }
  const tokenHash = hashToken(token);
  return room.participants.find((p) => p.tokenHash === tokenHash) || null;
}

roomsRouter.post('/', requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ message: 'Room name must be 2–80 characters' });
    return;
  }

  const hours = ttlHours();
  const room = await Room.create({
    code: codeId(),
    name,
    createdBy: req.admin.sub,
    createdByName: req.admin.name,
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    status: 'waiting',
    participants: [],
  });

  res.status(201).json({
    ...toPublicRoom(room),
    joinUrl: `${process.env.CLIENT_ORIGIN || ''}/room/${room.code}`,
  });
});

roomsRouter.get('/', requireAdmin, async (req, res) => {
  const rooms = await Room.find({
    createdBy: req.admin.sub,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  res.json(rooms.map((room) => toPublicRoom(room)));
});

roomsRouter.get('/:code', async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }
  if (isExpired(room)) {
    res.status(410).json({ message: 'This room has expired. Ask the facilitator for a new link.' });
    return;
  }

  const participant = findParticipant(room, req);
  res.json({
    ...toPublicRoom(room, { participantId: participant?.id }),
    viewer: participant
      ? { participantId: participant.id, name: participant.name, isHost: participant.isHost }
      : readAdmin(req)
        ? { role: 'admin', name: readAdmin(req).name }
        : null,
  });
});

roomsRouter.post('/:code/join', async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  const admin = readAdmin(req);
  let name = String(req.body?.name || '').trim();
  let isHost = false;

  if (admin) {
    name = admin.name;
    isHost = true;
  }

  if (name.length < 2 || name.length > 32) {
    res.status(400).json({ message: 'Enter a name between 2 and 32 characters' });
    return;
  }

  const existing = room.participants.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing && !(admin && existing.isHost)) {
    res.status(409).json({ message: 'That name is already in this room' });
    return;
  }

  const token = randomToken();
  if (existing && admin && existing.isHost) {
    existing.tokenHash = hashToken(token);
    await room.save();
    res.status(200).json({
      token,
      participantId: existing.id,
      name: existing.name,
      isHost: true,
      room: toPublicRoom(room, { participantId: existing.id }),
    });
    return;
  }

  const person = {
    id: participantId(),
    name,
    tokenHash: hashToken(token),
    isHost,
    vote: null,
    hasVoted: false,
  };
  room.participants.push(person);
  await room.save();

  res.status(201).json({
    token,
    participantId: person.id,
    name: person.name,
    isHost,
    room: toPublicRoom(room, { participantId: person.id }),
  });
});

roomsRouter.post('/:code/start', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  room.status = 'voting';
  room.participants.forEach((p) => {
    p.vote = null;
    p.hasVoted = false;
  });
  await room.save();
  res.json(toPublicRoom(room));
});

roomsRouter.post('/:code/vote', async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }
  if (room.status !== 'voting') {
    res.status(400).json({ message: 'Voting has not started' });
    return;
  }

  const participant = findParticipant(room, req);
  if (!participant) {
    res.status(401).json({ message: 'Join the room first' });
    return;
  }

  const value = String(req.body?.value ?? '');
  if (!DECK.includes(value)) {
    res.status(400).json({ message: 'Invalid card' });
    return;
  }

  participant.vote = value;
  participant.hasVoted = true;
  await room.save();
  res.json(toPublicRoom(room, { participantId: participant.id }));
});

roomsRouter.post('/:code/reveal', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }
  if (room.status !== 'voting') {
    res.status(400).json({ message: 'Start voting before reveal' });
    return;
  }

  room.status = 'revealed';
  await room.save();
  res.json(toPublicRoom(room));
});

roomsRouter.post('/:code/reset', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  room.status = 'waiting';
  room.participants.forEach((p) => {
    p.vote = null;
    p.hasVoted = false;
  });
  await room.save();
  res.json(toPublicRoom(room));
});

roomsRouter.post('/:code/extend', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  room.expiresAt = new Date(Math.max(room.expiresAt.getTime(), Date.now()) + 60 * 60 * 1000);
  await room.save();
  res.json(toPublicRoom(room));
});
