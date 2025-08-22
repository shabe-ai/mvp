'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import InteractiveTour from './InteractiveTour';

export default function SimpleTourButton() {
  const [showTour, setShowTour] = useState(false);

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
  };

  const handleTourSkip = () => {
    setShowTour(false);
  };

  return (
    <>
      <Button
        onClick={handleStartTour}
        variant="outline"
        size="sm"
        className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
      >
        <Play className="w-4 h-4 mr-2" />
        Take Tour
      </Button>

      <InteractiveTour 
        isVisible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        showSkipPermanently={false}
      />
    </>
  );
}
