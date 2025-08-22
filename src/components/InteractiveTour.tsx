'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, X, MessageCircle, Settings, Home, Users, Mail, BarChart3, Download, Calendar } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  message: string;
  action?: string;
  actionUrl?: string;
  actionText?: string;
  icon?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface InteractiveTourProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Shabe AI! 🎉',
    message: 'Let me show you around your new AI-powered CRM. I\'ll guide you through all the key features step by step.',
    icon: <MessageCircle className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'admin-page',
    title: 'Step 1: Admin Setup',
    message: 'First, let\'s set up your Google Workspace integration. This will enable calendar and email features.',
    action: 'navigate',
    actionUrl: '/admin',
    actionText: 'Go to Admin Page',
    icon: <Settings className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'google-integration',
    title: 'Step 2: Connect Google Workspace',
    message: 'In the admin page, find the "Google Workspace Integration" section and click "Connect Account". This will allow you to create calendar events and send emails directly from the chat.',
    action: 'wait',
    actionText: 'I\'ve Connected Google',
    icon: <Settings className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'home-page',
    title: 'Step 3: Explore the Home Page',
    message: 'Now let\'s go to the main interface where you\'ll spend most of your time.',
    action: 'navigate',
    actionUrl: '/',
    actionText: 'Go to Home Page',
    icon: <Home className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'ui-overview',
    title: 'Step 4: Understanding the Interface',
    message: 'Here\'s what you\'ll find on the home page:\n\n• **Left Sidebar**: Live tables showing your contacts, accounts, deals, and activities\n• **Main Chat Area**: Where you interact with your AI assistant\n• **Search Bar**: Quickly find contacts and data\n• **Today\'s Schedule**: See your upcoming meetings and events',
    icon: <Home className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'create-contact',
    title: 'Step 5: Creating Contacts',
    message: 'Creating contacts is super easy! Just say something like:\n\n• "Create a contact for John Smith, john@example.com"\n• "Add Sarah Johnson as a contact"\n• "New contact: Mike Chen, mike@techstart.com, phone 555-0123"\n\nThe AI will understand and create the contact for you automatically.',
    icon: <Users className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'send-email',
    title: 'Step 6: Sending Emails',
    message: 'Send emails directly from the chat:\n\n• "Send email to John Smith"\n• "Email Sarah about the meeting"\n• "Send follow-up to Mike"\n\nThe AI will draft the email, show you a preview, and ask for confirmation before sending.',
    icon: <Mail className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'calendar-events',
    title: 'Step 7: Calendar Integration',
    message: 'Schedule meetings and events naturally:\n\n• "Schedule a meeting with John tomorrow at 2pm"\n• "Book a call with Sarah next Friday"\n• "Set up a meeting with the Acme team"\n\nThe AI will create calendar events and send invites automatically.',
    icon: <Calendar className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'reports-analytics',
    title: 'Step 8: Reports & Analytics',
    message: 'Generate reports and charts with natural language:\n\n• "Show me a chart of deals by stage"\n• "Create a bar chart of contacts by company"\n• "Analyze my sales pipeline"\n• "Export my contacts to CSV"\n\nThe AI will create beautiful visualizations and export data for you.',
    icon: <BarChart3 className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'auto-logging',
    title: 'Step 9: Automatic Activity Logging',
    message: 'The best part? You never have to manually log activities again! The system automatically:\n\n• Logs emails sent to contacts\n• Records calendar events as activities\n• Tracks interactions with your CRM data\n\nEverything is automatically organized and searchable.',
    icon: <MessageCircle className="w-5 h-5" />,
    position: 'bottom'
  },
  {
    id: 'completion',
    title: 'You\'re All Set! 🚀',
    message: 'Congratulations! You now know how to use all the key features of Shabe AI. Start by trying:\n\n• "Create a contact for [name]"\n• "Show me my contacts"\n• "Send email to [contact]"\n• "Schedule a meeting with [contact]"\n\nYour AI assistant is ready to help you manage your CRM efficiently!',
    icon: <MessageCircle className="w-5 h-5" />,
    position: 'bottom'
  }
];

export default function InteractiveTour({ isVisible, onComplete, onSkip }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTourVisible, setIsTourVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsTourVisible(true);
      setCurrentStep(0);
    }
  }, [isVisible]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = (step: TourStep) => {
    if (step.action === 'navigate' && step.actionUrl) {
      window.location.href = step.actionUrl;
    } else if (step.action === 'wait') {
      // For wait actions, just proceed to next step
      handleNext();
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!isTourVisible) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="relative max-w-md w-full">
        <Card className="w-full">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {currentTourStep.icon}
                <h3 className="text-lg font-semibold text-text-primary">
                  {currentTourStep.title}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Message */}
            <div className="mb-6">
              <p className="text-text-secondary whitespace-pre-line leading-relaxed">
                {currentTourStep.message}
              </p>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-text-secondary mb-2">
                <span>Step {currentStep + 1} of {tourSteps.length}</span>
                <span>{Math.round(((currentStep + 1) / tourSteps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-neutral-secondary/20 rounded-full h-2">
                <div 
                  className="bg-accent-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="border-neutral-secondary text-text-secondary hover:bg-neutral-secondary/20"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex space-x-2">
                {currentTourStep.action && (
                  <Button
                    onClick={() => handleAction(currentTourStep)}
                    className="bg-accent-primary text-text-on-accent-primary hover:bg-accent-primary-hover"
                  >
                    {currentTourStep.actionText}
                  </Button>
                )}
                
                <Button
                  onClick={handleNext}
                  className="bg-accent-primary text-text-on-accent-primary hover:bg-accent-primary-hover"
                >
                  {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
