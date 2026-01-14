"use client";

import { useState, useEffect, useCallback } from "react";

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
  networkMentions?: Array<{
    personName?: string;
    company?: string;
    title?: string;
    context?: string;
    snippet?: string;
  }>;
  extractedEntities?: {
    people?: string[];
    companies?: string[];
    titles?: string[];
    keywords?: string[];
  };
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

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Manual Network Entry State
  const [manualFirstName, setManualFirstName] = useState("");
  const [manualLastName, setManualLastName] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [isManualEntryLoading, setIsManualEntryLoading] = useState(false);

  const [manualEntryMessage, setManualEntryMessage] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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

    // Validate that the selected person has a valid MongoDB ObjectId
    if (!selectedPerson._id || selectedPerson._id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(selectedPerson._id)) {
      setNoteMessage("Invalid person selected. Please refresh and select a valid person.");
      setTimeout(() => {
        setNoteMessage("");
        setSelectedPerson(null);
        fetchPeople();
      }, 3000);
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

  const handleSearch = useCallback(async () => {
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
  }, [searchQuery]);

  // Debounce search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]);

  const handleManualEntrySubmit = async () => {
    if (!manualFirstName || !manualLastName) {
      setManualEntryMessage("First name and last name are required.");
      setTimeout(() => setManualEntryMessage(""), 3000);
      return;
    }

    setIsManualEntryLoading(true);
    setManualEntryMessage("");

    try {
      // 1. Create Person
      const personResponse = await fetch("/api/person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: manualFirstName,
          lastName: manualLastName,
          company: manualCompany || undefined,
          title: manualTitle || undefined,
        }),
      });

      const personResult = await personResponse.json();

      if (!personResult.success) {
        throw new Error(personResult.error || "Failed to create person");
      }

      const newPersonId = personResult.data._id;

      // 2. Add Network Note (if provided)
      if (manualNote.trim()) {
        const noteResponse = await fetch("/api/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: newPersonId,
            rawText: manualNote,
          }),
        });

        const noteResult = await noteResponse.json();
        if (!noteResult.success) {
          console.error("Person created but note failed:", noteResult.error);
          setManualEntryMessage("Person added, but failed to save note.");
          // Still proceed to clear/refresh as person was added
        } else {
          setManualEntryMessage("Network person and details saved successfully!");
        }
      } else {
        setManualEntryMessage("Network person added successfully!");
      }

      // 3. Cleanup and Refresh
      setManualFirstName("");
      setManualLastName("");
      setManualCompany("");
      setManualTitle("");
      setManualNote("");
      fetchPeople();

      // Close modal and show toast
      setShowManualEntry(false);
      setToastMessage("🎉 Successfully added to network!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (error: any) {
      console.error("Error in manual entry:", error);
      setManualEntryMessage(`Error: ${error.message}`);
      setTimeout(() => setManualEntryMessage(""), 5000);
    } finally {
      setIsManualEntryLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      {/* Mobile Hamburger Menu */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-black text-white p-3 rounded-lg shadow-lg hover:bg-gray-800 transition"
        aria-label="Toggle menu"
      >
        {isSidebarOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - People List */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-40
        w-72 bg-white dark:bg-[#09090b] border-r border-zinc-200 dark:border-zinc-800 
        flex flex-col overflow-hidden transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Network</h2>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
        </div>
        <div className="px-3 pb-4 overflow-y-auto flex-1 custom-scrollbar">

          <button
            onClick={() => {
              setShowSearch(true);
              setShowAddPerson(false);
              setSelectedPerson(null);
              setIsSidebarOpen(false);
            }}
            className="w-full mb-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
          >
            🔍 Search Network
          </button>

          <button
            onClick={() => {
              setShowAddPerson(true);
              setShowSearch(false);
              setSelectedPerson(null);
              setIsSidebarOpen(false);
            }}
            className="w-full mb-4 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-700 transition text-sm font-medium shadow-sm"
          >
            + Add Person
          </button>
          <div className="space-y-1">
            {people.map((person) => (
              <div
                key={person._id}
                className={`group rounded-md transition-all duration-200 border ${selectedPerson?._id === person._id
                  ? "bg-white dark:bg-zinc-800 shadow-sm border-zinc-200 dark:border-zinc-700"
                  : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  }`}
              >
                <div className="flex items-center gap-3 p-2">
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase transition-colors ${selectedPerson?._id === person._id
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600"
                    }`}>
                    {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPerson(person);
                      setShowAddPerson(false);
                      setShowSearch(false);
                      setIsSidebarOpen(false);
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`font-medium text-sm truncate ${selectedPerson?._id === person._id
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-700 dark:text-zinc-300"
                      }`}>
                      {person.firstName} {person.lastName}
                    </div>
                    {person.company && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{person.company}</div>
                    )}
                  </button>
                  <button
                    onClick={(e) => deletePerson(person._id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-all p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                    title="Delete person"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-4 md:p-8 pt-20 md:pt-8">
        {showSearch ? (
          /* Global Search View */
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Search Network</h1>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className="flex-1 border border-zinc-300 dark:border-zinc-700 px-4 py-2 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="Ask anything... (e.g., 'What meetings tomorrow?')"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setIsSearching(true);
                    } else {
                      setSearchResults([]);
                      setIsSearching(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="mt-8 text-center text-zinc-500 dark:text-zinc-400 animate-pulse">
                  Searching...
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h2 className="text-lg md:text-xl font-bold">Results ({searchResults.length})</h2>
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-3 border border-zinc-100 dark:border-zinc-800/50">
                      {result.type === 'personName' && (
                        <div className="text-sm font-semibold">{result.answer}</div>
                      )}

                      {result.type === 'meeting' && (
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📅</div>
                          <div className="font-medium text-xs md:text-sm">{result.answer}</div>
                        </div>
                      )}

                      {result.type === 'connection' && (
                        <div className="flex items-start gap-3">
                          <div className="text-xl">🔗</div>
                          <div className="font-medium text-xs md:text-sm">{result.answer}</div>
                        </div>
                      )}

                      {result.type === 'actionItem' && (
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">✅</div>
                          <div className="font-medium text-xs md:text-sm">{result.answer}</div>
                        </div>
                      )}

                      {result.type === 'networkMention' && (
                        <div className="space-y-3 p-1">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-lg shadow-sm border border-indigo-200 dark:border-indigo-800">
                              {result.isForwardConnection ? '➡️' : '🤝'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${result.isForwardConnection
                                  ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                                  : "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                                  }`}>
                                  {result.isForwardConnection ? 'Knows / Connects To' : 'Connector Found'}
                                </span>
                              </div>
                              <div className="font-bold text-base text-zinc-900 dark:text-white">
                                {result.isForwardConnection ? result.answer : (result.connectorName || result.answer)}
                              </div>
                              <div className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                {result.isForwardConnection ? (
                                  <span>Connected via {result.connectorName}</span>
                                ) : (
                                  <span>has a connection to: <span className="font-bold text-indigo-700 dark:text-indigo-300">{result.matchReason}</span></span>
                                )}
                              </div>

                              {result.snippet && (
                                <div className="text-xs italic border-l-4 border-indigo-500/30 dark:border-indigo-500/50 pl-4 py-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-r-md">
                                  &quot;{result.snippet}&quot;
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {result.type === 'entityMatch' && (
                        <div className="flex items-start gap-3">
                          <div className="text-xl">🏢</div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm md:text-base">{result.answer}</div>
                            {result.matchReason && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                                {result.matchReason}
                              </div>
                            )}
                          </div>
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
                <div className="text-center text-zinc-500 dark:text-zinc-400 py-8 md:py-12">
                  <p className="text-base md:text-lg mb-4">Search your entire network for:</p>
                  <ul className="text-left inline-block space-y-2 text-sm md:text-base">
                    <li>• People who know specific roles (e.g., &quot;Who knows a CEO?&quot;)</li>
                    <li>• People linked to companies (e.g., &quot;Who has a Tesla connection?&quot;)</li>
                    <li>• People who mentioned specific names (e.g., &quot;John Doe&quot;)</li>
                    <li>• Meetings (e.g., &quot;tomorrow&quot;, &quot;Friday&quot;)</li>
                    <li>• Action items and tasks</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : showAddPerson ? (
          /* Add Person Form */
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Add New Person</h1>
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 space-y-4">
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="First Name *"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="Last Name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="Company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="Job Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                placeholder="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              {message && (
                <div className={`p-3 rounded-md text-center text-sm ${message.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                  {message}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={addPerson}
                  disabled={isLoading}
                  className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-6 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                >
                  {isLoading ? "Adding..." : "Add Person"}
                </button>
              </div>
            </div>
          </div>
        ) : selectedPerson ? (
          /* Notes View */
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 md:mb-6">
              <h1 className="text-2xl md:text-3xl font-bold">
                {selectedPerson.firstName} {selectedPerson.lastName}
              </h1>
              {selectedPerson.title && selectedPerson.company && (
                <p className="text-zinc-600 dark:text-zinc-400 text-sm md:text-base">
                  {selectedPerson.title} at {selectedPerson.company}
                </p>
              )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Add Note Form */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 h-fit sticky top-4">
                <h2 className="text-lg font-bold mb-4">Add Note</h2>

                {/* Voice Recording Section */}
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    {!isRecording && !recordedAudio && (
                      <button
                        onClick={startRecording}
                        className="flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition text-sm font-medium shadow-sm"
                      >
                        🎤 Start Recording
                      </button>
                    )}

                    {isRecording && (
                      <button
                        onClick={stopRecording}
                        className="flex items-center justify-center gap-2 bg-zinc-800 text-white px-3 py-2 rounded-md hover:bg-zinc-900 transition animate-pulse text-sm font-medium shadow-sm"
                      >
                        ⏹️ Stop Recording
                      </button>
                    )}

                    {recordedAudio && !isRecording && (
                      <>
                        <button
                          onClick={cancelRecording}
                          className="flex items-center justify-center gap-2 bg-zinc-600 text-white px-3 py-2 rounded-md hover:bg-zinc-700 transition text-sm font-medium shadow-sm"
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
                  className="border border-zinc-300 dark:border-zinc-700 px-3 py-2 w-full rounded-md min-h-24 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-zinc-800"
                  placeholder="Enter your note here... (optional if you have audio)"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />

                {noteMessage && (
                  <div className={`p-3 rounded text-center mt-4 max-w-md mx-auto text-sm md:text-base ${noteMessage.includes("success") ? "bg-green-100 text-green-700" :
                    noteMessage.includes("Recording") ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                    {noteMessage}
                  </div>
                )}

                <button
                  onClick={addNote}
                  disabled={isNoteLoading || isRecording}
                  className="mt-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-6 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium w-full shadow-sm"
                >
                  {isNoteLoading ? "Adding..." : "Add Note"}
                </button>
              </div>

              {/* Right Column - Notes List */}
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-4">Notes ({notes.length})</h2>
                {notes.length === 0 ? (
                  <div className="text-center text-zinc-500 dark:text-zinc-400 py-12">
                    No notes yet. Add your first note above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <div key={note._id} className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 relative">
                        <button
                          onClick={() => deleteNote(note._id)}
                          className="absolute top-4 right-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition text-lg"
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
                        <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap mb-4 text-sm md:text-base pr-8">
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

                        {/* Network Mentions */}
                        {note.networkMentions && note.networkMentions.length > 0 && (
                          <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded">
                            <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-300 mb-2">
                              🌐 Network Mentions:
                            </h4>
                            <div className="space-y-2">
                              {note.networkMentions.map((mention, idx) => (
                                <div key={idx} className="text-sm bg-white dark:bg-zinc-800 p-2 rounded border border-indigo-100 dark:border-indigo-900/30">
                                  <div className="font-medium text-indigo-800 dark:text-indigo-200">
                                    {mention.personName && <span className="mr-1">{mention.personName}</span>}
                                    {mention.title && <span className="opacity-75">({mention.title})</span>}
                                    {mention.company && <span className="ml-1 font-bold text-indigo-900 dark:text-indigo-100">@{mention.company}</span>}
                                  </div>
                                  {mention.snippet && (
                                    <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 italic">
                                      &quot;{mention.snippet}&quot;
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-4 text-xs md:text-sm text-zinc-500 dark:text-zinc-400">
                          {new Date(note.createdAt).toLocaleDateString()} at{" "}
                          {new Date(note.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-center px-4">
            <p className="text-sm md:text-base">Select a person from the left sidebar or add a new person</p>
          </div>
        )}
        {/* Manual Network Person Input Section - Always visible at bottom */}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-black text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="font-medium">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Floating Action Button for Manual Entry */}
        {!showManualEntry && (
          <button
            onClick={() => setShowManualEntry(true)}
            className="fixed bottom-8 right-8 z-50 bg-indigo-600 text-white h-12 w-12 hover:w-auto rounded-full shadow-lg hover:shadow-indigo-500/20 hover:ring-4 hover:ring-indigo-500/10 transition-all duration-300 flex items-center justify-center group overflow-hidden"
            title="Add Person Manually"
          >
            <div className="flex items-center justify-center px-4 whitespace-nowrap">
              <span className="text-2xl font-light leading-none">+</span>
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 ease-in-out text-sm font-medium">
                Add Manual Network
              </span>
            </div>
          </button>
        )}

        {/* Manual Network Entry Modal */}
        {showManualEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="text-3xl">📝</span> Manual Network Entry
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-1 text-sm">
                    Add a person and their details to your network.
                  </p>
                </div>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">First Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="e.g. Sarah"
                      value={manualFirstName}
                      onChange={(e) => setManualFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Last Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="e.g. Connor"
                      value={manualLastName}
                      onChange={(e) => setManualLastName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Company</label>
                    <input
                      type="text"
                      className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="e.g. Cyberdyne Systems"
                      value={manualCompany}
                      onChange={(e) => setManualCompany(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Title</label>
                    <input
                      type="text"
                      className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="e.g. Director of Operations"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
                    Network Context / Notes
                    <span className="text-xs font-normal text-zinc-500 ml-2">(Relationships, key facts, how they fit in)</span>
                  </label>
                  <textarea
                    className="w-full border border-zinc-300 dark:border-zinc-700 px-3 py-2 rounded-md min-h-[100px] text-sm font-sans focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="e.g. Met at the Tech Summit. She knows the CEO of Company X and is looking for AI partnerships."
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                  />
                </div>

                {manualEntryMessage && (
                  <div className={`p-4 rounded-lg text-center ${manualEntryMessage.includes("Error") || manualEntryMessage.includes("failed")
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                    }`}>
                    {manualEntryMessage}
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl flex gap-3 justify-end">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualEntrySubmit}
                  disabled={isManualEntryLoading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isManualEntryLoading ? (
                    <>
                      <span className="animate-spin">⏳</span> Saving...
                    </>
                  ) : (
                    <>
                      <span>💾</span> Save to Network
                    </>
                  )}
                </button>
              </div>
            </div>
            {/* Backdrop click to close */}
            <div className="absolute inset-0 -z-10" onClick={() => setShowManualEntry(false)}></div>
          </div>
        )}
      </div>
    </div >
  );
}
