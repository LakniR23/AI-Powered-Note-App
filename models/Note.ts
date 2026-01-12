import mongoose, { Schema, Document, Model } from "mongoose";

export interface INote extends Document {
  personId: mongoose.Types.ObjectId;
  rawText: string;
  audioFile?: string;
  actionItems?: string[];
  meetings?: Date[];
  connections?: Array<{
    name: string;
    relationship: string;
  }>;
}

const NoteSchema: Schema<INote> = new Schema(
  {
    personId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    rawText: { type: String, required: true },
    audioFile: String,
    actionItems: [String],
    meetings: [Date],
    connections: [
      {
        name: String,
        relationship: String,
      },
    ],
  },
  { 
    timestamps: true,
    collection: 'note'
  }
);

const Note: Model<INote> =
  mongoose.models.Note ||
  mongoose.model<INote>("Note", NoteSchema);

export default Note;
