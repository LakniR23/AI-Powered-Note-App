import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const DATA_DIR = join(process.cwd(), 'data');
const PERSONS_FILE = join(DATA_DIR, 'persons.json');
const NOTES_FILE = join(DATA_DIR, 'notes.json');

interface Person {
  _id: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  _id: string;
  personId: string;
  rawText: string;
  audioFile?: string;
  actionItems?: string[];
  meetings?: string[];
  connections?: Array<{
    name: string;
    relationship: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Initialize data directory and files
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  
  if (!existsSync(PERSONS_FILE)) {
    await writeFile(PERSONS_FILE, JSON.stringify([], null, 2));
  }
  
  if (!existsSync(NOTES_FILE)) {
    await writeFile(NOTES_FILE, JSON.stringify([], null, 2));
  }
}

// Person operations
export async function getAllPersons(): Promise<Person[]> {
  await ensureDataDir();
  const data = await readFile(PERSONS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function createPerson(personData: Omit<Person, '_id' | 'createdAt' | 'updatedAt'>): Promise<Person> {
  const persons = await getAllPersons();
  const newPerson: Person = {
    ...personData,
    _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  persons.push(newPerson);
  await writeFile(PERSONS_FILE, JSON.stringify(persons, null, 2));
  return newPerson;
}

export async function deletePerson(personId: string): Promise<Person | null> {
  const persons = await getAllPersons();
  const index = persons.findIndex(p => p._id === personId);
  if (index === -1) return null;
  
  const deleted = persons.splice(index, 1)[0];
  await writeFile(PERSONS_FILE, JSON.stringify(persons, null, 2));
  return deleted;
}

// Note operations
export async function getAllNotes(): Promise<Note[]> {
  await ensureDataDir();
  const data = await readFile(NOTES_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function getNotesByPersonId(personId: string): Promise<Note[]> {
  const notes = await getAllNotes();
  return notes.filter(note => note.personId === personId);
}

export async function createNote(noteData: Omit<Note, '_id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
  const notes = await getAllNotes();
  const newNote: Note = {
    ...noteData,
    _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  notes.push(newNote);
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
  return newNote;
}

export async function deleteNote(noteId: string): Promise<Note | null> {
  const notes = await getAllNotes();
  const index = notes.findIndex(n => n._id === noteId);
  if (index === -1) return null;
  
  const deleted = notes.splice(index, 1)[0];
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
  return deleted;
}
