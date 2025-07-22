import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      teamId,
      createdBy,
      type,
      subject,
      description,
      contactId,
      accountId,
      dealId,
      status,
      startTime,
      endTime,
      attendees,
      customFields,
    } = body;
    if (!teamId || !createdBy || !type || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const activityId = await convex.mutation(api.crm.createActivity, {
      teamId,
      createdBy,
      type,
      subject,
      description,
      contactId,
      accountId,
      dealId,
      status: status || "scheduled",
      startTime,
      endTime,
      attendees,
      customFields,
    });
    return NextResponse.json({ success: true, activityId });
  } catch (error) {
    console.error("Error logging activity:", error);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
} 