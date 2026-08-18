export const DECK = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];

export function isExpired(room) {
  return new Date(room.expiresAt).getTime() <= Date.now();
}

export function toPublicRoom(room, viewer = {}) {
  const revealed = room.status === 'revealed';
  const votes = room.participants.filter((p) => p.hasVoted).map((p) => p.vote);
  const numeric = votes.map(Number).filter((n) => !Number.isNaN(n));
  const average =
    revealed && numeric.length
      ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10
      : null;

  return {
    code: room.code,
    name: room.name,
    status: room.status,
    expiresAt: room.expiresAt,
    createdByName: room.createdByName,
    deck: DECK,
    remainingMs: Math.max(0, new Date(room.expiresAt).getTime() - Date.now()),
    votedCount: room.participants.filter((p) => p.hasVoted).length,
    participantCount: room.participants.length,
    average,
    participants: room.participants.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      hasVoted: p.hasVoted,
      vote: revealed || p.id === viewer.participantId ? p.vote : null,
    })),
  };
}
