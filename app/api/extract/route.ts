import { NextResponse } from "next/server";
import { callGemini } from "@/lib/geminiClient";

export async function POST(req: Request) {
  const { rawText } = await req.json();

  const prompt = `
Extract meetings, dates, action items, and connections from the text below.  
Return ONLY a JSON object with these keys: meetings, actionItems, connections.  
Example format:  
{
  "meetings": [{"person": "Talha", "date": "2026-01-15"}],
  "actionItems": ["Meet Talha again on Friday"],
  "connections": [{"person": "Talha", "knows": "CEO of Company XX"}]
}

Text: """${rawText}"""
`;

  const messages = [{ role: "user", content: prompt }];

  try {
    const content = await callGemini(messages);
    // Parse JSON from content
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}") + 1;
    const jsonString = content.substring(jsonStart, jsonEnd);
    const extracted = JSON.parse(jsonString);
    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error("Error extracting data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
