'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Linkedin, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

export default function LinkedInIntegrationSection() {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get LinkedIn integration status with defensive error handling
  const linkedInIntegration = useQuery(api.linkedin.getLinkedInIntegration, 
    user?.id ? { userId: user.id } : 'skip'
  );

  // Get LinkedIn posts with defensive error handling
  const linkedInPosts = useQuery(api.linkedin.getLinkedInPosts, 
    user?.id ? { userId: user.id } : 'skip'
  );

  // Mutations
  const deactivateLinkedInIntegration = useMutation(api.linkedin.deactivateLinkedInIntegration);

  // Handle Convex errors and loading states
  useEffect(() => {
    if (user?.id) {
      // Set loading to false after a reasonable timeout
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);

      // Check for errors
      if (linkedInIntegration === undefined && !isLoading) {
        setHasError(true);
      }

      return () => clearTimeout(timer);
    }
  }, [linkedInIntegration, user?.id, isLoading]);

  // If there's an error, show a simplified version that doesn't break the page
  if (hasError) {
    return (
      <div className="bg-neutral-primary rounded-lg shadow-sm border border-neutral-secondary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary font-heading">LinkedIn Personal Profile Integration</h3>
            <p className="text-sm text-text-secondary mt-1 font-body">
              Connect your LinkedIn account to post on your personal profile
            </p>
          </div>
          <Badge variant="secondary">Not Connected</Badge>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-body">
              Connect your LinkedIn account to enable AI-powered company page post creation and scheduling.
            </p>
          </div>
          <Button
            onClick={() => window.location.href = '/api/auth/linkedin'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-button"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect LinkedIn Account
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-neutral-primary rounded-lg shadow-sm border border-neutral-secondary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary font-heading">LinkedIn Personal Profile Integration</h3>
            <p className="text-sm text-text-secondary mt-1 font-body">
              Connect your LinkedIn account to post on your personal profile
            </p>
          </div>
          <Badge variant="secondary">Loading...</Badge>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-body">
              Loading LinkedIn company page integration status...
            </p>
          </div>
          <Button
            disabled
            className="bg-blue-600 hover:bg-blue-700 text-white font-button opacity-50"
          >
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </div>
      </div>
    );
  }

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
          <h3 className="text-lg font-semibold text-text-primary font-heading">LinkedIn Company Page Integration</h3>
          <p className="text-sm text-text-secondary mt-1 font-body">
            Connect your LinkedIn account to post on behalf of your company page
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {!linkedInIntegration ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-body">
              Connect your LinkedIn account to enable AI-powered company page post creation and scheduling.
            </p>
          </div>
          <Button
            onClick={handleConnectLinkedIn}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-button"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect LinkedIn Account
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-body">
              Your LinkedIn account is connected. You can now create and schedule posts on behalf of your company page.
            </p>
          </div>
          
          {linkedInIntegration.linkedinName && (
            <div className="flex items-center p-3 bg-neutral-secondary/10 rounded-md">
              <Linkedin className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-text-primary font-body">
                  {linkedInIntegration.linkedinName}
                </p>
                <p className="text-xs text-text-secondary font-body">
                  {linkedInIntegration.linkedinEmail}
                </p>
              </div>
            </div>
          )}

          {linkedInPosts && linkedInPosts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2 font-body">Recent Posts</h4>
              <div className="space-y-2">
                {linkedInPosts.slice(0, 3).map((post) => (
                  <div key={post._id} className="p-3 bg-neutral-secondary/5 rounded-md">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-text-primary font-body truncate">
                        {post.content.substring(0, 50)}...
                      </p>
                      {getPostStatusBadge(post.status)}
                    </div>
                    <p className="text-xs text-text-secondary font-body">
                      {formatDate(post.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleDisconnectLinkedIn}
              variant="outline"
              className="font-button"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
            
            <Button
              onClick={handleConnectLinkedIn}
              variant="outline"
              className="font-button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
