'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  Plus,
  Edit3,
  Save,
  Send,
  BarChart3,
  Target,
  Calendar,
  Zap,
  BarChart,
  PieChart,
  Activity,
  MousePointer,
  Clock,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Settings,
  Bot
} from 'lucide-react';

interface GeneratedAsset {
  id: string;
  type: 'email' | 'blog' | 'linkedin_post' | 'social_post' | 'image';
  title: string;
  content: string;
  imageUrl?: string;
  status: 'draft' | 'ready' | 'published';
}

interface CampaignMetrics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  totalRevenue: number;
  roi: number;
  engagementRate: number;
  conversionRate: number;
  avgSessionDuration: number;
  bounceRate: number;
  costPerClick: number;
  impressions: number;
  reach: number;
}

export default function CampaignManagerPage() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [campaignTopic, setCampaignTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'campaign-agent'>('overview');

  // Enhanced metrics for demonstration
  const metrics: CampaignMetrics = {
    totalViews: 15420,
    totalLikes: 892,
    totalComments: 234,
    totalShares: 156,
    totalClicks: 1234,
    totalRevenue: 45600,
    roi: 3.2,
    engagementRate: 8.3,
    conversionRate: 4.7,
    avgSessionDuration: 245,
    bounceRate: 32.1,
    costPerClick: 2.45,
    impressions: 45600,
    reach: 12340
  };

  const assetTypes = [
    { value: 'email', label: 'Email Campaign', icon: '📧' },
    { value: 'blog', label: 'Blog Article', icon: '📝' },
    { value: 'linkedin_post', label: 'LinkedIn Post', icon: '💼' },
    { value: 'social_post', label: 'Social Media Post', icon: '📱' },
    { value: 'landing_page', label: 'Landing Page', icon: '🌐' },
    { value: 'image', label: 'AI Generated Image', icon: '🎨' }
  ];

  const handleAssetToggle = (assetType: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetType) 
        ? prev.filter(type => type !== assetType)
        : [...prev, assetType]
    );
  };

  const generateAssets = async () => {
    if (!campaignTopic.trim() || selectedAssets.length === 0) {
      alert('Please select asset types and enter a campaign topic');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/campaign-assets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetTypes: selectedAssets,
          campaignTopic,
          tone: 'professional'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setGeneratedAssets(result.assets);
        setActiveSection('campaign-agent'); // Switch to campaign agent after generation
      } else {
        throw new Error(result.error || 'Failed to generate assets');
      }
    } catch (error) {
      console.error('Error generating assets:', error);
      alert('Failed to generate assets. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateAssetContent = (assetId: string, newContent: string) => {
    setGeneratedAssets(prev => 
      prev.map(asset => 
        asset.id === assetId 
          ? { ...asset, content: newContent }
          : asset
      )
    );
  };

  const saveAsset = (assetId: string) => {
    setEditingAsset(null);
    console.log('Saving asset:', assetId);
  };

  const publishAsset = (assetId: string) => {
    const asset = generatedAssets.find(a => a.id === assetId);
    
    if (!asset) {
      console.error('Asset not found:', assetId);
      return;
    }

    if (asset.type !== 'linkedin_post') {
      alert('Publishing is currently only available for LinkedIn posts. Other asset types will be available soon.');
      return;
    }

    setGeneratedAssets(prev => 
      prev.map(asset => 
        asset.id === assetId 
          ? { ...asset, status: 'published' as const }
          : asset
      )
    );
    
    console.log('Publishing LinkedIn post:', assetId);
  };

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendValue, 
    subtitle 
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: 'up' | 'down';
    trendValue?: string;
    subtitle?: string;
  }) => (
    <Card className="bg-white border-gray-300 shadow-sm">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="p-3 rounded-lg bg-gray-100 border border-gray-200 inline-flex mb-4">
            <Icon className="h-6 w-6 text-gray-700" />
          </div>
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 font-medium mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center justify-center mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm ml-1 font-semibold ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="bg-white border-gray-300 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-300 min-h-screen shadow-sm">
          <div className="p-6">
            <div className="mb-8">
              <div className="flex items-center mb-6">
                <img 
                  src="/Fime.png" 
                  alt="Shabe AI Logo" 
                  className="h-8 w-auto mr-3"
                />
              </div>
              <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Campaign Manager</h1>
              <p className="text-sm text-gray-600 mt-1 font-medium">AI-powered marketing campaigns</p>
            </div>

            {/* Navigation */}
            <nav className="space-y-2 mb-8">
              <button
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  activeSection === 'overview'
                    ? 'bg-gray-900 text-white border border-gray-900'
                    : 'text-gray-800 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Overview
              </button>
              <button
                onClick={() => setActiveSection('campaign-agent')}
                className={`w-full flex items-center px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  activeSection === 'campaign-agent'
                    ? 'bg-gray-900 text-white border border-gray-900'
                    : 'text-gray-800 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <Bot className="h-4 w-4 mr-3" />
                Campaign Agent
              </button>
            </nav>

            {/* Quick Stats */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Active Campaigns</span>
                  <span className="font-bold text-gray-900">3</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Assets Created</span>
                  <span className="font-bold text-gray-900">{generatedAssets.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Published Today</span>
                  <span className="font-bold text-gray-900">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 bg-gray-50">
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3 uppercase tracking-wide">Campaign Overview</h2>
                <p className="text-gray-700 font-medium">Monitor your campaign performance and key metrics</p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Views"
                  value={metrics.totalViews.toLocaleString()}
                  icon={Eye}
                  trend="up"
                  trendValue="+12.5%"
                />
                <MetricCard
                  title="Engagement Rate"
                  value={`${metrics.engagementRate}%`}
                  icon={Heart}
                  trend="up"
                  trendValue="+8.2%"
                />
                <MetricCard
                  title="Total Revenue"
                  value={`$${metrics.totalRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  trend="up"
                  trendValue="+15.3%"
                />
                <MetricCard
                  title="Conversion Rate"
                  value={`${metrics.conversionRate}%`}
                  icon={Target}
                  trend="down"
                  trendValue="-2.1%"
                />
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <MetricCard
                    title="Impressions"
                    value={metrics.impressions.toLocaleString()}
                    icon={Layers}
                    subtitle="Total ad impressions"
                  />
                  <MetricCard
                    title="Reach"
                    value={metrics.reach.toLocaleString()}
                    icon={Users}
                    subtitle="Unique users reached"
                  />
                  <MetricCard
                    title="Cost Per Click"
                    value={`$${metrics.costPerClick}`}
                    icon={MousePointer}
                    subtitle="Average CPC"
                  />
                </div>
                <div className="space-y-4">
                  <MetricCard
                    title="Avg Session Duration"
                    value={`${Math.floor(metrics.avgSessionDuration / 60)}:${(metrics.avgSessionDuration % 60).toString().padStart(2, '0')}`}
                    icon={Clock}
                    subtitle="Minutes:Seconds"
                  />
                  <MetricCard
                    title="Bounce Rate"
                    value={`${metrics.bounceRate}%`}
                    icon={TrendingDown}
                    subtitle="Page bounce rate"
                  />
                  <MetricCard
                    title="ROI"
                    value={`${metrics.roi}x`}
                    icon={TrendingUp}
                    subtitle="Return on investment"
                  />
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Engagement Trends">
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Engagement Chart</p>
                      <p className="text-xs text-gray-400">Likes, Comments, Shares over time</p>
                    </div>
                  </div>
                </ChartCard>

                <ChartCard title="Revenue Distribution">
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Revenue Chart</p>
                      <p className="text-xs text-gray-400">Revenue by campaign source</p>
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* Performance Summary */}
              <ChartCard title="Performance Summary">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-gray-900">{metrics.totalLikes.toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-2">Total Likes</div>
                  </div>
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-gray-900">{metrics.totalComments.toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-2">Comments</div>
                  </div>
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-gray-900">{metrics.totalShares.toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-2">Shares</div>
                  </div>
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-3xl font-bold text-gray-900">{metrics.totalClicks.toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mt-2">Clicks</div>
                  </div>
                </div>
              </ChartCard>
            </div>
          )}

          {activeSection === 'campaign-agent' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3 uppercase tracking-wide">Campaign Agent</h2>
                <p className="text-gray-700 font-medium">Generate and manage your campaign assets with AI</p>
              </div>

              {/* Asset Generator */}
              <Card className="bg-white border-gray-300 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 uppercase tracking-wide">
                    <Zap className="h-6 w-6 text-gray-900" />
                    Generate Campaign Assets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="asset-types">Select Asset Types</Label>
                    <div className="mt-2 space-y-2">
                      {assetTypes.map((asset) => (
                        <label key={asset.value} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAssets.includes(asset.value)}
                            onChange={() => handleAssetToggle(asset.value)}
                            className="rounded"
                          />
                          <span>{asset.icon} {asset.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="campaign-topic">Campaign Topic</Label>
                    <Textarea
                      id="campaign-topic"
                      value={campaignTopic}
                      onChange={(e) => setCampaignTopic(e.target.value)}
                      placeholder="e.g., Building a campaign for Shabe AI focused on HubSpot displacement"
                      className="mt-2"
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={generateAssets}
                    disabled={isGenerating || selectedAssets.length === 0 || !campaignTopic.trim()}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 text-base"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating Assets...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Assets
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Assets Display */}
              {generatedAssets.length > 0 && (
                <Card className="bg-white border-gray-300 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 uppercase tracking-wide">
                      <Target className="h-6 w-6 text-gray-900" />
                      Generated Campaign Assets
                    </CardTitle>
                    <div className="text-sm text-gray-700 mt-3 font-medium">
                      💡 Publishing is currently available for LinkedIn posts only. Other platforms coming soon!
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {generatedAssets.map((asset) => (
                        <div key={asset.id} className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Badge variant={asset.status === 'published' ? 'default' : 'secondary'}>
                                {asset.status}
                              </Badge>
                              <span className="font-medium">{asset.title}</span>
                              {asset.type === 'linkedin_post' && (
                                <Badge variant="outline" className="text-xs">
                                  💼 LinkedIn
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {editingAsset === asset.id ? (
                                <>
                                  <Button size="sm" onClick={() => saveAsset(asset.id)}>
                                    <Save className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingAsset(null)}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => setEditingAsset(asset.id)}>
                                    <Edit3 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                                                  <Button 
                                  size="sm" 
                                  onClick={() => publishAsset(asset.id)}
                                  variant={asset.type === 'linkedin_post' ? 'default' : 'outline'}
                                  disabled={asset.type !== 'linkedin_post'}
                                  className={asset.type === 'linkedin_post' ? 'bg-gray-900 hover:bg-gray-800 text-white font-semibold' : 'border-gray-300 text-gray-700 font-semibold hover:bg-gray-50'}
                                >
                                    <Send className="h-4 w-4 mr-1" />
                                    {asset.type === 'linkedin_post' ? 'Publish' : 'Coming Soon'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {editingAsset === asset.id ? (
                            asset.type === 'image' ? (
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-sm font-medium">Image Description</Label>
                                  <Textarea
                                    value={asset.content}
                                    onChange={(e) => updateAssetContent(asset.id, e.target.value)}
                                    className="mt-1"
                                    placeholder="Describe the image you want to generate..."
                                    rows={3}
                                  />
                                </div>
                                {asset.imageUrl && (
                                  <div>
                                    <Label className="text-sm font-medium">Generated Image</Label>
                                    <div className="mt-2">
                                      <img 
                                        src={asset.imageUrl} 
                                        alt="Generated" 
                                        className="max-w-full h-auto rounded-lg border"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Textarea
                                value={asset.content}
                                onChange={(e) => updateAssetContent(asset.id, e.target.value)}
                                className="min-h-[200px]"
                                placeholder="Edit your content here..."
                              />
                            )
                          ) : (
                            asset.type === 'image' ? (
                              <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                  <p className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">Description:</p>
                                  <p className="text-sm font-medium text-gray-700">{asset.content}</p>
                                </div>
                                {asset.imageUrl && (
                                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Generated Image:</p>
                                    <img 
                                      src={asset.imageUrl} 
                                      alt="Generated" 
                                      className="max-w-full h-auto rounded-lg border border-gray-300 shadow-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <pre className="whitespace-pre-wrap text-sm font-medium text-gray-800">{asset.content}</pre>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
