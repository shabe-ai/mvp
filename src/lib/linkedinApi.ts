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

export interface LinkedInOrganization {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
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
      // Use the userinfo endpoint which works with our current scopes
      const response = await fetch(`${this.baseUrl}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const profile = await response.json();
      
      return {
        id: profile.sub, // LinkedIn user ID
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        email: profile.email || '',
        profileUrl: `https://www.linkedin.com/in/${profile.sub}`,
      };
    } catch (error) {
      logger.error('LinkedIn API - Get profile error:', error as Error);
      throw error;
    }
  }

  /**
   * Get user's LinkedIn organizations (company pages they can post to)
   */
  async getOrganizations(): Promise<LinkedInOrganization[]> {
    try {
      const response = await fetch(`${this.baseUrl}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,name,logoV2(original~:playableStreams))))`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.statusText}`);
      }

      const data = await response.json();
      const organizations: LinkedInOrganization[] = [];

      if (data.elements) {
        for (const element of data.elements) {
          const org = element['organizationalTarget~'];
          if (org) {
            organizations.push({
              id: org.id,
              name: org.name,
              logoUrl: org.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier,
              websiteUrl: `https://www.linkedin.com/company/${org.id}`,
            });
          }
        }
      }

      return organizations;
    } catch (error) {
      logger.error('LinkedIn API - Get organizations error:', error as Error);
      throw error;
    }
  }

  /**
   * Get the first available organization ID for posting
   */
  async getOrganizationId(): Promise<string> {
    try {
      const organizations = await this.getOrganizations();
      if (organizations.length === 0) {
        throw new Error('No company pages found. You must be an admin of at least one company page to post.');
      }
      return organizations[0].id; // Use the first available organization
    } catch (error) {
      // If organization fetching fails, try to get from stored integration data
      logger.warn('LinkedIn API - Organization fetching failed, trying fallback:', error as Error);
      
      // For now, fall back to personal posting until organization access is properly configured
      const profile = await this.getProfile();
      logger.info('LinkedIn API - Falling back to personal posting with user ID:', { userId: profile.id });
      return profile.id; // Return personal ID as fallback
    }
  }

  /**
   * Get person ID for posting (temporary until org scope is approved)
   */
  private async getPersonId(): Promise<string> {
    const profile = await this.getProfile();
    return profile.id;
  }

  /**
   * Create a LinkedIn post (company page or personal profile)
   */
  async createPost(postData: LinkedInPostData): Promise<{ postId: string; response: any }> {
    try {
      // Get organization ID for posting (with fallback to personal)
      const organizationId = await this.getOrganizationId();
      
      // Determine if this is a company page or personal profile
      const isCompanyPage = organizationId.length > 10; // Company IDs are typically longer
      const authorUrn = isCompanyPage ? `urn:li:organization:${organizationId}` : `urn:li:person:${organizationId}`;
      
      logger.info('LinkedIn API - Creating post with author:', { 
        authorUrn, 
        isCompanyPage, 
        organizationId: organizationId.substring(0, 10) + '...' 
      });
      
      // Prepare the post payload
      const payload = {
        author: authorUrn,
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
