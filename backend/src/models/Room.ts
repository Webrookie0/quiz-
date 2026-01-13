import mongoose, { Document, Schema } from 'mongoose';

export interface IParticipant {
  userId?: string;
  name: string;
  rollNo?: string;
  socketId: string;
  score: number;
  answers: {
    questionIndex: number;
    answer: string | number;
    timeTaken: number;
  }[];
}

export interface IRoom extends Document {
  roomId: string;
  adminId: string; // userId or 'anonymous'
  stackSize: number;
  requiredPlayers: number;
  participants: IParticipant[];
  questions: mongoose.Types.ObjectId[];
  status: 'waiting' | 'in-progress' | 'completed';
  currentQuestionIndex: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const RoomSchema = new Schema<IRoom>({
  roomId: { type: String, required: true, unique: true },
  adminId: { type: String, required: true },
  stackSize: { type: Number, required: true, default: 5 },
  requiredPlayers: { type: Number, required: true, default: 2 },
  participants: [{
    userId: String,
    name: { type: String, required: true },
    rollNo: String,
    socketId: String,
    score: { type: Number, default: 0 },
    answers: [{
      questionIndex: Number,
      answer: Schema.Types.Mixed,
      timeTaken: Number
    }]
  }],
  questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
  status: { 
    type: String, 
    enum: ['waiting', 'in-progress', 'completed'], 
    default: 'waiting' 
  },
  currentQuestionIndex: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date
});

export default mongoose.model<IRoom>('Room', RoomSchema);
