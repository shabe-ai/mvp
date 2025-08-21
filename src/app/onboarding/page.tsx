'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import OnboardingWizard from '@/components/OnboardingWizard';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  
  // Check if user has a profile
  const userProfile = useQuery(api.profiles.getUserProfile, 
    user?.id ? { userId: user.id } : 'skip'
  );
  
  // Check if user has teams
  const teams = useQuery(api.crm.getTeamsByUser, 
    user?.id ? { userId: user.id } : 'skip'
  );

  useEffect(() => {
    if (isLoaded && user) {
      // If user already has a profile and teams, redirect to main app
      if (userProfile && teams && teams.length > 0) {
        redirect('/');
      }
      setIsCheckingProfile(false);
    }
  }, [isLoaded, user, userProfile, teams]);

  // Show loading while checking
  if (!isLoaded || isCheckingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect to sign in
  if (!user) {
    redirect('/sign-in');
  }

  // Show onboarding wizard
  return <OnboardingWizard />;
}
