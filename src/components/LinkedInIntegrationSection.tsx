'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Linkedin, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

export default function LinkedInIntegrationSection() {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get LinkedIn integration status
  const linkedInIntegration = useQuery(api.linkedin.getLinkedInIntegration, 
    user?.id ? { userId: user.id } : 'skip'
  );

  // Get LinkedIn posts
  const linkedInPosts = useQuery(api.linkedin.getLinkedInPosts, 
    user?.id ? { userId: user.id } : 'skip'
  );

  // Mutations
  const deactivateLinkedInIntegration = useMutation(api.linkedin.deactivateLinkedInIntegration);

  const handleConnectLinkedIn = async () => {
    setIsConnecting(true);
    try {
      window.location.href = '/api/auth/linkedin';
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!user?.id) return;
    
    try {
      await deactivateLinkedInIntegration({ userId: user.id });
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
    }
  };

  const getStatusBadge = () => {
    if (!linkedInIntegration) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    
    if (linkedInIntegration.expiresAt < Date.now()) {
      return <Badge variant="destructive">Token Expired</Badge>;
    }
    
    return <Badge variant="default">Connected</Badge>;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getPostStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      scheduled: { variant: 'default' as const, label: 'Scheduled' },
      published: { variant: 'default' as const, label: 'Published' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="bg-neutral-primary rounded-lg shadow-sm border border-neutral-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary font-heading">LinkedIn Integration</h3>
          <p className="text-sm text-text-secondary mt-1 font-body">
            Connect your LinkedIn account to create and schedule posts
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {!linkedInIntegration ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-body">
              Connect your LinkedIn account to enable AI-powered post creation and scheduling.
            </p>
          </div>
          <Button
            onClick={handleConnectLinkedIn}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-button"
          >
            <Linkedin className="w-4 h-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect LinkedIn'}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Connection Info */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 font-body">
                  Connected as {linkedInIntegration.linkedinName}
                </p>
                <p className="text-xs text-green-600 font-body">
                  {linkedInIntegration.linkedinEmail}
                </p>
                {linkedInIntegration.expiresAt > Date.now() && (
                  <p className="text-xs text-green-600 font-body">
                    Token expires: {formatDate(linkedInIntegration.expiresAt)}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectLinkedIn}
                  className="border-green-200 text-green-700 hover:bg-green-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectLinkedIn}
                  className="border-red-200 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          </div>

          {/* Posts Overview */}
          <div>
            <h4 className="font-medium text-text-primary mb-3 font-body">Recent Posts</h4>
            {linkedInPosts && linkedInPosts.length > 0 ? (
              <div className="space-y-3">
                {linkedInPosts.slice(0, 5).map((post) => (
                  <div key={post._id} className="p-3 bg-neutral-secondary/20 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary font-body">
                          {post.content.substring(0, 100)}...
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          {getPostStatusBadge(post.status)}
                          <span className="text-xs text-text-secondary font-body">
                            {formatDate(post.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 font-body">
                  No LinkedIn posts yet. Start by asking the AI to create a post!
                </p>
              </div>
            )}
          </div>

          {/* Usage Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800 mb-2 font-body">How to Use</h4>
            <div className="text-sm text-blue-700 font-body space-y-1">
              <p>💬 Ask the AI to create LinkedIn posts:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>"Create a LinkedIn post about our new product"</li>
                <li>"Draft a LinkedIn post for our company announcement"</li>
                <li>"Schedule a LinkedIn post for tomorrow about our team"</li>
                <li>"Write a LinkedIn post about industry trends"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
