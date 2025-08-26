import { openaiClient } from './openaiClient';
import { logger } from './logger';

export interface AssetGenerationRequest {
  assetTypes: string[];
  campaignTopic: string;
  targetAudience?: string;
  campaignGoals?: string[];
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative';
  userId: string;
}

export interface GeneratedAsset {
  id: string;
  type: string;
  title: string;
  content: string;
  status: 'draft' | 'ready' | 'published';
  metadata?: {
    wordCount?: number;
    estimatedReadTime?: number;
    hashtags?: string[];
    callToAction?: string;
  };
}

export class CampaignAssetGenerator {
  
  async generateAssets(request: AssetGenerationRequest): Promise<GeneratedAsset[]> {
    const { assetTypes, campaignTopic, targetAudience, campaignGoals, tone, userId } = request;
    
    logger.info('Starting asset generation', {
      assetTypes,
      campaignTopic,
      userId
    });

    const generatedAssets: GeneratedAsset[] = [];

    for (const assetType of assetTypes) {
      try {
        const asset = await this.generateSingleAsset(assetType, {
          campaignTopic,
          targetAudience,
          campaignGoals,
          tone,
          userId
        });
        
        generatedAssets.push(asset);
      } catch (error) {
        logger.error('Error generating asset', error instanceof Error ? error : new Error(String(error)), {
          assetType,
          campaignTopic,
          userId
        });
        
        // Add fallback asset if generation fails
        generatedAssets.push(this.createFallbackAsset(assetType, campaignTopic));
      }
    }

    return generatedAssets;
  }

  private async generateSingleAsset(
    assetType: string, 
    context: {
      campaignTopic: string;
      targetAudience?: string;
      campaignGoals?: string[];
      tone?: string;
      userId: string;
    }
  ): Promise<GeneratedAsset> {
    const { campaignTopic, targetAudience, campaignGoals, tone, userId } = context;

    const prompt = this.buildPrompt(assetType, {
      campaignTopic,
      targetAudience,
      campaignGoals,
      tone
    });

    const response = await openaiClient.chatCompletionsCreate({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert marketing content creator. Create engaging, professional content that drives results.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }, {
      userId,
      operation: 'campaign_asset_generation'
    });

    const content = response.choices[0]?.message?.content || '';
    const parsedContent = this.parseGeneratedContent(assetType, content);

    return {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: assetType,
      title: this.generateAssetTitle(assetType, campaignTopic),
      content: parsedContent,
      status: 'draft',
      metadata: this.generateMetadata(assetType, parsedContent)
    };
  }

  private buildPrompt(assetType: string, context: {
    campaignTopic: string;
    targetAudience?: string;
    campaignGoals?: string[];
    tone?: string;
  }): string {
    const { campaignTopic, targetAudience, campaignGoals, tone } = context;

    const basePrompt = `Create a ${assetType.replace('_', ' ')} for a campaign about: "${campaignTopic}"`;

    const audiencePrompt = targetAudience ? `Target audience: ${targetAudience}` : '';
    const goalsPrompt = campaignGoals?.length ? `Campaign goals: ${campaignGoals.join(', ')}` : '';
    const tonePrompt = tone ? `Tone: ${tone}` : 'Tone: Professional but engaging';

    const assetSpecificPrompts = {
      email: `
${basePrompt}

${audiencePrompt}
${goalsPrompt}
${tonePrompt}

Create a compelling email with:
- An attention-grabbing subject line
- Professional greeting
- Clear value proposition
- Strong call-to-action
- Professional closing

Format as:
Subject: [Subject Line]

[Email Body]`,

      blog: `
${basePrompt}

${audiencePrompt}
${goalsPrompt}
${tonePrompt}

Create a blog post with:
- Compelling headline
- Introduction that hooks the reader
- 3-4 main points with supporting content
- Conclusion with call-to-action
- Relevant hashtags

Format as markdown with proper headings.`,

      linkedin_post: `
${basePrompt}

${audiencePrompt}
${goalsPrompt}
${tonePrompt}

Create a LinkedIn post with:
- Engaging opening line
- Professional tone
- Industry insights
- Call-to-action
- 3-5 relevant hashtags

Keep it under 1300 characters.`,

      social_post: `
${basePrompt}

${audiencePrompt}
${goalsPrompt}
${tonePrompt}

Create a social media post with:
- Attention-grabbing opening
- Engaging content
- Call-to-action
- 3-5 relevant hashtags
- Emoji usage for engagement

Keep it under 280 characters.`,

      landing_page: `
${basePrompt}

${audiencePrompt}
${goalsPrompt}
${tonePrompt}

Create a landing page with:
- Compelling headline
- Value proposition
- Key benefits (3-4 points)
- Social proof section
- Strong call-to-action
- Contact information

Format as markdown.`
    };

    return assetSpecificPrompts[assetType as keyof typeof assetSpecificPrompts] || basePrompt;
  }

