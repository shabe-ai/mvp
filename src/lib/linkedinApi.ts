import { logger } from './logger';

export interface LinkedInPostData {
  content: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  visibility: 'public' | 'connections';
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileUrl?: string;
}

export class LinkedInAPI {
  private accessToken: string;
  private baseUrl = 'https://api.linkedin.com/v2';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get user's LinkedIn profile information
   */
  async getProfile(): Promise<LinkedInProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const profile = await response.json();
      
      // Get email address
      const emailResponse = await fetch(`${this.baseUrl}/emailAddress?q=members&projection=(elements*(handle~))`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      let email = '';
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        email = emailData.elements?.[0]?.['handle~']?.emailAddress || '';
      }

      return {
        id: profile.id,
        firstName: profile.localizedFirstName,
        lastName: profile.localizedLastName,
        email,
        profileUrl: `https://www.linkedin.com/in/${profile.id}`,
      };
    } catch (error) {
      logger.error('LinkedIn API - Get profile error:', error as Error);
      throw error;
    }
  }

  /**
   * Create a LinkedIn post
   */
  async createPost(postData: LinkedInPostData): Promise<{ postId: string; response: any }> {
    try {
      // Prepare the post payload
      const payload = {
        author: `urn:li:person:${await this.getPersonId()}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postData.content,
            },
            shareMediaCategory: postData.imageUrl ? 'IMAGE' : 'NONE',
            ...(postData.imageUrl && {
              media: [{
                status: 'READY',
                description: {
                  text: postData.description || '',
                },
                media: postData.imageUrl,
                title: {
                  text: postData.title || '',
                },
              }],
            }),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility.toUpperCase(),
        },
      };

      const response = await fetch(`${this.baseUrl}/ugcPosts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Failed to create post: ${response.statusText} - ${errorText}`);
        logger.error('LinkedIn API - Create post error:', error);
        throw error;
      }

      const result = await response.json();
      
      return {
        postId: result.id,
        response: result,
      };
    } catch (error) {
      logger.error('LinkedIn API - Create post error:', error as Error);
      throw error;
    }
  }

  /**
   * Get the current user's person ID
   */
  private async getPersonId(): Promise<string> {
    const profile = await this.getProfile();
    return profile.id;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  }> {
    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token || refreshToken,
      };
    } catch (error) {
      logger.error('LinkedIn API - Refresh token error:', error as Error);
      throw error;
    }
  }

  /**
   * Check if access token is valid
   */
  async validateToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      return response.ok;
    } catch (error) {
      logger.error('LinkedIn API - Validate token error:', error as Error);
      return false;
    }
  }

  /**
   * Get post analytics (basic implementation)
   */
  async getPostAnalytics(postId: string): Promise<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }> {
    try {
      // Note: LinkedIn's analytics API requires additional permissions
      // This is a placeholder implementation
      const response = await fetch(`${this.baseUrl}/socialMetrics/${postId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!response.ok) {
        // Return default values if analytics not available
        return {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
        };
      }

      const data = await response.json();
      
      return {
        views: data.totalShareStatistics?.impressionCount || 0,
        likes: data.totalShareStatistics?.likeCount || 0,
        comments: data.totalShareStatistics?.commentCount || 0,
        shares: data.totalShareStatistics?.shareCount || 0,
      };
    } catch (error) {
      logger.error('LinkedIn API - Get analytics error:', error as Error);
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
    }
  }
}
