import { NextResponse } from "next/server";
import { callGemini } from "@/lib/geminiClient";

export async function POST(req: Request) {
  const { rawText } = await req.json();

  const prompt = `
Extract meetings, dates, action items, connections, and network relationships from the text below.  
Return ONLY a valid JSON object with these keys: meetings, actionItems, connections, networkMentions, extractedEntities.  

Example format:  
{
  "meetings": [{"person": "Talha", "date": "2026-01-15"}],
  "actionItems": ["Meet Talha again on Friday"],
  "connections": [{"person": "Talha", "relationship": "knows CEO of Company XX"}],
  "networkMentions": [
    {
      "personName": "CEO",
      "company": "Company XX",
      "title": "CEO",
      "context": "knows",
      "snippet": "Talha knows the CEO of Company XX"
    }
  ],
  "extractedEntities": {
    "people": ["Talha"],
    "companies": ["Company XX"],
    "titles": ["CEO"],
    "keywords": ["networking"]
  }
}

Text: """${rawText}"""

Return ONLY the JSON object, no other text.
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
