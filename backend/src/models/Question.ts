import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion extends Document {
  question: string;
  type: 'objective' | 'subjective';
  options?: string[]; // Required for objective, not needed for subjective
  correctAnswer: number | string; // index for objective, text answer for subjective
  useAI?: boolean;
  explanation?: string;
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  question: { type: String, required: true },
  type: { type: String, enum: ['objective', 'subjective'], required: true },
  useAI: { type: Boolean, default: true },
  options: {
    type: [String],
    validate: {
      validator: function (this: IQuestion, val: string[]) {
        if (this.type === 'objective') {
          return val && val.length >= 2 && val.length <= 10;
        }
        return true; // Subjective questions don't need options
      },
      message: 'Objective questions must have between 2 and 10 options'
    }
  },
  correctAnswer: { type: Schema.Types.Mixed, required: true }, // Can be number (index) or string (text)
  explanation: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IQuestion>('Question', QuestionSchema);


