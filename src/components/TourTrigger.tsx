'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Play, X } from 'lucide-react';
import InteractiveTour from './InteractiveTour';

export default function TourTrigger() {
  const { user } = useUser();
  const [showTour, setShowTour] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  // Get tour preferences with error handling
  const tourPreferences = useQuery(api.profiles.getTourPreferences, 
    user?.id ? { userId: user.id } : 'skip'
  );

  // Mutations
  const markTourAsSeen = useMutation(api.profiles.markTourAsSeen);
  const skipTourPermanently = useMutation(api.profiles.skipTourPermanently);

  // Handle loading and error states gracefully
  if (!user?.id) {
    return null;
  }

  // If there's an error or loading, don't show anything
  if (tourPreferences === undefined) {
    return null;
  }

  // Don't show if user has skipped tour permanently
  if (tourPreferences.hasSkippedTour || !showBanner) {
    return null;
  }

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = async () => {
    try {
      if (user?.id) {
        await markTourAsSeen({ userId: user.id });
      }
    } catch (error) {
      console.error('Error marking tour as seen:', error);
    }
    setShowTour(false);
    setShowBanner(false);
  };

  const handleTourSkip = async () => {
    try {
      if (user?.id) {
        await skipTourPermanently({ userId: user.id });
      }
    } catch (error) {
      console.error('Error skipping tour permanently:', error);
    }
    setShowTour(false);
    setShowBanner(false);
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
  };

  return (
    <>
      {/* Tour Banner */}
      {!tourPreferences.hasSeenTour && (
        <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-md p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Play className="w-5 h-5 text-accent-primary" />
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  Welcome to Shabe AI! 🎉
                </h3>
                <p className="text-sm text-text-secondary">
                  Take a quick tour to learn about all the features
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleStartTour}
                size="sm"
                className="bg-accent-primary text-text-on-accent-primary hover:bg-accent-primary-hover"
              >
                Start Tour
              </Button>
              <Button
                onClick={handleDismissBanner}
                variant="ghost"
                size="sm"
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Button for users who have seen the banner but want to retake tour */}
      {tourPreferences.hasSeenTour && !tourPreferences.hasSkippedTour && (
        <Button
          onClick={handleStartTour}
          variant="outline"
          size="sm"
          className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
        >
          <Play className="w-4 h-4 mr-2" />
          Take Tour
        </Button>
      )}

      {/* Interactive Tour */}
      <InteractiveTour 
        isVisible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        showSkipPermanently={true}
        onSkipPermanently={handleTourSkip}
      />
    </>
  );
}
