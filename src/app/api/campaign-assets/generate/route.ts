import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { campaignAssetGenerator, AssetGenerationRequest } from '@/lib/campaignAssetGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { assetTypes, campaignTopic, targetAudience, campaignGoals, tone } = body;

    // Validate required fields
    if (!assetTypes || !Array.isArray(assetTypes) || assetTypes.length === 0) {
      return NextResponse.json(
        { error: "Asset types are required and must be an array" },
        { status: 400 }
      );
    }

    if (!campaignTopic || typeof campaignTopic !== 'string') {
      return NextResponse.json(
        { error: "Campaign topic is required" },
        { status: 400 }
      );
    }

    // Limit to 5 assets maximum
    const limitedAssetTypes = assetTypes.slice(0, 5);

    logger.info('Generating campaign assets', {
      userId,
      assetTypes: limitedAssetTypes,
      campaignTopic
    });

    const generationRequest: AssetGenerationRequest = {
      assetTypes: limitedAssetTypes,
      campaignTopic,
      targetAudience,
      campaignGoals,
      tone,
      userId
    };

    const generatedAssets = await campaignAssetGenerator.generateAssets(generationRequest);

    logger.info('Campaign assets generated successfully', {
      userId,
      assetCount: generatedAssets.length
    });

    return NextResponse.json({
      success: true,
      assets: generatedAssets,
      message: `Successfully generated ${generatedAssets.length} campaign assets`
    });

  } catch (error) {
    logger.error('Error generating campaign assets', error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate campaign assets",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
