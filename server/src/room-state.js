export const DECK = ['7', '14', '21', '28', '35', '42', '49'];

function asPublicSeat(p) {
  const seat = p && typeof p.toObject === 'function' ? p.toObject() : p;
  return {
    id: seat.id,
    name: seat.name,
    isHost: !!seat.isHost,
    hasVoted: !!seat.hasVoted,
    vote: seat.vote ?? null,
  };
}

export function isExpired(room) {
  return room.status === 'ended' || new Date(room.expiresAt).getTime() <= Date.now();
}

export function toPublicRoom(room, viewer = {}) {
  const revealed = room.status === 'revealed';
  const voters = room.participants.map(asPublicSeat).filter((p) => !p.isHost);
  const votes = voters.filter((p) => p.hasVoted).map((p) => p.vote);
  const numeric = votes.map(Number).filter((n) => !Number.isNaN(n));
  const average =
    revealed && numeric.length
      ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10
      : null;

  const story = room.currentStory;
  const currentStory =
    story?.workItemId && story?.title
      ? {
          workItemId: story.workItemId,
          workItemType: story.workItemType || 'Work Item',
          title: story.title,
          url: story.url || null,
        }
      : null;

  return {
    code: room.code,
    name: room.name,
    azureProject: room.azureProject || null,
    currentStory,
    status: room.status,
    expiresAt: room.expiresAt,
    createdByName: room.createdByName,
    deck: DECK,
    remainingMs: Math.max(0, new Date(room.expiresAt).getTime() - Date.now()),
    votedCount: voters.filter((p) => p.hasVoted).length,
    participantCount: voters.length,
    average,
    participants: [...voters]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        hasVoted: p.hasVoted,
        vote: revealed || p.id === viewer.participantId ? p.vote : null,
      })),
  };
}
