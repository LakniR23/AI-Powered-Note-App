import { getAllPersons, createPerson, deletePerson } from "@/lib/fileStorage";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const person = await createPerson(data);
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
    const people = await getAllPersons();
    return NextResponse.json({ success: true, data: people });
  } catch (error: any) {
    console.error("Error fetching people:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get('personId');
    
    if (!personId) {
      return NextResponse.json(
        { success: false, error: "Person ID is required" },
        { status: 400 }
      );
    }
    
    const deletedPerson = await deletePerson(personId);
    
    if (!deletedPerson) {
      return NextResponse.json(
        { success: false, error: "Person not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: deletedPerson });
  } catch (error: any) {
    console.error("Error deleting person:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
