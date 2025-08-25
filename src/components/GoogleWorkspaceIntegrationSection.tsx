'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mail, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

export default function GoogleWorkspaceIntegrationSection() {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [hasGoogleTokens, setHasGoogleTokens] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has Google tokens
  useEffect(() => {
    const checkGoogleTokens = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔍 Checking Google tokens for user:', user.id);
        const response = await fetch('/api/test-token');
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Token test results:', data);
          console.log('🔍 data.hasToken:', data.hasToken);
          console.log('🔍 data.tokenInfo:', data.tokenInfo);
          console.log('🔍 data.tokenInfo?.hasAccessToken:', data.tokenInfo?.hasAccessToken);
          
          // Fix: The API returns hasToken directly, not tokenInfo.hasAccessToken
          const hasTokens = data.hasToken === true;
          console.log('🔍 Setting hasGoogleTokens to:', hasTokens);
          console.log('🔍 Type of hasTokens:', typeof hasTokens);
          setHasGoogleTokens(hasTokens);
        } else {
          console.error('❌ Failed to check Google tokens:', response.status);
        }
      } catch (error) {
        console.error('❌ Error checking Google tokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkGoogleTokens();
  }, [user?.id]);

  // Add a refresh effect when the component mounts
  useEffect(() => {
    if (user?.id) {
      // Force a refresh after a short delay to ensure we get the latest token status
      const timer = setTimeout(() => {
        handleRefreshStatus();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      window.location.href = '/api/auth/google';
    } catch (error) {
      console.error('Error connecting Google:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user?.id) return;
    
    setIsDisconnecting(true);
    try {
      // This would need to be implemented to clear Google tokens
      console.log('Disconnecting Google account...');
      // For now, just refresh the token check
      const response = await fetch('/api/test-token');
      if (response.ok) {
        const data = await response.json();
        setHasGoogleTokens(data.hasToken === true);
      }
    } catch (error) {
      console.error('Error disconnecting Google:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-token');
      if (response.ok) {
        const data = await response.json();
        setHasGoogleTokens(data.hasToken === true);
      }
    } catch (error) {
      console.error('Error refreshing Google status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary">Checking...</Badge>;
    }
    
    if (!hasGoogleTokens) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    
    return <Badge variant="default">Connected</Badge>;
  };

  return (
    <div className="bg-neutral-primary rounded-lg shadow-sm border border-neutral-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary font-heading">Google Workspace Integration</h3>
          <p className="text-sm text-text-secondary mt-1 font-body">
            Connect your Google account to enable calendar and email features
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {!hasGoogleTokens ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-body">
              Connect your Google account to enable calendar event creation and email sending.
            </p>
          </div>
          <Button
            onClick={handleConnectGoogle}
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
                Connect Google Account
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-body">
              Your Google account is connected. You can now create calendar events and send emails.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center p-3 bg-neutral-secondary/10 rounded-md">
              <Calendar className="w-5 h-5 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-text-primary font-body">Calendar Access</p>
                <p className="text-xs text-text-secondary font-body">Create and manage events</p>
              </div>
            </div>
            
            <div className="flex items-center p-3 bg-neutral-secondary/10 rounded-md">
              <Mail className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-text-primary font-body">Email Access</p>
                <p className="text-xs text-text-secondary font-body">Send emails to contacts</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleRefreshStatus}
              disabled={isLoading}
              variant="outline"
              className="font-button"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
            <Button
              onClick={handleDisconnectGoogle}
              disabled={isDisconnecting}
              variant="outline"
              className="font-button"
            >
              {isDisconnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