  private parseGeneratedContent(assetType: string, content: string): string {
    // Clean up the generated content
    let cleanedContent = content.trim();
    
    // Remove any extra formatting or artifacts
    cleanedContent = cleanedContent.replace(/^```\w*\n?/, '').replace(/```$/, '');
    
    return cleanedContent;
  }

  private generateAssetTitle(assetType: string, campaignTopic: string): string {
    const titles = {
      email: `Campaign Email: ${campaignTopic}`,
      blog: `Blog Post: ${campaignTopic}`,
      linkedin_post: `LinkedIn Post: ${campaignTopic}`,
      social_post: `Social Media Post: ${campaignTopic}`,
      landing_page: `Landing Page: ${campaignTopic}`
    };
    
    return titles[assetType as keyof typeof titles] || `Asset: ${campaignTopic}`;
  }

  private generateMetadata(assetType: string, content: string): any {
    const wordCount = content.split(/\s+/).length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // 200 words per minute
    
    const metadata: any = {
      wordCount,
      estimatedReadTime
    };

    // Extract hashtags
    const hashtags = content.match(/#\w+/g) || [];
    if (hashtags.length > 0) {
      metadata.hashtags = hashtags;
    }

    // Extract call-to-action
    const ctaPatterns = [
      /(?:call|contact|reach out|get in touch|learn more|sign up|download|start|begin)/i
    ];
    
    for (const pattern of ctaPatterns) {
      const match = content.match(pattern);
      if (match) {
        metadata.callToAction = match[0];
        break;
      }
    }

    return metadata;
  }

  private createFallbackAsset(assetType: string, campaignTopic: string): GeneratedAsset {
    const fallbackContent = this.getFallbackContent(assetType, campaignTopic);
    
    return {
      id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: assetType,
      title: this.generateAssetTitle(assetType, campaignTopic),
      content: fallbackContent,
      status: 'draft',
      metadata: {
        wordCount: fallbackContent.split(/\s+/).length,
        estimatedReadTime: 1
      }
    };
  }

  private getFallbackContent(assetType: string, campaignTopic: string): string {
    const fallbackContent = {
      email: `Subject: ${campaignTopic} - Let's Connect\n\nDear [Recipient Name],\n\nI hope this email finds you well. I wanted to reach out regarding ${campaignTopic} and explore how we might work together.\n\n[AI-generated content will be inserted here]\n\nI'd love to schedule a brief call to discuss this further. What works best for you?\n\nBest regards,\n[Your Name]`,
      
      blog: `# ${campaignTopic}\n\n## Introduction\n\n${campaignTopic} is transforming how businesses operate in today's digital landscape.\n\n## Key Benefits\n\n- Benefit 1\n- Benefit 2\n- Benefit 3\n\n## Conclusion\n\nReady to explore ${campaignTopic} for your business?`,
      
      linkedin_post: `🚀 Excited to share insights about ${campaignTopic}!\n\nThis topic is revolutionizing how we approach business challenges.\n\n#${campaignTopic.replace(/\s+/g, '')} #BusinessGrowth #Innovation`,
      
      social_post: `🔥 Hot take on ${campaignTopic}!\n\nThis is changing everything! What are your thoughts? 👇\n\n#${campaignTopic.replace(/\s+/g, '')}`,
      
      landing_page: `# ${campaignTopic}\n\n## Transform Your Business\n\nDiscover how ${campaignTopic} can revolutionize your operations.\n\n[Call-to-Action Button]`
    };

    return fallbackContent[assetType as keyof typeof fallbackContent] || 
           `Content for ${assetType} about ${campaignTopic} will be generated here.`;
  }
}

export const campaignAssetGenerator = new CampaignAssetGenerator();
