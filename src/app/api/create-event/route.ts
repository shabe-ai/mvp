import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, startTime, endTime, attendees } = body;

    // Log the event creation request
    console.log("Creating event:", {
      title,
      description,
      startTime,
      endTime,
      attendees,
      timestamp: new Date().toISOString()
    });

    // Simulate event creation (in a real app, this would save to a database)
    const eventId = `event_${Date.now()}`;
    const createdEvent = {
      id: eventId,
      title,
      description,
      startTime,
      endTime,
      attendees,
      createdAt: new Date().toISOString(),
      status: "created"
    };

    // Log successful creation
    console.log("✅ Event created successfully:", eventId);

    // Return the created event with confirmation
    return NextResponse.json({
      success: true,
      message: "Event created successfully",
      event: createdEvent,
      eventId
    });

  } catch (error) {
    console.error("❌ Error creating event:", error);
    
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create event",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
