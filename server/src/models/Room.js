import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true },
    isHost: { type: Boolean, default: false },
    vote: { type: String, default: null },
    hasVoted: { type: Boolean, default: false },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdByName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['waiting', 'voting', 'revealed', 'ended'],
      default: 'waiting',
    },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Room = mongoose.model('Room', roomSchema);
