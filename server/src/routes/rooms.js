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

async function removeHostSeats(room) {
  const voters = room.participants.filter((p) => !asSeat(p).isHost);
  if (voters.length === room.participants.length) {
    return room;
  }
  room.participants = voters;
  room.markModified('participants');
  await room.save();
  return room;
}

function asSeat(p) {
  if (!p) {
    return {};
  }
  const doc = p._doc || (typeof p.toObject === 'function' ? p.toObject({ virtuals: false }) : p);
  return {
    id: p.get?.('id') || doc.id,
    name: doc.name,
    tokenHash: doc.tokenHash || doc.tokenHash,
    isHost: !!(doc.isHost ?? doc.isHost),
    vote: doc.vote ?? null,
    hasVoted: !!doc.hasVoted,
  };
}

function findParticipant(room, req) {
  const token = req.header('x-participant-token') || req.header('x-participant-token');
  if (token) {
    const tokenHash = hashToken(token);
    const byToken = room.participants.find((p) => asSeat(p).tokenHash === tokenHash);
    if (byToken) {
      return byToken;
    }
  }

  const id = String(req.body?.participantId || '').trim();
  if (id) {
    const byId = room.participants.find((p) => asSeat(p).id === id);
    if (byId) {
      return byId;
    }
  }

  const name = String(req.body?.name || '').trim().toLowerCase();
  if (!name) {
    return null;
  }
  return room.participants.find((p) => asSeat(p).name?.toLowerCase() === name) || null;
}

async function removeParticipant(room, participant, extra = {}) {
  const target = asSeat(participant);
  const extraId = String(extra.participantId || '').trim();
  const extraName = String(extra.name || target.name || '').trim();
  const ids = [...new Set([target.id, extraId].filter(Boolean))];
  const names = [...new Set([target.name, extraName].filter(Boolean))];

  let changed = false;
  for (const id of ids) {
    const result = await Room.collection.updateOne(
      { _id: room._id },
      { $pull: { participants: { id } } }
    );
    if (result.modifiedCount) {
      changed = true;
    }
  }
  for (const name of names) {
    const result = await Room.collection.updateOne(
      { _id: room._id },
      { $pull: { participants: { name } } }
    );
    if (result.modifiedCount) {
      changed = true;
    }
  }

  if (!changed) {
    const next = room.participants.filter((p) => {
      const seat = asSeat(p);
      if (ids.includes(seat.id)) {
        return false;
      }
      if (names.some((n) => n.toLowerCase() === seat.name?.toLowerCase())) {
        return false;
      }
      return true;
    });
    if (next.length !== room.participants.length) {
      room.participants = next;
      room.markModified('participants');
      await room.save();
      changed = true;
    }
  }

  return changed;
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
    status: { $ne: 'ended' },
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
    res.status(410).json({ message: 'This room has ended. Ask the facilitator for a new link.' });
    return;
  }

  await removeHostSeats(room);

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
  if (admin) {
    res.status(200).json({
      token: null,
      participantId: null,
      name: admin.name,
      isHost: true,
      room: toPublicRoom(room),
    });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const isHost = false;

  if (name.length < 2 || name.length > 32) {
    res.status(400).json({ message: 'Enter a name between 2 and 32 characters' });
    return;
  }

  const existing = room.participants.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    res.status(409).json({ message: 'That name is already in this room' });
    return;
  }

  const token = randomToken();
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

  await removeHostSeats(room);
  room.status = 'voting';
  room.participants.forEach((p) => {
    p.vote = null;
    p.hasVoted = false;
  });
  await room.save();
  res.json(toPublicRoom(room));
});

roomsRouter.post('/:code/leave', async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  const participant = findParticipant(room, req);
  const removed = await removeParticipant(room, participant, {
    participantId: req.body?.participantId,
    name: req.body?.name,
  });

  const updated = (await loadRoom(req.params.code)) || room;
  res.json({ ok: true, removed, room: toPublicRoom(updated) });
});

roomsRouter.post('/:code/remove', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room || isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  const removed = await removeParticipant(room, null, {
    participantId: req.body?.participantId,
    name: req.body?.name,
  });

  const updated = (await loadRoom(req.params.code)) || room;
  res.json({ ok: true, removed, room: toPublicRoom(updated) });
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
  if (isExpired(room)) {
    res.status(410).json({ message: 'Room is not available' });
    return;
  }

  room.expiresAt = new Date(Math.max(room.expiresAt.getTime(), Date.now()) + 60 * 60 * 1000);
  await room.save();
  res.json(toPublicRoom(room));
});

roomsRouter.post('/:code/end', requireAdmin, async (req, res) => {
  const room = await loadRoom(req.params.code);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  room.status = 'ended';
  room.expiresAt = new Date();
  await room.save();
  res.json({ ok: true, code: room.code });
});
