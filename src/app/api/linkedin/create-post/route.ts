import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { LinkedInAPI } from "../../../../lib/linkedinApi";

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

    // Create LinkedIn post in database first
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
      try {
        // Initialize LinkedIn API
        const linkedinApi = new LinkedInAPI(integration.accessToken);

        // Create the post on LinkedIn
        const linkedinPostData = {
          content,
          title,
          description,
          imageUrl,
          linkUrl,
          visibility: visibility || 'public',
        };

        const linkedinResponse = await linkedinApi.createPost(linkedinPostData);

        // Update the post with LinkedIn response
        await convex.mutation(api.linkedin.updateLinkedInPost, {
          postId,
          updates: {
            status: 'published',
            publishedAt: Date.now(),
            linkedinPostId: linkedinResponse.postId,
            linkedinResponse: linkedinResponse.response,
          },
        });

        return NextResponse.json({
          success: true,
          postId,
          linkedinPostId: linkedinResponse.postId,
          message: 'Post published successfully on LinkedIn'
        });

      } catch (linkedinError) {
        // Update post status to failed
        await convex.mutation(api.linkedin.updateLinkedInPost, {
          postId,
          updates: {
            status: 'failed',
            linkedinResponse: { error: linkedinError instanceof Error ? linkedinError.message : 'Unknown error' },
          },
        });

        console.error('LinkedIn API error:', linkedinError);
        return NextResponse.json(
          { 
            error: 'Failed to publish post on LinkedIn. Please try again.',
            details: linkedinError instanceof Error ? linkedinError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else {
      // Post is scheduled for future
      return NextResponse.json({
        success: true,
        postId,
        message: 'Post scheduled successfully'
      });
    }

  } catch (error) {
    console.error('LinkedIn post creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create LinkedIn post' },
      { status: 500 }
    );
  }
}
