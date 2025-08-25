'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mail, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

export default function GoogleWorkspaceIntegrationSection() {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check if user has Google tokens (this would need to be implemented with your token storage)
  const hasGoogleTokens = false; // This should be replaced with actual token check

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      window.location.href = '/api/auth/google';
    } catch (error) {
      console.error('Error connecting Google:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user?.id) return;
    
    setIsDisconnecting(true);
    try {
      // This would need to be implemented to clear Google tokens
      console.log('Disconnecting Google account...');
    } catch (error) {
      console.error('Error disconnecting Google:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
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
            
            <Button
              onClick={handleConnectGoogle}
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
