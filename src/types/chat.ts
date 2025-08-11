export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  action?: string;
  objectType?: string;
  partialDetails?: Record<string, string>;
  details?: Record<string, string>;
  data?: any[];
  chartSpec?: any;
  enhancedChart?: boolean;
  contactName?: string;
  contactId?: string;
  field?: string;
  value?: string;
  contactEmail?: string;
  accountId?: string;
  accountName?: string;
  dealId?: string;
  dealName?: string;
  activityId?: string;
  activitySubject?: string;
  // New fields for conversation management
  conversationContext?: {
    phase?: string;
    referringTo?: string;
    intent?: string;
  };
  suggestions?: string[];
  nextSteps?: string[];
}

export interface ConversationResponse {
  message: string;
  chartSpec?: any;
  enhancedChart?: boolean;
  suggestions?: string[];
  nextSteps?: string[];
  conversationContext?: {
    phase: string;
    action: string;
    referringTo?: string;
  };
  error?: boolean;
  needsClarification?: boolean;
} 