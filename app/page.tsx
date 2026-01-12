"use client";

import { useState, useEffect } from "react";

interface Person {
  _id: string;
  firstName: string;
  lastName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
}

interface Note {
  _id: string;
  personId: string;
  rawText: string;
  audioFile?: string;
  actionItems?: string[];
  meetings?: Date[];
  connections?: Array<{
    name: string;
    relationship: string;
  }>;
  createdAt: string;
}

export default function Home() {
  // Person form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Note form states
  const [rawText, setRawText] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);

  // Data states
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch all people on mount
  useEffect(() => {
    fetchPeople();
  }, []);

  // Fetch notes when person is selected
  useEffect(() => {
    if (selectedPerson) {
      fetchNotes(selectedPerson._id);
    }
  }, [selectedPerson]);

  // Clear search when leaving search page
  useEffect(() => {
    if (!showSearch) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [showSearch]);

  const fetchPeople = async () => {
    try {
      const response = await fetch("/api/person");
      const result = await response.json();
      if (result.success) {
        setPeople(result.data);
      }
    } catch (error) {
      console.error("Error fetching people:", error);
    }
  };

  const fetchNotes = async (personId: string) => {
    try {
      const response = await fetch(`/api/note?personId=${personId}`);
      const result = await response.json();
      if (result.success) {
        setNotes(result.data);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      const response = await fetch(`/api/note?noteId=${noteId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        setNoteMessage("Note deleted successfully!");
        if (selectedPerson) {
          fetchNotes(selectedPerson._id);
        }
        setTimeout(() => setNoteMessage(""), 3000);
      } else {
        setNoteMessage(`Error: ${result.error}`);
      }
    } catch (error: any) {
      setNoteMessage(`Error: ${error.message}`);
      console.error("Error deleting note:", error);
    }
  };

  const deletePerson = async (personId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent selecting the person when clicking delete
    
    if (!confirm("Are you sure you want to delete this person? All their notes will remain but won't be accessible.")) {
      return;
    }

    try {
      const response = await fetch(`/api/person?personId=${personId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        // If deleted person was selected, clear selection
        if (selectedPerson?._id === personId) {
          setSelectedPerson(null);
          setShowAddPerson(true);
        }
        fetchPeople();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      console.error("Error deleting person:", error);
    }
  };

  const addPerson = async () => {
    if (!firstName || !lastName) {
      setMessage("First name and last name are required!");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          firstName, 
          lastName,
          company: company || undefined,
          title: title || undefined,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage("Person added successfully!");
        setFirstName("");
        setLastName("");
        setCompany("");
        setTitle("");
        setEmail("");
        setPhone("");
        fetchPeople();
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      console.error("Error adding person:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async () => {
    if (!selectedPerson) {
      setNoteMessage("Please select a person first!");
      setTimeout(() => setNoteMessage(""), 3000);
      return;
    }
    if (!rawText && !recordedAudio) {
      setNoteMessage("Note text or audio recording is required!");
      setTimeout(() => setNoteMessage(""), 3000);
      return;
    }

    setIsNoteLoading(true);
    setNoteMessage("");

    try {
      if (recordedAudio) {
        // Upload audio file
        const formData = new FormData();
        formData.append("personId", selectedPerson._id);
        formData.append("rawText", rawText || "Voice note");
        formData.append("audioFile", recordedAudio, `recording_${Date.now()}.webm`);

        const response = await fetch("/api/note/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          setNoteMessage("Voice note added successfully!");
          setTimeout(() => setNoteMessage(""), 3000);
          setRawText("");
          setRecordedAudio(null);
          setAudioChunks([]);
          fetchNotes(selectedPerson._id);
        } else {
          setNoteMessage(`Error: ${result.error}`);
          setTimeout(() => setNoteMessage(""), 3000);
        }
      } else {
        // Regular text note
        const response = await fetch("/api/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            personId: selectedPerson._id,
            rawText,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setNoteMessage("Note added successfully!");
          setTimeout(() => setNoteMessage(""), 3000);
          setRawText("");
          fetchNotes(selectedPerson._id);
        } else {
          setNoteMessage(`Error: ${result.error}`);
          setTimeout(() => setNoteMessage(""), 3000);
        }
      }
    } catch (error: any) {
      setNoteMessage(`Error: ${error.message}`);
      setTimeout(() => setNoteMessage(""), 3000);
      console.error("Error adding note:", error);
    } finally {
      setIsNoteLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedAudio(blob);
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setNoteMessage("Recording...");
    } catch (error: any) {
      setNoteMessage(`Error: ${error.message}`);
      setTimeout(() => setNoteMessage(""), 3000);
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      setNoteMessage("Recording stopped. Click 'Add Note' to save.");
      setTimeout(() => setNoteMessage(""), 500);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
    setRecordedAudio(null);
    setAudioChunks([]);
    setNoteMessage("");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: searchQuery
          // Global search - no personId
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data);
      } else {
        console.error("Search error:", result.error);
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error("Error searching:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      {/* Left Sidebar - People List */}
      <div className="w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">People</h2>
        
        <button
          onClick={() => {
            setShowSearch(true);
            setShowAddPerson(false);
            setSelectedPerson(null);
          }}
          className="w-full mb-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          🔍 Search Network
        </button>
        
        <button
          onClick={() => {
            setShowAddPerson(true);
            setShowSearch(false);
            setSelectedPerson(null);
          }}
          className="w-full mb-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
        >
          + Add Person
        </button>
        <div className="space-y-2">
          {people.map((person) => (
            <div
              key={person._id}
              className={`rounded transition ${
                selectedPerson?._id === person._id
                  ? "bg-black text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between p-3">
                <button
                  onClick={() => {
                    setSelectedPerson(person);
                    setShowAddPerson(false);
                    setShowSearch(false);
                  }}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{person.firstName} {person.lastName}</div>
                  {person.company && (
                    <div className="text-sm opacity-70">{person.company}</div>
                  )}
                </button>
                <button
                  onClick={(e) => deletePerson(person._id, e)}
                  className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition flex-shrink-0"
                  title="Delete person"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-8">
        {showSearch ? (
          /* Global Search View */
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Search Network</h1>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-zinc-300 dark:border-zinc-700 p-3 rounded"
                  placeholder="Ask anything... (e.g., 'What meetings tomorrow?' or 'Who is the CEO?')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h2 className="text-xl font-bold">Results ({searchResults.length})</h2>
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                      {result.type === 'personName' && (
                        <div className="text-lg font-semibold">{result.answer}</div>
                      )}

                      {result.type === 'meeting' && (
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📅</div>
                          <div className="font-medium">{result.answer}</div>
                        </div>
                      )}

                      {result.type === 'connection' && (
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🔗</div>
                          <div className="font-medium">{result.answer}</div>
                        </div>
                      )}

                      {result.type === 'actionItem' && (
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">✅</div>
                          <div className="font-medium">{result.answer}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="mt-4 text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No results found.
                </div>
              )}

              {!searchQuery && !isSearching && (
                <div className="text-center text-zinc-500 dark:text-zinc-400 py-12">
                  <p className="text-lg mb-4">Search your entire network for:</p>
                  <ul className="text-left inline-block space-y-2">
                    <li>• People by name, company, or title</li>
                    <li>• Meetings (by day: tomorrow, Friday, etc.)</li>
                    <li>• Action items and tasks</li>
                    <li>• Connections and relationships</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : showAddPerson ? (
          /* Add Person Form */
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Add New Person</h1>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 space-y-4">
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="First Name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="Last Name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="Job Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 p-2 w-full rounded"
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              
              {message && (
                <div className={`p-3 rounded text-center ${
                  message.includes("success") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {message}
                </div>
              )}
              
              <div className="flex justify-center">
                <button
                  onClick={addPerson}
                  disabled={isLoading}
                  className="bg-blue-600 border border-gray-700 cursor-pointer text-white px-16 py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Adding..." : "Add Person"}
                </button>
              </div>
            </div>
          </div>
        ) : selectedPerson ? (
          /* Notes View */
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold">
                {selectedPerson.firstName} {selectedPerson.lastName}
              </h1>
              {selectedPerson.title && selectedPerson.company && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  {selectedPerson.title} at {selectedPerson.company}
                </p>
              )}
            </div>

            {/* Add Note Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Add Note</h2>
              
              {/* Voice Recording Section */}
              <div className="mb-4">
                <div className="flex gap-2 mb-3">
                  {!isRecording && !recordedAudio && (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                      🎤 Start Recording
                    </button>
                  )}
                  
                  {isRecording && (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition animate-pulse"
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                  
                  {recordedAudio && !isRecording && (
                    <>
                      <button
                        onClick={cancelRecording}
                        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
                      >
                        🗑️ Delete Recording
                      </button>
                      <div className="flex-1">
                        <audio 
                          controls 
                          src={URL.createObjectURL(recordedAudio)}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Text Input Section */}
              <textarea
                className="border border-zinc-300 dark:border-zinc-700 p-3 w-full rounded min-h-32"
                placeholder="Enter your note here... (optional if you have audio)"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              
              {noteMessage && (
                <div className={`p-3 rounded text-center mt-4 max-w-md mx-auto ${
                  noteMessage.includes("success") ? "bg-green-100 text-green-700" : 
                  noteMessage.includes("Recording") ? "bg-blue-100 text-blue-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {noteMessage}
                </div>
              )}
              
              <button
                onClick={addNote}
                disabled={isNoteLoading || isRecording}
                className="mt-4 bg-black text-white px-6 py-2 rounded hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNoteLoading ? "Adding..." : "Add Note"}
              </button>
            </div>

            {/* Notes List */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Notes ({notes.length})</h2>
              {notes.length === 0 ? (
                <div className="text-center text-zinc-500 dark:text-zinc-400 py-12">
                  No notes yet. Add your first note above.
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note._id} className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 relative">
                      <button
                        onClick={() => deleteNote(note._id)}
                        className="absolute top-4 right-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition"
                        title="Delete note"
                      >
                        🗑️
                      </button>
                      {note.audioFile && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                              🎤 Voice Recording
                            </span>
                          </div>
                          <audio 
                            controls 
                            src={note.audioFile}
                            className="w-full"
                            preload="metadata"
                          />
                        </div>
                      )}
                      <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap mb-4">
                        {note.rawText}
                      </p>
                      
                      {/* Action Items */}
                      {note.actionItems && note.actionItems.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-2">
                            ✅ Action Items:
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {note.actionItems.map((item, idx) => (
                              <li key={idx} className="text-sm text-blue-800 dark:text-blue-200">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Meetings */}
                      {note.meetings && note.meetings.length > 0 && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                          <h4 className="font-semibold text-sm text-green-900 dark:text-green-300 mb-2">
                            📅 Meetings:
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {note.meetings.map((meeting, idx) => (
                              <li key={idx} className="text-sm text-green-800 dark:text-green-200">
                                {new Date(meeting).toLocaleDateString()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Connections */}
                      {note.connections && note.connections.length > 0 && (
                        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                          <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-300 mb-2">
                            🔗 Connections:
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {note.connections.map((conn: any, idx: number) => (
                              <li key={idx} className="text-sm text-purple-800 dark:text-purple-200">
                                {conn.name}: {conn.relationship}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {new Date(note.createdAt).toLocaleDateString()} at{" "}
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
            <p>Select a person from the left sidebar or add a new person</p>
          </div>
        )}
      </div>
    </div>
  );
}
