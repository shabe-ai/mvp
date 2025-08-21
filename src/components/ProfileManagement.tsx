'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Building, Settings, Save, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileManagement() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('user');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get user's teams
  const teams = useQuery(api.crm.getTeamsByUser, { userId: user?.id || '' });
  const teamId = teams?.[0]?._id;

  // Get profiles
  const userProfile = useQuery(api.profiles.getUserProfile, { userId: user?.id || '' });
  const companyProfile = useQuery(api.profiles.getCompanyProfile, { teamId: teamId || '' });

  // Mutations
  const updateUserProfile = useMutation(api.profiles.updateUserProfile);
  const updateCompanyProfile = useMutation(api.profiles.updateCompanyProfile);

  // Form state
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    department: '',
    bio: '',
    timezone: '',
    communicationStyle: 'professional' as 'formal' | 'casual' | 'friendly' | 'professional',
    preferredDetailLevel: 'detailed' as 'brief' | 'detailed' | 'comprehensive',
    responseLength: 'medium' as 'short' | 'medium' | 'long',
    humorPreference: 'light' as 'none' | 'light' | 'moderate',
    emojiUsage: 'minimal' as 'none' | 'minimal' | 'moderate' | 'frequent',
    role: '',
    responsibilities: [] as string[],
    targetIndustries: [] as string[],
    targetCompanySizes: [] as string[],
  });

  const [companyForm, setCompanyForm] = useState({
    name: '',
    website: '',
    description: '',
    industry: '',
    founded: new Date().getFullYear(),
    email: '',
    phone: '',
    companySize: '1-10' as '1-10' | '11-50' | '51-200' | '201-1000' | '1000+',
    annualRevenue: '<$1M' as '<$1M' | '$1M-$10M' | '$10M-$100M' | '$100M+',
    businessModel: '',
    targetMarket: '',
    currentCrm: '',
    painPoints: [] as string[],
    goals: [] as string[],
    teamSize: 1,
    primaryColor: '#3B82F6',
    brandVoice: 'Professional',
  });

  // Load data into forms
  useEffect(() => {
    if (userProfile) {
      setUserForm({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        title: userProfile.title || '',
        department: userProfile.department || '',
        bio: userProfile.bio || '',
        timezone: userProfile.timezone || '',
        communicationStyle: userProfile.communicationStyle || 'professional',
        preferredDetailLevel: userProfile.preferredDetailLevel || 'detailed',
        responseLength: userProfile.responseLength || 'medium',
        humorPreference: userProfile.humorPreference || 'light',
        emojiUsage: userProfile.emojiUsage || 'minimal',
        role: userProfile.role || '',
        responsibilities: userProfile.responsibilities || [],
        targetIndustries: userProfile.targetIndustries || [],
        targetCompanySizes: userProfile.targetCompanySizes || [],
      });
    }
  }, [userProfile]);

  useEffect(() => {
    if (companyProfile) {
      setCompanyForm({
        name: companyProfile.name || '',
        website: companyProfile.website || '',
        description: companyProfile.description || '',
        industry: companyProfile.industry || '',
        founded: companyProfile.founded || new Date().getFullYear(),
        email: companyProfile.email || '',
        phone: companyProfile.phone || '',
        companySize: companyProfile.companySize || '1-10',
        annualRevenue: companyProfile.annualRevenue || '<$1M',
        businessModel: companyProfile.businessModel || '',
        targetMarket: companyProfile.targetMarket || '',
        currentCrm: companyProfile.currentCrm || '',
        painPoints: companyProfile.painPoints || [],
        goals: companyProfile.goals || [],
        teamSize: companyProfile.teamSize || 1,
        primaryColor: companyProfile.primaryColor || '#3B82F6',
        brandVoice: companyProfile.brandVoice || 'Professional',
      });
    }
  }, [companyProfile]);

  const handleSave = async () => {
    if (!user?.id || !teamId) return;

    setIsLoading(true);
    try {
      // Update user profile
      await updateUserProfile({
        userId: user.id,
        updates: userForm,
      });

      // Update company profile
      await updateCompanyProfile({
        teamId,
        updates: companyForm,
      });

      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset forms to original data
    if (userProfile) {
      setUserForm({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        title: userProfile.title || '',
        department: userProfile.department || '',
        bio: userProfile.bio || '',
        timezone: userProfile.timezone || '',
        communicationStyle: userProfile.communicationStyle || 'professional',
        preferredDetailLevel: userProfile.preferredDetailLevel || 'detailed',
        responseLength: userProfile.responseLength || 'medium',
        humorPreference: userProfile.humorPreference || 'light',
        emojiUsage: userProfile.emojiUsage || 'minimal',
        role: userProfile.role || '',
        responsibilities: userProfile.responsibilities || [],
        targetIndustries: userProfile.targetIndustries || [],
        targetCompanySizes: userProfile.targetCompanySizes || [],
      });
    }

    if (companyProfile) {
      setCompanyForm({
        name: companyProfile.name || '',
        website: companyProfile.website || '',
        description: companyProfile.description || '',
        industry: companyProfile.industry || '',
        founded: companyProfile.founded || new Date().getFullYear(),
        email: companyProfile.email || '',
        phone: companyProfile.phone || '',
        companySize: companyProfile.companySize || '1-10',
        annualRevenue: companyProfile.annualRevenue || '<$1M',
        businessModel: companyProfile.businessModel || '',
        targetMarket: companyProfile.targetMarket || '',
        currentCrm: companyProfile.currentCrm || '',
        painPoints: companyProfile.painPoints || [],
        goals: companyProfile.goals || [],
        teamSize: companyProfile.teamSize || 1,
        primaryColor: companyProfile.primaryColor || '#3B82F6',
        brandVoice: companyProfile.brandVoice || 'Professional',
      });
    }

    setIsEditing(false);
  };

  if (!userProfile && !companyProfile) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No profile data found. Please complete onboarding first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile Management</h2>
          <p className="text-gray-600">Manage your personal and company information</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
                <Save className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="user" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Personal Profile
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Company Profile
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            AI Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your basic contact and professional information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={userForm.title}
                    onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={userForm.bio}
                  onChange={(e) => setUserForm({ ...userForm, bio: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select 
                    value={userForm.timezone} 
                    onValueChange={(value) => setUserForm({ ...userForm, timezone: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Your business details and context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="founded">Founded Year</Label>
                  <Input
                    id="founded"
                    type="number"
                    value={companyForm.founded}
                    onChange={(e) => setCompanyForm({ ...companyForm, founded: parseInt(e.target.value) })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select 
                    value={companyForm.companySize} 
                    onValueChange={(value: any) => setCompanyForm({ ...companyForm, companySize: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees</SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="annualRevenue">Annual Revenue</Label>
                  <Select 
                    value={companyForm.annualRevenue} 
                    onValueChange={(value: any) => setCompanyForm({ ...companyForm, annualRevenue: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<$1M">Less than $1M</SelectItem>
                      <SelectItem value="$1M-$10M">$1M - $10M</SelectItem>
                      <SelectItem value="$10M-$100M">$10M - $100M</SelectItem>
                      <SelectItem value="$100M+">$100M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Company Description</Label>
                <Textarea
                  id="description"
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessModel">Business Model</Label>
                  <Input
                    id="businessModel"
                    value={companyForm.businessModel}
                    onChange={(e) => setCompanyForm({ ...companyForm, businessModel: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="targetMarket">Target Market</Label>
                  <Input
                    id="targetMarket"
                    value={companyForm.targetMarket}
                    onChange={(e) => setCompanyForm({ ...companyForm, targetMarket: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant Preferences</CardTitle>
              <CardDescription>Customize how your AI assistant communicates with you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Communication Style</Label>
                  <Select 
                    value={userForm.communicationStyle} 
                    onValueChange={(value: any) => setUserForm({ ...userForm, communicationStyle: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal - Professional and business-like</SelectItem>
                      <SelectItem value="casual">Casual - Relaxed and conversational</SelectItem>
                      <SelectItem value="friendly">Friendly - Warm and approachable</SelectItem>
                      <SelectItem value="professional">Professional - Balanced and polished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Detail Level</Label>
                  <Select 
                    value={userForm.preferredDetailLevel} 
                    onValueChange={(value: any) => setUserForm({ ...userForm, preferredDetailLevel: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief - Just the essentials</SelectItem>
                      <SelectItem value="detailed">Detailed - Comprehensive information</SelectItem>
                      <SelectItem value="comprehensive">Comprehensive - Full context and explanations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Response Length</Label>
                  <Select 
                    value={userForm.responseLength} 
                    onValueChange={(value: any) => setUserForm({ ...userForm, responseLength: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short - Concise responses</SelectItem>
                      <SelectItem value="medium">Medium - Balanced length</SelectItem>
                      <SelectItem value="long">Long - Detailed responses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Humor Preference</Label>
                  <Select 
                    value={userForm.humorPreference} 
                    onValueChange={(value: any) => setUserForm({ ...userForm, humorPreference: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None - Strictly professional</SelectItem>
                      <SelectItem value="light">Light - Occasional friendly tone</SelectItem>
                      <SelectItem value="moderate">Moderate - Balanced with personality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Emoji Usage</Label>
                  <Select 
                    value={userForm.emojiUsage} 
                    onValueChange={(value: any) => setUserForm({ ...userForm, emojiUsage: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None - No emojis</SelectItem>
                      <SelectItem value="minimal">Minimal - Occasional use</SelectItem>
                      <SelectItem value="moderate">Moderate - Regular use</SelectItem>
                      <SelectItem value="frequent">Frequent - Often used</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">AI Context Preview</h4>
                <p className="text-blue-800 text-sm">
                  Your AI assistant will use this information to provide personalized responses and better understand your business context.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
