import { connectDB } from "@/lib/mongodb";
import Note from "@/models/Note";
import Person from "@/models/Person";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { query, personId } = await req.json();

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
    const stopWords = ['who', 'is', 'the', 'a', 'an', 'at', 'in', 'on', 'what', 'do', 'i', 'have', 'my', 'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const keywords = queryLower
      .split(/\s+/)
      .filter(word => !stopWords.includes(word) && word.length > 0);
    console.log("Keywords:", keywords);

    // Search results
    let personResults: any[] = [];
    let noteResults: any[] = [];

    // If personId is provided, only search that person's notes
    if (personId) {
      // Search Note database for this person only
      const notes = await Note.find({ personId }).populate('personId');
      notes.forEach((note: any) => {
        let matches: any[] = [];
        let matchScore = 0;

        // Check rawText
        const textLower = note.rawText.toLowerCase();
        keywords.forEach(keyword => {
          if (textLower.includes(keyword)) matchScore++;
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
              
              keywords.forEach(keyword => {
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
            keywords.forEach(keyword => {
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
            keywords.forEach(keyword => {
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

        if (matchScore > 0) {
          noteResults.push({
            type: 'note',
            note: note,
            matches: matches,
            matchScore: matchScore,
            person: note.personId
          });
        }
      });
    } else {
      // Global search across all people
      const people = await Person.find({});
      people.forEach((person: any) => {
        const personData = `${person.firstName} ${person.lastName} ${person.company} ${person.title}`.toLowerCase();
        
        // Count how many keywords match
        const matchedKeywords = keywords.filter(keyword => personData.includes(keyword));
        const matchCount = matchedKeywords.length;
        const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;
        
        // Only include if most keywords match
        if (matchRatio >= 0.5 && matchCount > 0) {
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
      const notes = await Note.find({}).populate('personId');
      notes.forEach((note: any) => {
        let matches: any[] = [];
        let matchScore = 0;

        // Check rawText
        const textLower = note.rawText.toLowerCase();
        keywords.forEach(keyword => {
          if (textLower.includes(keyword)) matchScore++;
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
              
              keywords.forEach(keyword => {
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
            keywords.forEach(keyword => {
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
            keywords.forEach(keyword => {
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

        if (matchScore > 0) {
          noteResults.push({
            type: 'note',
            note: note,
            matches: matches,
            matchScore: matchScore,
            person: note.personId
          });
        }
      });
    }

    // Sort by match ratio first, then by score
    personResults.sort((a, b) => {
      if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio;
      return b.matchScore - a.matchScore;
    });
    noteResults.sort((a, b) => b.matchScore - a.matchScore);

    // Filter based on query type (using queryLower defined at the top)
    if (queryLower.includes('who is') || queryLower.includes('who\'s')) {
      if (personResults.length > 0) {
        personResults = [personResults[0]]; // Only the top match
        noteResults = []; // No notes for "who is" queries
      }
    }

    // For meeting queries, only show meetings
    if (queryLower.includes('meeting')) {
      personResults = [];
      noteResults = noteResults.filter(r => 
        r.matches.some((m: any) => m.type === 'meeting')
      );
    }

    // For action queries, only show action items
    if (queryLower.includes('action') || queryLower.includes('task') || queryLower.includes('todo')) {
      personResults = [];
      noteResults = noteResults.filter(r => 
        r.matches.some((m: any) => m.type === 'actionItem')
      );
    }

    // Combine and format results
    const formattedResults: any[] = [];

    // Add person results
    personResults.forEach(result => {
      formattedResults.push({
        type: 'personName',
        person: result.person,
        answer: `${result.data.name}`
      });
    });

    // Add note results with specific answers
    noteResults.forEach(result => {
      result.matches.forEach((match: any) => {
        if (match.type === 'meeting') {
          formattedResults.push({
            type: 'meeting',
            person: match.person,
            answer: `Meet ${match.person.firstName} ${match.person.lastName} on ${new Date(match.data).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
          });
        } else if (match.type === 'connection') {
          formattedResults.push({
            type: 'connection',
            person: match.person,
            answer: `${match.data.name}: ${match.data.relationship}`
          });
        } else if (match.type === 'actionItem') {
          formattedResults.push({
            type: 'actionItem',
            person: match.person,
            answer: match.data
          });
        }
      });
    });

    console.log(`Found ${formattedResults.length} results`);

    return NextResponse.json({ 
      success: true, 
      data: formattedResults,
      totalResults: formattedResults.length
    });
  } catch (error: any) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
