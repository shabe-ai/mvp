'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bug, 
  Database, 
  Key, 
  Shield, 
  Activity, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Settings
} from 'lucide-react';

interface DebugInfo {
  category: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  timestamp: string;
}

interface SystemHealth {
  database: boolean;
  auth: boolean;
  integrations: boolean;
  api: boolean;
}

export default function DebugDashboard() {
  const { user } = useUser();
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: false,
    auth: false,
    integrations: false,
    api: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Access control - only show to specific user
  const AUTHORIZED_USER_ID = 'user_30yNzzaqY36tW07nKprV52twdEQ';
  
  // Add debugging to see what's happening
  console.log('🔍 DebugDashboard: user =', user?.id);
  console.log('🔍 DebugDashboard: AUTHORIZED_USER_ID =', AUTHORIZED_USER_ID);
  console.log('🔍 DebugDashboard: should show =', user?.id === AUTHORIZED_USER_ID);
  
  if (!user || user.id !== AUTHORIZED_USER_ID) {
    console.log('🔍 DebugDashboard: Not showing - access denied');
    return null;
  }

  console.log('🔍 DebugDashboard: Rendering component');

  const addDebugInfo = (info: DebugInfo) => {
    setDebugInfo(prev => [info, ...prev.slice(0, 49)]); // Keep last 50 entries
  };

  const runSystemCheck = async () => {
    setIsLoading(true);
    addDebugInfo({
      category: 'System',
      status: 'info',
      message: 'Starting comprehensive system check...',
      timestamp: new Date().toISOString()
    });

    try {
      // Check database connectivity
      const dbCheck = await fetch('/api/debug/check-tokens');
      const dbHealthy = dbCheck.ok;
      setSystemHealth(prev => ({ ...prev, database: dbHealthy }));
      
      addDebugInfo({
        category: 'Database',
        status: dbHealthy ? 'success' : 'error',
        message: dbHealthy ? 'Database connection healthy' : 'Database connection failed',
        timestamp: new Date().toISOString()
      });

      // Check authentication
      const authCheck = await fetch('/api/debug/clerk');
      const authHealthy = authCheck.ok;
      setSystemHealth(prev => ({ ...prev, auth: authHealthy }));
      
      addDebugInfo({
        category: 'Authentication',
        status: authHealthy ? 'success' : 'error',
        message: authHealthy ? 'Authentication system healthy' : 'Authentication system failed',
        timestamp: new Date().toISOString()
      });

      // Check integrations
      const integrationsCheck = await fetch('/api/test-token');
      const integrationsHealthy = integrationsCheck.ok;
      setSystemHealth(prev => ({ ...prev, integrations: integrationsHealthy }));
      
      addDebugInfo({
        category: 'Integrations',
        status: integrationsHealthy ? 'success' : 'warning',
        message: integrationsHealthy ? 'Integrations healthy' : 'Some integrations may have issues',
        timestamp: new Date().toISOString()
      });

      // Check API health
      const apiCheck = await fetch('/api/monitoring');
      const apiHealthy = apiCheck.ok;
      setSystemHealth(prev => ({ ...prev, api: apiHealthy }));
      
      addDebugInfo({
        category: 'API',
        status: apiHealthy ? 'success' : 'error',
        message: apiHealthy ? 'API endpoints healthy' : 'API endpoints failed',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      addDebugInfo({
        category: 'System',
        status: 'error',
        message: 'System check failed',
        details: error,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkGoogleTokens = async () => {
    addDebugInfo({
      category: 'Google',
      status: 'info',
      message: 'Checking Google tokens...',
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch('/api/test-token');
      const data = await response.json();
      
      addDebugInfo({
        category: 'Google',
        status: data.hasToken ? 'success' : 'warning',
        message: data.hasToken ? 'Google tokens found' : 'No Google tokens found',
        details: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      addDebugInfo({
        category: 'Google',
        status: 'error',
        message: 'Failed to check Google tokens',
        details: error,
        timestamp: new Date().toISOString()
      });
    }
  };

  const checkLinkedInStatus = async () => {
    addDebugInfo({
      category: 'LinkedIn',
      status: 'info',
      message: 'Checking LinkedIn integration...',
      timestamp: new Date().toISOString()
    });

    try {
      // This would check LinkedIn integration status
      addDebugInfo({
        category: 'LinkedIn',
        status: 'warning',
        message: 'LinkedIn integration check not implemented yet',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      addDebugInfo({
        category: 'LinkedIn',
        status: 'error',
        message: 'Failed to check LinkedIn status',
        details: error,
        timestamp: new Date().toISOString()
      });
    }
  };

  const clearLogs = () => {
    setDebugInfo([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      case 'warning': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default: return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary font-heading">Debug Dashboard</h2>
          <p className="text-text-secondary font-body">Comprehensive system monitoring and debugging tools</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runSystemCheck} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            System Check
          </Button>
          <Button variant="outline" onClick={clearLogs}>
            Clear Logs
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Debug Logs</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="tools">Debug Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {systemHealth.database ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {systemHealth.database ? 'Healthy' : 'Issues'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Authentication</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {systemHealth.auth ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {systemHealth.auth ? 'Healthy' : 'Issues'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Integrations</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {systemHealth.integrations ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-sm font-medium">
                    {systemHealth.integrations ? 'Healthy' : 'Warnings'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {systemHealth.api ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {systemHealth.api ? 'Healthy' : 'Issues'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {debugInfo.length === 0 ? (
                  <p className="text-text-secondary text-sm">No debug logs yet. Run a system check to get started.</p>
                ) : (
                  debugInfo.map((info, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-neutral-secondary/10 rounded-lg">
                      {getStatusIcon(info.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-text-primary">{info.category}</span>
                          {getStatusBadge(info.status)}
                          <span className="text-xs text-text-secondary">
                            {new Date(info.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">{info.message}</p>
                        {info.details && (
                          <details className="mt-2">
                            <summary className="text-xs text-text-secondary cursor-pointer">Show details</summary>
                            <pre className="text-xs bg-neutral-primary p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(info.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Google Workspace</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={checkGoogleTokens} className="w-full">
                  Check Google Tokens
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LinkedIn</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={checkLinkedInStatus} className="w-full">
                  Check LinkedIn Status
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Token Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/tokens" target="_blank">View All Tokens</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/test-token" target="_blank">Test Token</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/check-tokens" target="_blank">Check Tokens</a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/user-info" target="_blank">User Info</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/clerk" target="_blank">Clerk Debug</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/contacts" target="_blank">Contacts</a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/env" target="_blank">Environment</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/domain" target="_blank">Domain</a>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/debug/documents" target="_blank">Documents</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
