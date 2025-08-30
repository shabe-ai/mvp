'use client';

import React, { useState } from 'react';
import { Card, Button, Input, Textarea } from '@/components/shabe-ui';
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
    <Card>
      <div className="p-4 text-center">
        <div className="p-2 rounded-ctl bg-accent-50 border border-line-200 inline-flex mb-3">
          <Icon className="h-4 w-4 text-ink-900" />
        </div>
        <p className="text-xs font-medium text-ink-700 uppercase tracking-wide mb-1">{title}</p>
        <p className="text-xl font-bold text-ink-900 mb-1">{value}</p>
        {subtitle && <p className="text-xs text-ink-500 mb-2">{subtitle}</p>}
        {trend && (
          <div className="flex items-center justify-center">
            {trend === 'up' ? (
              <ArrowUpRight className="h-3 w-3 text-success-500" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-danger-500" />
            )}
            <span className={`text-xs ml-1 font-medium ${trend === 'up' ? 'text-success-500' : 'text-danger-500'}`}>
              {trendValue}
            </span>
          </div>
        )}
      </div>
    </Card>
  );

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card>
      <div className="p-4 border-b border-line-200">
        <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-72 bg-bg border-r border-line-200 min-h-screen">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="font-display text-lg font-bold text-ink-900 mb-1">Campaign Manager</h1>
              <p className="text-sm text-ink-600">AI-powered marketing campaigns</p>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 mb-6">
              <button
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-ctl transition-colors ${
                  activeSection === 'overview'
                    ? 'bg-accent-500 text-black'
                    : 'text-ink-700 hover:bg-accent-50'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Overview
              </button>
              <button
                onClick={() => setActiveSection('campaign-agent')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-ctl transition-colors ${
                  activeSection === 'campaign-agent'
                    ? 'bg-accent-500 text-black'
                    : 'text-ink-700 hover:bg-accent-50'
                }`}
              >
                <Bot className="h-4 w-4 mr-3" />
                Campaign Agent
              </button>
            </nav>

            {/* Quick Stats */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-ink-700 uppercase tracking-wide">Quick Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-600">Active Campaigns</span>
                  <span className="font-medium text-ink-900">3</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-600">Assets Created</span>
                  <span className="font-medium text-ink-900">{generatedAssets.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-600">Published Today</span>
                  <span className="font-medium text-ink-900">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 bg-bg">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">Campaign Overview</h2>
                <p className="text-ink-600">Monitor your campaign performance and key metrics</p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
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
                <div className="space-y-3">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Engagement Trends">
                  <div className="h-48 bg-bg-soft rounded-ctl flex items-center justify-center">
                    <div className="text-center">
                      <BarChart className="h-8 w-8 text-ink-500 mx-auto mb-2" />
                      <p className="text-sm text-ink-600">Engagement Chart</p>
                      <p className="text-xs text-ink-500">Likes, Comments, Shares over time</p>
                    </div>
                  </div>
                </ChartCard>

                <ChartCard title="Revenue Distribution">
                  <div className="h-48 bg-bg-soft rounded-ctl flex items-center justify-center">
                    <div className="text-center">
                      <PieChart className="h-8 w-8 text-ink-500 mx-auto mb-2" />
                      <p className="text-sm text-ink-600">Revenue Chart</p>
                      <p className="text-xs text-ink-500">Revenue by campaign source</p>
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* Performance Summary */}
              <ChartCard title="Performance Summary">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-accent-50 rounded-ctl border border-line-200">
                    <div className="text-xl font-bold text-ink-900">{metrics.totalLikes.toLocaleString()}</div>
                    <div className="text-xs font-medium text-ink-700 uppercase tracking-wide mt-1">Total Likes</div>
                  </div>
                  <div className="text-center p-4 bg-accent-50 rounded-ctl border border-line-200">
                    <div className="text-xl font-bold text-ink-900">{metrics.totalComments.toLocaleString()}</div>
                    <div className="text-xs font-medium text-ink-700 uppercase tracking-wide mt-1">Comments</div>
                  </div>
                  <div className="text-center p-4 bg-accent-50 rounded-ctl border border-line-200">
                    <div className="text-xl font-bold text-ink-900">{metrics.totalShares.toLocaleString()}</div>
                    <div className="text-xs font-medium text-ink-700 uppercase tracking-wide mt-1">Shares</div>
                  </div>
                  <div className="text-center p-4 bg-accent-50 rounded-ctl border border-line-200">
                    <div className="text-xl font-bold text-ink-900">{metrics.totalClicks.toLocaleString()}</div>
                    <div className="text-xs font-medium text-ink-700 uppercase tracking-wide mt-1">Clicks</div>
                  </div>
                </div>
              </ChartCard>
            </div>
          )}

          {activeSection === 'campaign-agent' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">Campaign Agent</h2>
                <p className="text-ink-600">Generate and manage your campaign assets with AI</p>
              </div>

              {/* Asset Generator */}
              <Card>
                <div className="p-4 border-b border-line-200">
                  <h3 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-accent-500" />
                    Generate Campaign Assets
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-ink-700 mb-2 block">Select Asset Types</label>
                    <div className="space-y-2">
                      {assetTypes.map((asset) => (
                        <label key={asset.value} className="flex items-center space-x-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={selectedAssets.includes(asset.value)}
                            onChange={() => handleAssetToggle(asset.value)}
                            className="rounded border-line-200"
                          />
                          <span className="text-ink-700">{asset.icon} {asset.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink-700 mb-2 block">Campaign Topic</label>
                    <Textarea
                      value={campaignTopic}
                      onChange={(e) => setCampaignTopic(e.target.value)}
                      placeholder="e.g., Building a campaign for Shabe AI focused on HubSpot displacement"
                      rows={3}
                    />
                  </div>

                  <Button 
                    variant="primary"
                    onClick={generateAssets}
                    disabled={isGenerating || selectedAssets.length === 0 || !campaignTopic.trim()}
                    className="w-full"
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
                </div>
              </Card>

              {/* Generated Assets Display */}
              {generatedAssets.length > 0 && (
                <Card>
                  <div className="p-4 border-b border-line-200">
                    <h3 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
                      <Target className="h-5 w-5 text-accent-500" />
                      Generated Campaign Assets
                    </h3>
                    <div className="text-sm text-ink-600 mt-2">
                      💡 Publishing is currently available for LinkedIn posts only. Other platforms coming soon!
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="space-y-4">
                      {generatedAssets.map((asset) => (
                        <div key={asset.id} className="border border-line-200 rounded-ctl p-4 bg-bg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-pill text-xs font-medium ${
                                asset.status === 'published' 
                                  ? 'bg-success-500 text-white' 
                                  : 'bg-accent-100 text-ink-700'
                              }`}>
                                {asset.status}
                              </span>
                              <span className="font-medium text-ink-900">{asset.title}</span>
                              {asset.type === 'linkedin_post' && (
                                <span className="px-2 py-1 rounded-pill text-xs bg-accent-50 text-ink-700 border border-line-200">
                                  💼 LinkedIn
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {editingAsset === asset.id ? (
                                <>
                                  <Button size="sm" variant="primary" onClick={() => saveAsset(asset.id)}>
                                    <Save className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="subtle" onClick={() => setEditingAsset(null)}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="subtle" onClick={() => setEditingAsset(asset.id)}>
                                    <Edit3 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={() => publishAsset(asset.id)}
                                    variant={asset.type === 'linkedin_post' ? 'primary' : 'subtle'}
                                    disabled={asset.type !== 'linkedin_post'}
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
                              <div className="space-y-3">
                                <div>
                                  <label className="text-sm font-medium text-ink-700 mb-2 block">Image Description</label>
                                  <Textarea
                                    value={asset.content}
                                    onChange={(e) => updateAssetContent(asset.id, e.target.value)}
                                    placeholder="Describe the image you want to generate..."
                                    rows={3}
                                  />
                                </div>
                                {asset.imageUrl && (
                                  <div>
                                    <label className="text-sm font-medium text-ink-700 mb-2 block">Generated Image</label>
                                    <div>
                                      <img 
                                        src={asset.imageUrl} 
                                        alt="Generated" 
                                        className="max-w-full h-auto rounded-ctl border border-line-200"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Textarea
                                value={asset.content}
                                onChange={(e) => updateAssetContent(asset.id, e.target.value)}
                                className="min-h-[150px]"
                                placeholder="Edit your content here..."
                              />
                            )
                          ) : (
                            asset.type === 'image' ? (
                              <div className="space-y-3">
                                <div className="bg-accent-50 p-3 rounded-ctl border border-line-200">
                                  <p className="text-xs font-medium text-ink-700 mb-1 uppercase tracking-wide">Description:</p>
                                  <p className="text-sm text-ink-900">{asset.content}</p>
                                </div>
                                {asset.imageUrl && (
                                  <div className="bg-accent-50 p-3 rounded-ctl border border-line-200">
                                    <p className="text-xs font-medium text-ink-700 mb-2 uppercase tracking-wide">Generated Image:</p>
                                    <img 
                                      src={asset.imageUrl} 
                                      alt="Generated" 
                                      className="max-w-full h-auto rounded-ctl border border-line-200"
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-accent-50 p-3 rounded-ctl border border-line-200">
                                <pre className="whitespace-pre-wrap text-sm text-ink-900">{asset.content}</pre>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
