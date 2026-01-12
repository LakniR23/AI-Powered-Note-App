import { createNote, getAllNotes, getNotesByPersonId, deleteNote } from "@/lib/fileStorage";
import { NextResponse } from "next/server";
import { callGemini } from "@/lib/geminiClient";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Extract structured data from text
    let extractedData: any = {
      actionItems: [],
      meetings: [],
      connections: []
    };

    if (data.rawText && data.rawText.trim().length > 0) {
      try {
        console.log("Extracting data from text note...");
        
        // Calculate dates for tomorrow and days of the week
        const today = new Date('2026-01-12');
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        // Calculate dates for each day of the current week
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekDates: { [key: string]: string } = {};
        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          const currentDay = today.getDay();
          const diff = i - currentDay;
          date.setDate(date.getDate() + diff);
          weekDates[dayNames[i]] = date.toISOString().split('T')[0];
        }
        
        const extractPrompt = `
Extract meetings, dates, action items, and connections from the text below.  
Return ONLY a valid JSON object with these keys: meetings, actionItems, connections.  

Current date reference: 2026-01-12 (Sunday)
Date conversions to use:
- "tomorrow" = ${tomorrowStr}
- "Monday" = ${weekDates['Monday']}
- "Tuesday" = ${weekDates['Tuesday']}
- "Wednesday" = ${weekDates['Wednesday']}
- "Thursday" = ${weekDates['Thursday']}
- "Friday" = ${weekDates['Friday']}
- "Saturday" = ${weekDates['Saturday']}
- "Sunday" = ${weekDates['Sunday']}

Rules:
- For meetings: extract any mention of meeting someone with dates. Convert day names to actual dates using the conversions above.
- For actionItems: extract any tasks or things to do mentioned.
- For connections: extract relationships between people mentioned.

Example format:  
{
  "meetings": [{"person": "John Doe", "date": "${tomorrowStr}"}],
  "actionItems": ["Meet John Doe tomorrow"],
  "connections": [{"person": "John Doe", "relationship": "Person to meet"}]
}

Text: """${data.rawText}"""

Return ONLY the JSON object, no other text.
`;

        const extractMessages = [{ role: "user", content: extractPrompt }];
        const extractedContent = await callGemini(extractMessages);
        console.log("Raw extracted content:", extractedContent);
        
        // Parse JSON from content
        try {
          const jsonStart = extractedContent.indexOf("{");
          const jsonEnd = extractedContent.lastIndexOf("}") + 1;
          
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonString = extractedContent.substring(jsonStart, jsonEnd);
            console.log("JSON string to parse:", jsonString);
            extractedData = JSON.parse(jsonString);
            console.log("Successfully parsed extracted data:", JSON.stringify(extractedData, null, 2));
          } else {
            console.error("No JSON object found in response");
          }
        } catch (parseError: any) {
          console.error("JSON parse error:", parseError.message);
          console.error("Content that failed to parse:", extractedContent);
        }
      } catch (extractionError: any) {
        console.error("Extraction error:", extractionError);
      }
    }

    // Create note with extracted data
    const noteData = {
      ...data,
      actionItems: extractedData.actionItems || [],
      meetings: extractedData.meetings?.map((m: any) => m.date).filter((d: any) => d) || [],
      connections: extractedData.connections?.map((c: any) => ({
        name: c.person || c.name || "",
        relationship: c.knows || c.relationship || ""
      })).filter((c: any) => c.name) || [],
    };

    console.log("Creating note with data:", JSON.stringify(noteData, null, 2));
    const note = await createNote(noteData);
    console.log("Note created successfully:", note._id);
    return NextResponse.json({ success: true, data: note });
  } catch (error: any) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get('personId');
    
    console.log("Fetching notes for personId:", personId);
    const notes = personId ? await getNotesByPersonId(personId) : await getAllNotes();
    // Sort by createdAt descending
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    console.log(`Found ${notes.length} notes`);
    return NextResponse.json({ success: true, data: notes });
  } catch (error: any) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');
    
    if (!noteId) {
      return NextResponse.json(
        { success: false, error: "Note ID is required" },
        { status: 400 }
      );
    }
    
    const deletedNote = await deleteNote(noteId);
    
    if (!deletedNote) {
      return NextResponse.json(
        { success: false, error: "Note not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: deletedNote });
  } catch (error: any) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
