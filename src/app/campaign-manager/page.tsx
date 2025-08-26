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
  Zap
} from 'lucide-react';

interface GeneratedAsset {
  id: string;
  type: 'email' | 'blog' | 'linkedin_post' | 'social_post';
  title: string;
  content: string;
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
}

export default function CampaignManagerPage() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [campaignTopic, setCampaignTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);

  // Hardcoded metrics for demonstration
  const metrics: CampaignMetrics = {
    totalViews: 15420,
    totalLikes: 892,
    totalComments: 234,
    totalShares: 156,
    totalClicks: 1234,
    totalRevenue: 45600,
    roi: 3.2,
    engagementRate: 8.3
  };

  const assetTypes = [
    { value: 'email', label: 'Email Campaign', icon: '📧' },
    { value: 'blog', label: 'Blog Article', icon: '📝' },
    { value: 'linkedin_post', label: 'LinkedIn Post', icon: '💼' },
    { value: 'social_post', label: 'Social Media Post', icon: '📱' },
    { value: 'landing_page', label: 'Landing Page', icon: '🌐' }
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
    // Here you would save to database
    console.log('Saving asset:', assetId);
  };

  const publishAsset = (assetId: string) => {
    setGeneratedAssets(prev => 
      prev.map(asset => 
        asset.id === assetId 
          ? { ...asset, status: 'published' as const }
          : asset
      )
    );
    // Here you would publish to respective platform
    console.log('Publishing asset:', assetId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaign Manager</h1>
          <p className="text-gray-600">Create and manage your marketing campaigns with AI-powered content generation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Section - Metrics Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Campaign Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Eye className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600">{metrics.totalViews.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Views</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Heart className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600">{metrics.totalLikes.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Likes</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <MessageCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600">{metrics.totalComments.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Comments</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <Share2 className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600">{metrics.totalShares.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Shares</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROI and Revenue Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revenue & ROI Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">${metrics.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{metrics.roi}x</div>
                    <div className="text-sm text-gray-600">ROI</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{metrics.engagementRate}%</div>
                    <div className="text-sm text-gray-600">Engagement Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generated Assets Display */}
            {generatedAssets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Generated Campaign Assets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {generatedAssets.map((asset) => (
                      <div key={asset.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={asset.status === 'published' ? 'default' : 'secondary'}>
                              {asset.status}
                            </Badge>
                            <span className="font-medium">{asset.title}</span>
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
                                <Button size="sm" onClick={() => publishAsset(asset.id)}>
                                  <Send className="h-4 w-4 mr-1" />
                                  Publish
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {editingAsset === asset.id ? (
                          <Textarea
                            value={asset.content}
                            onChange={(e) => updateAssetContent(asset.id, e.target.value)}
                            className="min-h-[200px]"
                            placeholder="Edit your content here..."
                          />
                        ) : (
                          <div className="bg-gray-50 p-3 rounded border">
                            <pre className="whitespace-pre-wrap text-sm">{asset.content}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Section - Asset Generator */}
          <div className="space-y-6">
            {/* Asset Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
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
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Campaigns</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assets Created</span>
                    <span className="font-medium">{generatedAssets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Published Today</span>
                    <span className="font-medium">2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
