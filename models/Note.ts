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
  // New: Structured network mentions for relationship tracking
  networkMentions?: Array<{
    personName?: string;        // e.g., "John Doe" or "CEO" (if name unknown)
    company?: string;            // e.g., "Tesla", "Company X"
    title?: string;              // e.g., "CEO", "CTO", "Founder"
    context?: string;            // e.g., "knows", "works with", "friend of"
    snippet?: string;            // Original text snippet for context
  }>;
  // New: Raw extracted entities for advanced search
  extractedEntities?: {
    people?: string[];           // All person names mentioned
    companies?: string[];        // All companies mentioned
    titles?: string[];           // All job titles/roles mentioned
    keywords?: string[];         // Other relevant keywords
  };
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
    networkMentions: [
      {
        personName: String,
        company: String,
        title: String,
        context: String,
        snippet: String,
      },
    ],
    extractedEntities: {
      people: [String],
      companies: [String],
      titles: [String],
      keywords: [String],
    },
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
