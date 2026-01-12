import { connectDB } from "@/lib/mongodb";
import Note from "@/models/Note";
import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
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

    // Create unique filename
    const timestamp = Date.now();
    const fileName = `${personId}_${timestamp}_${audioFile.name}`;
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads directory
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const filePath = join(uploadsDir, fileName);
    
    // Ensure directory exists
    const fs = require("fs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    await writeFile(filePath, buffer);

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

Text: """${transcribedText}"""

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

    // Create note with audio file path and extracted data
    const note = await Note.create({
      personId,
      rawText: transcribedText,
      audioFile: `/uploads/${fileName}`,
      actionItems: extractedData.actionItems || [],
      meetings: extractedData.meetings?.map((m: any) => {
        const date = new Date(m.date);
        return isNaN(date.getTime()) ? null : date;
      }).filter((d: any) => d !== null) || [],
      connections: extractedData.connections?.map((c: any) => ({
        name: c.person || c.name || "",
        relationship: c.knows || c.relationship || ""
      })).filter((c: any) => c.name) || [],
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
