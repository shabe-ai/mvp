import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/lib/openaiClient';

export async function POST(request: NextRequest) {
  try {
    const { content, userId } = await request.json();

    // Use the AI to generate LinkedIn post content
    const prompt = `Create a professional LinkedIn post about: ${content}

Please make it:
- Engaging and professional
- Include relevant hashtags
- Keep it under 1300 characters
- Add value to the reader
- Include a call-to-action if appropriate

Format the response as just the post content, no additional text.`;

    const completion = await openaiClient.chatCompletionsCreate({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional LinkedIn content creator. Create engaging, professional posts that add value to the reader. Keep responses concise and impactful.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300, // Reduced from 500 for faster generation
      temperature: 0.7,
    }, {
      userId: userId,
      operation: 'linkedin_post_generation'
    });

    const generatedContent = completion.choices[0]?.message?.content || `Excited to share about ${content}! #innovation #business`;

    return NextResponse.json({ content: generatedContent });
  } catch (error) {
    console.error('Error generating LinkedIn post content:', error);
    return NextResponse.json(
      { error: 'Failed to generate LinkedIn post content' },
      { status: 500 }
    );
  }
}
