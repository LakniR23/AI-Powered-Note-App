import { connectDB } from "@/lib/mongodb";
import Note from "@/models/Note";
import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcribeAudio";
import { callGemini } from "@/lib/geminiClient";

export async function POST(req: Request) {
  try {
    await connectDB();

    const formData = await req.formData();
    const personId = formData.get("personId") as string;
    const rawText = formData.get("rawText") as string;
    const audioFile = formData.get("audioFile") as File;

    if (!personId || !audioFile) {
      return NextResponse.json(
        { success: false, error: "Person ID and audio file are required" },
        { status: 400 }
      );
    }

    // Convert audio file to buffer and base64
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Audio = buffer.toString('base64');
    const audioDataUrl = `data:${audioFile.type};base64,${base64Audio}`;

    // Transcribe audio using Gemini
    let transcribedText = rawText || "Voice note";
    let extractedData: any = {
      actionItems: [],
      meetings: [],
      connections: []
    };

    try {
      console.log("Transcribing audio...");
      transcribedText = await transcribeAudio(buffer);
      console.log("Transcription complete:", transcribedText);

      // Extract structured data from transcription
      console.log("Extracting data from transcription...");

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
Text: """${transcribedText}"""

Extract meetings, dates, action items, connections, and network relationships strictly from the provided text.

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
1. ONLY extract information that is explicitly stated in the text. Do not Hallucinate or guess.
2. If no meetings, action items, or mentions are found, return empty arrays.
3. For networkMentions: extract detailed information about people, companies, and roles mentioned:
   - personName: The name of the person mentioned (or their role like "CEO" if name not given)
   - company: Any company name mentioned in relation to this person
   - title: Job title or role (CEO, CTO, Founder, Manager, etc.)
   - context: Relationship context (knows, works with, met, friend of, etc.)
   - snippet: The exact sentence or phrase from the text
4. For extractedEntities: List all unique entities found:
   - people: All person names mentioned
   - companies: All company names mentioned
   - titles: All job titles/roles mentioned
   - keywords: Other important keywords or topics

Return ONLY JSON. No markdown formatting.
JSON Structure:
{
  "meetings": [{"person": "Name", "date": "YYYY-MM-DD"}],
  "actionItems": ["Task description"],
  "connections": [{"name": "Name", "relationship": "Relationship description"}],
  "networkMentions": [
    {
      "personName": "Name",
      "company": "Company",
      "title": "Title",
      "context": "Context",
      "snippet": "Original text snippet"
    }
  ],
  "extractedEntities": {
    "people": [],
    "companies": [],
    "titles": [],
    "keywords": []
  }
}

Return ONLY the JSON object, no other text.
`;

      const extractMessages = [{ role: "user", content: extractPrompt }];
      const extractedContent = await callGemini(extractMessages);
      console.log("Raw extracted content:", extractedContent);

      // Parse JSON from content - try to find and parse the JSON
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
    } catch (transcriptionError: any) {
      console.error("Transcription/extraction error:", transcriptionError);
      console.error("Full error:", transcriptionError);
      // Continue with default values if transcription fails
    }

    // Create note with audio as base64 data URL and extracted data
    const note = await Note.create({
      personId,
      rawText: transcribedText,
      audioFile: audioDataUrl,
      actionItems: extractedData.actionItems || [],
      meetings: extractedData.meetings?.map((m: any) => {
        const date = new Date(m.date);
        return isNaN(date.getTime()) ? null : date;
      }).filter((d: any) => d !== null) || [],
      connections: extractedData.connections?.map((c: any) => ({
        name: c.person || c.name || "",
        relationship: c.knows || c.relationship || ""
      })).filter((c: any) => c.name) || [],
      // Add network mentions
      networkMentions: extractedData.networkMentions?.map((nm: any) => ({
        personName: nm.personName || "",
        company: nm.company || "",
        title: nm.title || "",
        context: nm.context || "",
        snippet: nm.snippet || ""
      })).filter((nm: any) => nm.personName || nm.company || nm.title) || [],
      // Add extracted entities
      extractedEntities: {
        people: extractedData.extractedEntities?.people || [],
        companies: extractedData.extractedEntities?.companies || [],
        titles: extractedData.extractedEntities?.titles || [],
        keywords: extractedData.extractedEntities?.keywords || []
      }
    });

    return NextResponse.json({ success: true, data: note });
  } catch (error: any) {
    console.error("Error uploading audio:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
