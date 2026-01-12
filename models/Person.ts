import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPerson extends Document {
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  notesCount?: number;
}

const PersonSchema: Schema<IPerson> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    company: String,
    title: String,
    email: String,
    phone: String,
    notesCount: { type: Number, default: 0 },
  },
  { 
    timestamps: true,
    collection: 'person'
  }
);

const Person: Model<IPerson> =
  mongoose.models.Person ||
  mongoose.model<IPerson>("Person", PersonSchema);

export default Person;
