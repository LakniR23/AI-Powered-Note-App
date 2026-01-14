import { connectDB } from "@/lib/mongodb";
import Note from "@/models/Note";
import Person from "@/models/Person";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await connectDB();

    let query = "";
    let personId = undefined;

    try {
      const body = await req.json();
      query = body.query || "";
      personId = body.personId;
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError);
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    console.log("Processing search query:", query, "for personId:", personId);

    // Calculate dates for relative terms
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const getDateForDay = (targetDay: number): Date => {
      const result = new Date(now);
      result.setHours(0, 0, 0, 0);
      const diff = targetDay - currentDay;
      result.setDate(result.getDate() + diff);
      return result;
    };

    const dateMap: { [key: string]: Date } = {
      'today': new Date(now.setHours(0, 0, 0, 0)),
      'tomorrow': new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      'yesterday': new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      'sunday': getDateForDay(0),
      'monday': getDateForDay(1),
      'tuesday': getDateForDay(2),
      'wednesday': getDateForDay(3),
      'thursday': getDateForDay(4),
      'friday': getDateForDay(5),
      'saturday': getDateForDay(6)
    };

    // Levenshtein distance for fuzzy matching
    const levenshtein = (a: string, b: string): number => {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              Math.min(
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
              )
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };

    // Helper: fuzzy match word against text
    const isFuzzyMatch = (text: string, term: string, threshold = 2): boolean => {
      if (text.includes(term)) return true;
      if (term.length < 4) return false; // Don't fuzzy match short words
      return levenshtein(text, term) <= threshold;
    };

    // Check if query contains relative date terms
    const queryLower = query.toLowerCase();
    let targetDate: Date | null = null;
    for (const [term, date] of Object.entries(dateMap)) {
      if (queryLower.includes(term)) {
        targetDate = date;
        console.log(`Found date term '${term}', mapped to:`, date);
        break;
      }
    }

    // Break down the query into keywords (filter out common words)
    // Remove punctuation from query for keyword generation
    const cleanQuery = queryLower.replace(/[.,?!:;"'()]/g, '');

    const stopWords = [
      'who', 'is', 'the', 'a', 'an', 'at', 'in', 'on', 'of', 'what', 'do', 'does', 'did',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'have', 'has', 'had', 'my', 'your',
      'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'find', 'search', 'show', 'me', 'list', 'are', 'not', 'can', 'could', 'would', 'will',
      'know', 'knows', 'knew', 'knowing', 'connection', 'connections', 'connected', 'relationship', 'linked', 'related',
      'person', 'people', 'someone', 'anyone', 'anybody', 'somebody', 'details', 'about', 'with', 'from', 'for'
    ];
    const keywords = cleanQuery
      .split(/\s+/)
      .filter((word: string) => !stopWords.includes(word) && word.length > 0);
    console.log("Keywords:", keywords);

    // Search results
    let personResults: any[] = [];
    let noteResults: any[] = [];

    // If personId is provided, only search that person's notes
    if (personId) {
      // Search Note database for this person only
      const notes = await Note.find({ personId });
      notes.forEach((note: any) => {
        let matches: any[] = [];
        let matchScore = 0;

        // Check rawText
        const textLower = note.rawText.toLowerCase();
        let textMatchAdded = false;
        keywords.forEach((keyword: string) => {
          if (textLower.includes(keyword)) {
            matchScore++;
            if (!textMatchAdded) {
              matches.push({
                type: 'textMatch',
                data: note.rawText,
                person: note.personId,
                keyword: keyword
              });
              textMatchAdded = true;
            }
          }
        });

        // Check meetings
        if (note.meetings && note.meetings.length > 0) {
          note.meetings.forEach((meeting: Date) => {
            const meetingDate = new Date(meeting);
            meetingDate.setHours(0, 0, 0, 0);

            // If we have a target date, match exactly
            if (targetDate) {
              const target = new Date(targetDate);
              target.setHours(0, 0, 0, 0);
              if (meetingDate.getTime() === target.getTime()) {
                matchScore += 5;
                matches.push({
                  type: 'meeting',
                  data: meeting,
                  person: note.personId
                });
              }
            } else {
              // Fallback to keyword matching
              const meetingStr = new Date(meeting).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase();
              const dayOfWeek = new Date(meeting).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

              keywords.forEach((keyword: string) => {
                if (meetingStr.includes(keyword) || dayOfWeek === keyword) {
                  matchScore += 2;
                  matches.push({
                    type: 'meeting',
                    data: meeting,
                    person: note.personId
                  });
                }
              });
            }
          });
        }

        // Check action items
        if (note.actionItems && note.actionItems.length > 0) {
          note.actionItems.forEach((item: string) => {
            const itemLower = item.toLowerCase();
            keywords.forEach((keyword: string) => {
              if (itemLower.includes(keyword)) {
                matchScore++;
                matches.push({
                  type: 'actionItem',
                  data: item,
                  person: note.personId
                });
              }
            });
          });
        }

        // Check connections
        if (note.connections && note.connections.length > 0) {
          note.connections.forEach((conn: any) => {
            const connStr = `${conn.name} ${conn.relationship}`.toLowerCase();
            keywords.forEach((keyword: string) => {
              if (connStr.includes(keyword)) {
                matchScore += 2;
                matches.push({
                  type: 'connection',
                  data: conn,
                  person: note.personId
                });
              }
            });
          });
        }



        // Check network mentions (NEW)
        if (note.networkMentions && note.networkMentions.length > 0) {
          note.networkMentions.forEach((mention: any) => {
            let mentionMatchScore = 0;
            const mentionStr = `${mention.personName || ''} ${mention.company || ''} ${mention.title || ''} ${mention.context || ''}`.toLowerCase();

            keywords.forEach((keyword: string) => {
              if (mentionStr.includes(keyword)) mentionMatchScore++;

              // Boost for specific field matches
              if (mention.company && mention.company.toLowerCase().includes(keyword)) mentionMatchScore += 2;
              if (mention.title && mention.title.toLowerCase().includes(keyword)) mentionMatchScore += 2;
              if (mention.personName && mention.personName.toLowerCase().includes(keyword)) mentionMatchScore += 1;
            });

            if (mentionMatchScore > 0) {
              matchScore += mentionMatchScore + 10; // High boost for relationship matches
              matches.push({
                type: 'networkMention',
                data: mention,
                person: note.personId,
                matchScore: mentionMatchScore,
                matchedKeywords: keywords.filter(k => mentionStr.includes(k))
              });
            }
          });
        }

        // Check extracted entities (NEW)
        if (note.extractedEntities) {
          const entities = note.extractedEntities;
          let entityMatchScore = 0;

          keywords.forEach((keyword: string) => {
            if (entities.companies?.some((c: string) => c.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
            if (entities.titles?.some((t: string) => t.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
            if (entities.people?.some((p: string) => p.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
          });

          if (entityMatchScore > 0) {
            matchScore += entityMatchScore;
            matches.push({
              type: 'entityMatch',
              data: entities,
              person: note.personId,
              matchScore: entityMatchScore
            });
          }
        }

        // DEDUPLICATION: If we have networkMentions, filter out textMatches
        // This prevents showing both the structured result and the raw text result for the same thing
        const hasNetworkMention = matches.some(m => m.type === 'networkMention');
        if (hasNetworkMention) {
          matches = matches.filter(m => m.type !== 'textMatch');
        }

        if (matchScore > 0 && matches.length > 0) {
          // STRICTER FILTERING FOR NETWORK MENTIONS
          // If query has multiple words, ensuring we don't match just one common word (e.g. "Company")
          // matching "Company X" when searching for "Company Y"
          if (keywords.length > 1) {
            matches = matches.filter(m => {
              if (m.type === 'networkMention') {
                // Check if we matched enough unique keywords
                const matchedCount = m.matchedKeywords ? m.matchedKeywords.length : 0;
                const coverage = matchedCount / keywords.length;
                // Require at least 50% keyword coverage or exact phrase match in snippet
                const snippetHasExactPhrase = m.data.snippet && m.data.snippet.toLowerCase().includes(queryLower);
                return coverage >= 0.5 || snippetHasExactPhrase;
              }
              return true;
            });
          }

          if (matches.length > 0) {
            noteResults.push({
              type: 'note',
              note: note,
              matches: matches,
              matchScore: matchScore,
              person: note.personId
            });
          }
        }
      });
    } else {
      // Global search across all people
      const people = await Person.find({});
      people.forEach((person: any) => {
        const personData = `${person.firstName} ${person.lastName} ${person.company} ${person.title}`.toLowerCase();

        // Count how many keywords match (with fuzzy)
        let matchedKeywords = keywords.filter((keyword: string) => isFuzzyMatch(personData, keyword));
        let matchCount = matchedKeywords.length;

        // Also check if any query word matches first name, last name, or title/company words
        const queryWords = queryLower.split(/\s+/).filter((word: string) => word.length > 0);
        queryWords.forEach((word: string) => {
          if (!stopWords.includes(word)) {
            // Check for fuzzy matches on name
            const firstNameMatch = isFuzzyMatch(person.firstName.toLowerCase(), word);
            const lastNameMatch = isFuzzyMatch(person.lastName.toLowerCase(), word);

            if (firstNameMatch || lastNameMatch) {
              matchCount += 2; // Boost for name matches
            }

            // Check for title/company word matches
            if (person.title && isFuzzyMatch(person.title.toLowerCase(), word)) {
              matchCount += 1;
            }
            if (person.company && isFuzzyMatch(person.company.toLowerCase(), word)) {
              matchCount += 1;
            }
          }
        });

        const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;

        // STRICTER THRESHOLD: Increased match ratio to 0.7 to avoid single-word matches in 2-word queries
        // e.g. "Person B" (2 words) -> "Person A" (matches "Person", ratio 0.5) -> REJECTED
        if ((matchRatio >= 0.7 && matchedKeywords.length > 0) || (matchCount >= 2 && keywords.length === 1)) {
          personResults.push({
            type: 'person',
            person: person,
            matchScore: matchCount,
            matchRatio: matchRatio,
            data: {
              name: `${person.firstName} ${person.lastName}`,
              title: person.title,
              company: person.company,
              email: person.email,
              phone: person.phone
            }
          });
        }
      });

      // Search notes for global search
      const notes = await Note.find({});
      notes.forEach((note: any) => {
        let matches: any[] = [];
        let matchScore = 0;

        // Check rawText (REFINED)
        const textLower = note.rawText.toLowerCase();
        let textMatchAdded = false;

        // Match full query first
        if (textLower.includes(queryLower)) {
          matchScore += 5;
          matches.push({
            type: 'textMatch',
            data: note.rawText,
            person: note.personId,
            keyword: queryLower
          });
          textMatchAdded = true;
        }

        // Match individual keywords
        keywords.forEach((keyword: string) => {
          if (textLower.includes(keyword)) {
            matchScore += 1;
            if (!textMatchAdded) {
              matches.push({
                type: 'textMatch',
                data: note.rawText,
                person: note.personId,
                keyword: keyword
              });
              textMatchAdded = true;
            }
          }
        });

        // Check meetings
        if (note.meetings && note.meetings.length > 0) {
          note.meetings.forEach((meeting: any) => {
            const meetingDate = new Date(meeting);
            meetingDate.setHours(0, 0, 0, 0);

            // If we have a target date, match exactly
            if (targetDate) {
              const target = new Date(targetDate);
              target.setHours(0, 0, 0, 0);
              if (meetingDate.getTime() === target.getTime()) {
                matchScore += 5;
                matches.push({
                  type: 'meeting',
                  data: meeting,
                  person: note.personId
                });
              }
            } else {
              // Fallback to keyword matching
              const meetingStr = new Date(meeting).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase();
              const dayOfWeek = new Date(meeting).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

              keywords.forEach((keyword: string) => {
                if (meetingStr.includes(keyword) || dayOfWeek === keyword) {
                  matchScore += 2;
                  matches.push({
                    type: 'meeting',
                    data: meeting,
                    person: note.personId
                  });
                }
              });
            }
          });
        }

        // Check action items
        if (note.actionItems && note.actionItems.length > 0) {
          note.actionItems.forEach((item: any) => {
            const itemLower = item.toLowerCase();
            keywords.forEach((keyword: string) => {
              if (itemLower.includes(keyword)) {
                matchScore++;
                matches.push({
                  type: 'actionItem',
                  data: item,
                  person: note.personId
                });
              }
            });
          });
        }

        // Check connections
        if (note.connections && note.connections.length > 0) {
          note.connections.forEach((conn: any) => {
            const connStr = `${conn.name} ${conn.relationship}`.toLowerCase();
            keywords.forEach((keyword: string) => {
              if (connStr.includes(keyword)) {
                matchScore += 2;
                matches.push({
                  type: 'connection',
                  data: conn,
                  person: note.personId
                });
              }
            });
          });
        }

        // Check network mentions (NEW)
        if (note.networkMentions && note.networkMentions.length > 0) {
          note.networkMentions.forEach((mention: any) => {
            let mentionMatchScore = 0;
            const mentionStr = `${mention.personName || ''} ${mention.company || ''} ${mention.title || ''} ${mention.context || ''}`.toLowerCase();

            const matchedKeywordsInMention: string[] = [];
            keywords.forEach((keyword: string) => {
              if (mentionStr.includes(keyword)) {
                mentionMatchScore++;
                matchedKeywordsInMention.push(keyword);
              }

              // Boost for specific field matches
              if (mention.company && mention.company.toLowerCase().includes(keyword)) mentionMatchScore += 3;
              if (mention.title && mention.title.toLowerCase().includes(keyword)) mentionMatchScore += 3;
              if (mention.personName && mention.personName.toLowerCase().includes(keyword)) mentionMatchScore += 5;
            });

            if (mentionMatchScore > 0) {
              matchScore += mentionMatchScore + 10; // High boost for relationship matches
              matches.push({
                type: 'networkMention',
                data: mention,
                person: note.personId,
                matchScore: mentionMatchScore,
                matchedKeywords: matchedKeywordsInMention
              });
            }
          });
        }

        // Check extracted entities (NEW)
        if (note.extractedEntities) {
          const entities = note.extractedEntities;
          let entityMatchScore = 0;

          keywords.forEach((keyword: string) => {
            if (entities.companies?.some((c: string) => c.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
            if (entities.titles?.some((t: string) => t.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
            if (entities.people?.some((p: string) => p.toLowerCase().includes(keyword))) {
              entityMatchScore += 5;
            }
          });

          if (entityMatchScore > 0) {
            matchScore += entityMatchScore;
            matches.push({
              type: 'entityMatch',
              data: entities,
              person: note.personId,
              matchScore: entityMatchScore
            });
          }
        }

        // DEDUPLICATION: If we have networkMentions, filter out textMatches
        // This prevents showing both the structured result and the raw text result for the same thing
        const hasNetworkMention = matches.some(m => m.type === 'networkMention');
        if (hasNetworkMention) {
          matches = matches.filter(m => m.type !== 'textMatch');
        } else {
          // If we ALSO have a direct person match result that is exactly this person, we might want to filter this out?
          // But here we are in the note search.
        }

        if (matchScore > 0 && matches.length > 0) {
          // STRICTER FILTERING FOR NETWORK MENTIONS IN GLOBAL SEARCH
          if (keywords.length > 1) {
            matches = matches.filter(m => {
              if (m.type === 'networkMention') {
                const matchedCount = m.matchedKeywords ? m.matchedKeywords.length : 0;
                const coverage = matchedCount / keywords.length;
                const snippetHasExactPhrase = m.data.snippet && m.data.snippet.toLowerCase().includes(queryLower);

                // HIGHER THRESHOLD: Require > 0.66 (e.g. 0.7) coverage to avoid "Company X" vs "Company Y" mismatches
                // For 3 keywords ("CEO", "Company", "X"), we need > 2 matches.
                return coverage > 0.7 || snippetHasExactPhrase;
              }
              return true;
            });
          }

          if (matches.length > 0) {
            noteResults.push({
              type: 'note',
              note: note,
              matches: matches,
              matchScore: matchScore,
              person: note.personId
            });
          }
        }
      });
    }

    // Sort note results by score (descending)
    noteResults.sort((a, b) => b.matchScore - a.matchScore);

    // Sort person results
    personResults.sort((a, b) => {
      // Prioritize exact ratio matches
      if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio;
      return b.matchScore - a.matchScore;
    });

    // --- NEW: Forward Connection Lookup ---
    // If we have person results, find who THEY know (connections appearing in their notes)
    // and add them as results.
    const forwardConnectionResults: any[] = [];
    if (personResults.length > 0) {
      const topPersonMatches = personResults.slice(0, 3); // Only traverse top 3 matches to avoid noise
      const topPersonIds = topPersonMatches.map(p => p.person._id);

      const personNotes = await Note.find({ personId: { $in: topPersonIds } });

      personNotes.forEach((note: any) => {
        const sourcePerson = topPersonMatches.find(p => p.person._id.toString() === note.personId.toString());
        if (!sourcePerson) return;

        // Check structured connections
        if (note.connections && note.connections.length > 0) {
          note.connections.forEach((conn: any) => {
            forwardConnectionResults.push({
              type: 'networkMention',
              person: sourcePerson.person, // The search match
              answer: conn.name, // The person they know
              connectorName: `${sourcePerson.person.firstName} ${sourcePerson.person.lastName}`,
              matchReason: conn.relationship || 'Connected',
              snippet: `Connects to ${conn.name}`,
              isForwardConnection: true // Flag to identify this path
            });
          });
        }

        // Check network mentions
        if (note.networkMentions && note.networkMentions.length > 0) {
          note.networkMentions.forEach((mention: any) => {
            if (mention.personName) {
              forwardConnectionResults.push({
                type: 'networkMention',
                person: sourcePerson.person,
                answer: mention.personName,
                connectorName: `${sourcePerson.person.firstName} ${sourcePerson.person.lastName}`,
                matchReason: mention.context || 'Network Mention',
                snippet: mention.snippet,
                isForwardConnection: true
              });
            }
          });
        }
      });
    }

    // Combine and format results
    const formattedResults: any[] = [];
    const addedAnswers = new Set<string>(); // For simple deduplication of identical strings

    // Prioritize Direct Person Results FIRST (as requested by user)
    personResults.forEach(result => {
      // ... (existing code)
      let answer = `${result.data.name}`;
      if (result.data.title && result.data.company) {
        answer += ` - ${result.data.title} at ${result.data.company}`;
      } else if (result.data.title) {
        answer += ` - ${result.data.title}`;
      } else if (result.data.company) {
        answer += ` - ${result.data.company}`;
      }

      formattedResults.push({
        type: 'personName',
        person: result.person,
        answer: answer
      });
    });

    // Prioritize Note/Connector results for network graph (Move notes before people)
    // First, collect all unique person IDs from results
    const personIds = new Set<string>();
    noteResults.forEach(result => {
      if (result.person) personIds.add(result.person.toString());
    });
    personResults.forEach(result => {
      if (result.person._id) personIds.add(result.person._id.toString());
    });

    // Fetch all needed persons at once
    const personsList = await Person.find({ _id: { $in: Array.from(personIds) } });
    const personMap = new Map();
    personsList.forEach(p => {
      personMap.set(p._id.toString(), p);
    });

    // Add Forward Connections (People known BY the search match)
    forwardConnectionResults.forEach(result => {
      const uniqueKey = `fwd-${result.answer}-${result.connectorName}`;
      if (addedAnswers.has(uniqueKey)) return;
      addedAnswers.add(uniqueKey);
      formattedResults.push(result);
    });

    // Add note-based connector results SECOND (Reverse Connections / Mentions)
    noteResults.forEach(result => {
      result.matches.forEach((match: any) => {
        const personData = personMap.get(match.person.toString());
        if (!personData) return;

        // Create a unique key for deduplication
        const uniqueKey = `${match.type}-${personData._id}-${match.keyword || match.data.snippet || match.data.name || ''}`;
        if (addedAnswers.has(uniqueKey)) return;
        addedAnswers.add(uniqueKey);

        if (match.type === 'textMatch') {
          formattedResults.push({
            type: 'networkMention',
            person: personData,
            answer: `${personData.firstName} ${personData.lastName}`,
            connectorName: `${personData.firstName} ${personData.lastName}`,
            matchReason: `Mentioned: ${match.keyword}`,
            snippet: match.data,
            matchedEntity: { personName: match.keyword }
          });
        } else if (match.type === 'networkMention') {
          const mention = match.data;
          const context = mention.context ? ` (${mention.context})` : '';
          const parts = [];
          if (mention.company) parts.push(mention.company);
          if (mention.title) parts.push(mention.title);
          if (mention.personName) parts.push(mention.personName);

          formattedResults.push({
            type: 'networkMention',
            person: personData,
            answer: `${personData.firstName} ${personData.lastName}`,
            connectorName: `${personData.firstName} ${personData.lastName}`,
            matchReason: `${parts.join(' / ')}${context}`,
            snippet: mention.snippet || '',
            matchedEntity: mention
          });
        }
        // ... include other types if needed ...
        else if (match.type === 'connection') {
          formattedResults.push({
            type: 'connection',
            person: personData,
            answer: `${match.data.name}: ${match.data.relationship}`
          });
        } else if (match.type === 'meeting') {
          formattedResults.push({
            type: 'meeting',
            person: personData,
            answer: `Meet ${personData.firstName} ${personData.lastName} on ${new Date(match.data).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
          });
        } else if (match.type === 'actionItem') {
          formattedResults.push({
            type: 'actionItem',
            person: personData,
            answer: match.data
          });
        }
      });
    });

    // Final filtering/deduplication if needed
    if (queryLower.includes('who is') || queryLower.includes('who\'s')) {
      // Only show the direct person if it's a "who is" query
      if (personResults.length > 0) {
        return NextResponse.json({
          success: true,
          data: formattedResults.filter(r => r.type === 'personName').slice(0, 1),
          totalResults: 1
        });
      }
    }

    console.log(`Found ${formattedResults.length} results`);

    return NextResponse.json({
      success: true,
      data: formattedResults,
      totalResults: formattedResults.length
    });
  } catch (error) {
    console.error("Error searching:", error);
    const errorMessage = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
