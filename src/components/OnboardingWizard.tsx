'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, CheckCircle, User, Building, Settings, Zap } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  department: string;
  bio: string;
  timezone: string;
  communicationStyle: 'formal' | 'casual' | 'friendly' | 'professional';
  preferredDetailLevel: 'brief' | 'detailed' | 'comprehensive';
  responseLength: 'short' | 'medium' | 'long';
  humorPreference: 'none' | 'light' | 'moderate';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  role: string;
  responsibilities: string[];
  targetIndustries: string[];
  targetCompanySizes: string[];
}

interface CompanyProfileData {
  name: string;
  website: string;
  description: string;
  industry: string;
  founded: number;
  email: string;
  phone: string;
  companySize: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  annualRevenue: '<$1M' | '$1M-$10M' | '$10M-$100M' | '$100M+';
  businessModel: string;
  targetMarket: string;
  currentCrm: string;
  painPoints: string[];
  goals: string[];
  teamSize: number;
  primaryColor: string;
  brandVoice: string;
}

export default function OnboardingWizard() {
  const { user } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Profile data state
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.emailAddresses[0]?.emailAddress || '',
    phone: '',
    title: '',
    department: '',
    bio: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    communicationStyle: 'professional',
    preferredDetailLevel: 'detailed',
    responseLength: 'medium',
    humorPreference: 'light',
    emojiUsage: 'minimal',
    role: '',
    responsibilities: [],
    targetIndustries: [],
    targetCompanySizes: [],
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData>({
    name: '',
    website: '',
    description: '',
    industry: '',
    founded: new Date().getFullYear(),
    email: '',
    phone: '',
    companySize: '1-10',
    annualRevenue: '<$1M',
    businessModel: '',
    targetMarket: '',
    currentCrm: '',
    painPoints: [],
    goals: [],
    teamSize: 1,
    primaryColor: '#3B82F6',
    brandVoice: 'Professional',
  });

  // Convex mutations
  const createUserProfile = useMutation(api.profiles.createUserProfile);
  const createCompanyProfile = useMutation(api.profiles.createCompanyProfile);
  const createTeam = useMutation(api.crm.createTeam);

  // Get user's teams
  const teams = useQuery(api.crm.getTeamsByUser, { userId: user?.id || '' });

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Shabe AI',
      description: 'Let\'s get you set up with your AI-powered CRM',
      icon: <Zap className="w-6 h-6" />,
      component: <WelcomeStep onNext={() => setCurrentStep(1)} />
    },
    {
      id: 'user-profile',
      title: 'Tell us about yourself',
      description: 'Help us personalize your AI assistant',
      icon: <User className="w-6 h-6" />,
      component: <UserProfileStep 
        data={userProfile} 
        onChange={setUserProfile}
        onNext={() => setCurrentStep(2)}
        onBack={() => setCurrentStep(0)}
      />
    },
    {
      id: 'company-profile',
      title: 'Company Information',
      description: 'Tell us about your business',
      icon: <Building className="w-6 h-6" />,
      component: <CompanyProfileStep 
        data={companyProfile} 
        onChange={setCompanyProfile}
        onNext={() => setCurrentStep(3)}
        onBack={() => setCurrentStep(1)}
      />
    },
    {
      id: 'ai-preferences',
      title: 'AI Assistant Preferences',
      description: 'Customize how your AI assistant communicates',
      icon: <Settings className="w-6 h-6" />,
      component: <AIPreferencesStep 
        userData={userProfile}
        onNext={handleComplete}
        onBack={() => setCurrentStep(2)}
      />
    }
  ];

  async function handleComplete() {
    try {
      // Create team first
      const teamId = await createTeam({
        name: companyProfile.name || 'My Team',
        ownerId: user?.id || '',
      });

      // Create user profile
      await createUserProfile({
        userId: user?.id || '',
        teamId,
        ...userProfile,
      });

      // Create company profile
      await createCompanyProfile({
        teamId,
        ownerId: user?.id || '',
        ...companyProfile,
      });

      setIsComplete(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to Shabe AI!</CardTitle>
            <CardDescription>
              Your AI-powered CRM is ready to go. Start chatting with your AI assistant to manage your contacts, deals, and activities.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index <= currentStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-500'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-600 mt-1">
              {steps[currentStep].description}
            </p>
          </div>
        </div>

        {/* Step Content */}
        <Card className="w-full">
          <CardContent className="p-6">
            {steps[currentStep].component}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Step Components
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome to Shabe AI
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Your AI-powered CRM that understands natural language. Create contacts, manage deals, and log activities - all through conversation.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="p-4 bg-blue-50 rounded-lg">
          <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold">AI-First</h3>
          <p className="text-sm text-gray-600">Natural language interface</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <h3 className="font-semibold">Auto-Logging</h3>
          <p className="text-sm text-gray-600">Never manually log again</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <Settings className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <h3 className="font-semibold">Smart Integration</h3>
          <p className="text-sm text-gray-600">Calendar & email sync</p>
        </div>
      </div>

      <Button onClick={onNext} className="mt-8">
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function UserProfileStep({ 
  data, 
  onChange, 
  onNext, 
  onBack 
}: { 
  data: UserProfileData; 
  onChange: (data: UserProfileData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const handleChange = (field: keyof UserProfileData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={data.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="John"
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={data.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Doe"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@company.com"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
        <div>
          <Label htmlFor="title">Job Title</Label>
          <Input
            id="title"
            value={data.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Sales Manager"
          />
        </div>
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={data.department}
            onChange={(e) => handleChange('department', e.target.value)}
            placeholder="Sales"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={data.bio}
          onChange={(e) => handleChange('bio', e.target.value)}
          placeholder="Tell us a bit about yourself..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Select value={data.timezone} onValueChange={(value) => handleChange('timezone', value)}>
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
            value={data.role}
            onChange={(e) => handleChange('role', e.target.value)}
            placeholder="Sales, Marketing, etc."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function CompanyProfileStep({ 
  data, 
  onChange, 
  onNext, 
  onBack 
}: { 
  data: CompanyProfileData; 
  onChange: (data: CompanyProfileData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const handleChange = (field: keyof CompanyProfileData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={data.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={data.website}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="https://acme.com"
          />
        </div>
        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            value={data.industry}
            onChange={(e) => handleChange('industry', e.target.value)}
            placeholder="Technology, Healthcare, etc."
          />
        </div>
        <div>
          <Label htmlFor="founded">Founded Year</Label>
          <Input
            id="founded"
            type="number"
            value={data.founded}
            onChange={(e) => handleChange('founded', parseInt(e.target.value))}
            placeholder="2020"
          />
        </div>
        <div>
          <Label htmlFor="companySize">Company Size</Label>
          <Select value={data.companySize} onValueChange={(value: any) => handleChange('companySize', value)}>
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
          <Select value={data.annualRevenue} onValueChange={(value: any) => handleChange('annualRevenue', value)}>
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
          value={data.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="What does your company do?"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="businessModel">Business Model</Label>
          <Input
            id="businessModel"
            value={data.businessModel}
            onChange={(e) => handleChange('businessModel', e.target.value)}
            placeholder="B2B SaaS, E-commerce, etc."
          />
        </div>
        <div>
          <Label htmlFor="targetMarket">Target Market</Label>
          <Input
            id="targetMarket"
            value={data.targetMarket}
            onChange={(e) => handleChange('targetMarket', e.target.value)}
            placeholder="Small businesses, Enterprise, etc."
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function AIPreferencesStep({ 
  userData, 
  onNext, 
  onBack 
}: { 
  userData: UserProfileData;
  onNext: () => void;
  onBack: () => void;
}) {
  const [preferences, setPreferences] = useState({
    communicationStyle: userData.communicationStyle,
    preferredDetailLevel: userData.preferredDetailLevel,
    responseLength: userData.responseLength,
    humorPreference: userData.humorPreference,
    emojiUsage: userData.emojiUsage,
  });

  const handleChange = (field: string, value: any) => {
    setPreferences({ ...preferences, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">How should your AI assistant communicate?</h3>
        
        <div>
          <Label>Communication Style</Label>
          <Select value={preferences.communicationStyle} onValueChange={(value) => handleChange('communicationStyle', value)}>
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
          <Select value={preferences.preferredDetailLevel} onValueChange={(value) => handleChange('preferredDetailLevel', value)}>
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
          <Select value={preferences.responseLength} onValueChange={(value) => handleChange('responseLength', value)}>
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
          <Select value={preferences.humorPreference} onValueChange={(value) => handleChange('humorPreference', value)}>
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
          <Select value={preferences.emojiUsage} onValueChange={(value) => handleChange('emojiUsage', value)}>
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
        <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
        <p className="text-blue-800 text-sm">
          Your AI assistant will adapt its communication style based on these preferences. 
          You can always adjust these settings later in your profile.
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Complete Setup
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
