import { connectDB } from "@/lib/mongodb";
import Person from "@/models/Person";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await connectDB();
    const data = await req.json();
    const person = await Person.create(data);
    return NextResponse.json({ success: true, data: person });
  } catch (error: any) {
    console.error("Error creating person:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    const people = await Person.find();
    return NextResponse.json({ success: true, data: people });
  } catch (error: any) {
    console.error("Error fetching people:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
