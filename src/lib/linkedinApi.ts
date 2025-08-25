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
  private advertisingApiUrl = 'https://api.linkedin.com/rest';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get user's LinkedIn profile information
   */
  async getProfile(): Promise<LinkedInProfile> {
    try {
      // Use userinfo endpoint which works with our current scopes
      const response = await fetch(`${this.baseUrl}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const profile = await response.json();
      
      // For LinkedIn API posting, we need to get the actual LinkedIn person ID
      // The userinfo endpoint doesn't provide the LinkedIn person ID directly
      // We need to make a separate call to get the person ID for posting
      let personId = await this.getLinkedInPersonId();
      
      logger.info('LinkedIn API - Profile info:', { 
        originalSub: profile.sub, 
        extractedPersonId: personId,
        firstName: profile.given_name,
        lastName: profile.family_name,
        email: profile.email
      });
      
      return {
        id: personId,
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        email: profile.email || '',
        profileUrl: `https://www.linkedin.com/in/${personId}`,
      };
    } catch (error) {
      logger.error('LinkedIn API - Get profile error:', error as Error);
      throw error;
    }
  }

  /**
   * Get the actual LinkedIn person ID for posting
   * This is a workaround since userinfo doesn't provide the LinkedIn person ID
   */
  private async getLinkedInPersonId(): Promise<string> {
    try {
      // Try to get the person ID from the user's profile using a different approach
      // We'll use the user's email to find their LinkedIn profile
      const userinfoResponse = await fetch(`${this.baseUrl}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!userinfoResponse.ok) {
        throw new Error(`Failed to fetch userinfo: ${userinfoResponse.statusText}`);
      }

      const userinfo = await userinfoResponse.json();
      
      // Try to extract a numeric ID from the sub field
      let personId = userinfo.sub;
      
      // If it's a URN format, extract the ID part
      if (personId && personId.startsWith('urn:li:person:')) {
        personId = personId.replace('urn:li:person:', '');
      }
      
      // If we have a numeric ID, use it
      if (personId && !isNaN(Number(personId))) {
        logger.info('LinkedIn API - Using numeric person ID from sub:', { personId });
        return personId;
      }
      
      // If we don't have a numeric ID, we need to get it differently
      // Let's try to extract numeric parts from the alphanumeric ID
      if (personId && isNaN(Number(personId))) {
        // Look for numeric patterns in the ID - get ALL digits, not just the first one
        const numericMatch = personId.match(/\d+/g);
        if (numericMatch && numericMatch.length > 0) {
          // Join all numeric parts together
          const numericId = numericMatch.join('');
          logger.info('LinkedIn API - Extracted numeric ID from alphanumeric:', { 
            originalId: personId, 
            extractedId: numericId,
            allNumericParts: numericMatch
          });
          return numericId;
        }
      }
      
      // If we still don't have a numeric ID, we need to get it from a different source
      // Let's try to use the user's profile picture URL to extract the ID
      if (userinfo.picture) {
        // LinkedIn profile pictures often contain the user ID
        // Try different patterns to extract the ID from the URL
        const picturePatterns = [
          /\/(\d+)\?/,  // Pattern: /123456789?
          /\/(\d+)$/,   // Pattern: /123456789 (end of URL)
          /profile-displayphoto-shrink_100_100\/0\/(\d+)/, // Specific LinkedIn pattern
        ];
        
        for (const pattern of picturePatterns) {
          const pictureMatch = userinfo.picture.match(pattern);
          if (pictureMatch) {
            const pictureId = pictureMatch[1];
            logger.info('LinkedIn API - Extracted ID from profile picture:', { 
              pictureUrl: userinfo.picture, 
              extractedId: pictureId,
              pattern: pattern.toString()
            });
            return pictureId;
          }
        }
      }
      
      // Log the full userinfo for debugging
      logger.info('LinkedIn API - Full userinfo for debugging:', {
        sub: userinfo.sub,
        picture: userinfo.picture,
        name: userinfo.name,
        email: userinfo.email
      });
      
      // Last resort: try to use a common LinkedIn ID format
      // This is not ideal but might work for testing
      logger.warn('LinkedIn API - No numeric person ID found, using fallback ID');
      return '123456789'; // Placeholder ID for testing
    } catch (error) {
      logger.error('LinkedIn API - Get person ID error:', error as Error);
      throw error;
    }
  }

  /**
   * Get user's LinkedIn organizations (company pages they can post to)
   */
  async getOrganizations(): Promise<LinkedInOrganization[]> {
    try {
      // Try multiple endpoints to find organizations
      const endpoints = [
        {
          url: `${this.advertisingApiUrl}/organizations`,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202505',
          },
          name: 'Advertising API organizations'
        },
        {
          url: `${this.advertisingApiUrl}/adAccounts`,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202505',
          },
          name: 'Advertising API ad accounts'
        },
        {
          url: `${this.baseUrl}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,name,logoV2(original~:playableStreams))))`,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          name: 'Legacy organizationalEntityAcls'
        }
      ];

      for (const endpoint of endpoints) {
        try {
          logger.info(`LinkedIn API - Trying ${endpoint.name} endpoint`);
          
          const response = await fetch(endpoint.url, {
            headers: endpoint.headers as Record<string, string>,
          });

          logger.info(`LinkedIn API - ${endpoint.name} response status: ${response.status}`);

          if (response.ok) {
            const data = await response.json();
            logger.info(`LinkedIn API - ${endpoint.name} response data: ${JSON.stringify(data, null, 2)}`);

            const organizations: LinkedInOrganization[] = [];

            if (data.elements && data.elements.length > 0) {
              for (const element of data.elements) {
                let org;
                
                if (endpoint.name.includes('Advertising API')) {
                  // Advertising API format
                  org = element;
                } else {
                  // Legacy API format
                  org = element['organizationalTarget~'];
                }

                if (org && org.id) {
                  organizations.push({
                    id: org.id,
                    name: org.name || org.displayName || 'Unknown Organization',
                    logoUrl: org.logoUrl || org.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier,
                    websiteUrl: `https://www.linkedin.com/company/${org.id}`,
                  });
                }
              }

              if (organizations.length > 0) {
                logger.info(`LinkedIn API - Found organizations via ${endpoint.name}: ${JSON.stringify(organizations)}`);
                return organizations;
              }
            }
          } else {
            const errorText = await response.text();
            logger.warn(`LinkedIn API - ${endpoint.name} failed: ${response.status} ${errorText}`);
          }
        } catch (endpointError) {
          logger.warn(`LinkedIn API - ${endpoint.name} error: ${endpointError}`);
        }
      }

      // If all endpoints fail, throw a comprehensive error
      throw new Error('All organization endpoints failed. Please ensure you have the correct LinkedIn API permissions and are an admin of at least one company page.');
    } catch (error) {
      logger.error('LinkedIn API - Get organizations error:', error as Error);
      throw error;
    }
  }

  /**
   * Get the person ID for personal profile posting
   */
  async getPersonId(): Promise<string> {
    try {
      // First, try to get person ID from the stored integration data
      const integration = await this.getLinkedInIntegration();
      if (integration?.linkedinPersonId) {
        logger.info('LinkedIn API - Using stored person ID:', { 
          personId: integration.linkedinPersonId
        });
        return integration.linkedinPersonId;
      }
      
      // Get the actual person ID from LinkedIn profile
      const profile = await this.getProfile();
      
      // Use the profile.id which contains the LinkedIn person ID
      const personId = profile.id;
      
      logger.info('LinkedIn API - Using profile person ID:', { 
        personId,
        profileId: profile.id
      });
      
      return personId;
    } catch (error) {
      logger.error('LinkedIn API - Failed to get person ID:', error as Error);
      throw new Error(`LinkedIn posting failed: Unable to get person ID. Please ensure you have the correct LinkedIn API permissions.`);
    }
  }



  /**
   * Get LinkedIn integration data from Convex
   */
  private async getLinkedInIntegration() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.shabe.ai';
      const response = await fetch(`${baseUrl}/api/linkedin/integration`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.integration;
      }
      
      return null;
    } catch (error) {
      logger.error('LinkedIn API - Get integration error:', error as Error);
      return null;
    }
  }



  /**
   * Create a LinkedIn post (personal profile only)
   */
  async createPost(postData: LinkedInPostData): Promise<{ postId: string; response: any }> {
    try {
      // Get person ID for personal profile posting
      const personId = await this.getPersonId();
      const authorUrn = `urn:li:person:${personId}`;
      
      logger.info('LinkedIn API - Creating personal post with author:', { 
        authorUrn, 
        personId,
        postType: 'personal'
      });
      
      // Prepare the post payload for /rest/posts API (personal posting)
      const payload = {
        author: authorUrn,
        commentary: postData.content,
        visibility: postData.visibility.toUpperCase(),
        ...(postData.imageUrl && {
          media: [{
            status: 'READY',
            description: postData.description || '',
            media: postData.imageUrl,
            title: postData.title || ''
          }]
        }),
        ...(postData.linkUrl && {
          content: {
            contentEntities: [{
              entityLocation: postData.linkUrl,
              thumbnails: []
            }],
            title: postData.title || ''
          }
        })
      };

      logger.info('LinkedIn API - Post payload:', payload);

      const response = await fetch(`${this.advertisingApiUrl}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202505',
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
      
      logger.info('LinkedIn API - Post created successfully:', result);
      
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
