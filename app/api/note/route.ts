import { connectDB } from "@/lib/mongodb";
import Note from "@/models/Note";
import { NextResponse } from "next/server";
import { callGemini } from "@/lib/geminiClient";

export async function POST(req: Request) {
  try {
    await connectDB();
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
        const extractPrompt = `
Extract meetings, dates, action items, and connections from the text below.  
Return ONLY a valid JSON object with these keys: meetings, actionItems, connections.  

Rules:
- For meetings: extract any mention of meeting someone with dates. If "tomorrow" is mentioned, use the date 2026-01-13.
- For actionItems: extract any tasks or things to do mentioned.
- For connections: extract relationships between people mentioned.

Example format:  
{
  "meetings": [{"person": "Kasun Fernando", "date": "2026-01-13"}],
  "actionItems": ["Meet Kasun Fernando tomorrow"],
  "connections": [{"person": "Kasun Fernando", "relationship": "Person to meet"}]
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
      meetings: extractedData.meetings?.map((m: any) => {
        const date = new Date(m.date);
        return isNaN(date.getTime()) ? null : date;
      }).filter((d: any) => d !== null) || [],
      connections: extractedData.connections?.map((c: any) => ({
        name: c.person || c.name || "",
        relationship: c.knows || c.relationship || ""
      })).filter((c: any) => c.name) || [],
    };

    console.log("Creating note with data:", JSON.stringify(noteData, null, 2));
    const note = await Note.create(noteData);
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
    await connectDB();
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get('personId');
    
    console.log("Fetching notes for personId:", personId);
    const query = personId ? { personId } : {};
    const notes = await Note.find(query).sort({ createdAt: -1 });
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
    await connectDB();
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');
    
    if (!noteId) {
      return NextResponse.json(
        { success: false, error: "Note ID is required" },
        { status: 400 }
      );
    }
    
    const deletedNote = await Note.findByIdAndDelete(noteId);
    
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
