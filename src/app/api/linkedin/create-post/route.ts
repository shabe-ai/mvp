import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, title, description, imageUrl, linkUrl, postType, visibility, scheduledAt, prompt } = body;

    // Get user's LinkedIn integration
    const integration = await convex.query(api.linkedin.getLinkedInIntegration, { userId: user.id });

    if (!integration) {
      return NextResponse.json(
        { error: 'LinkedIn account not connected. Please connect your LinkedIn account first.' },
        { status: 400 }
      );
    }

    // Check if access token is expired
    if (integration.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'LinkedIn access token expired. Please reconnect your LinkedIn account.' },
        { status: 400 }
      );
    }

    // Get user's teams
    const teams = await convex.query(api.crm.getTeamsByUser, { userId: user.id });
    const teamId = teams?.[0]?._id;

    if (!teamId) {
      return NextResponse.json(
        { error: 'No team found for user' },
        { status: 400 }
      );
    }

    // Create LinkedIn post in database
    const postId = await convex.mutation(api.linkedin.createLinkedInPost, {
      userId: user.id,
      teamId,
      linkedinIntegrationId: integration._id,
      content,
      title,
      description,
      imageUrl,
      linkUrl,
      postType: postType || 'text',
      visibility: visibility || 'public',
      scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
      aiGenerated: true,
      prompt,
    });

    // If post is scheduled for now or in the past, publish it immediately
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      // TODO: Implement actual LinkedIn API call to publish post
      // For now, just mark as published
      await convex.mutation(api.linkedin.publishLinkedInPost, { postId });
    }

    return NextResponse.json({
      success: true,
      postId,
      message: scheduledAt ? 'Post scheduled successfully' : 'Post created successfully'
    });

  } catch (error) {
    console.error('LinkedIn post creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create LinkedIn post' },
      { status: 500 }
    );
  }
}
