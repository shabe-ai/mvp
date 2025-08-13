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
    action?: string;
    // CRUD operation fields
    contactId?: string;
    field?: string;
    value?: string;
    contactName?: string;
  };
  suggestions?: string[];
  nextSteps?: string[];
}

export interface ConversationResponse {
  message: string;
  chartSpec?: any;
  enhancedChart?: any;
  data?: any;
  suggestions?: string[];
  needsClarification?: boolean;
  error?: boolean;
  conversationContext?: {
    phase?: string;
    action?: string;
    referringTo?: string;
    // Contact fields
    contactId?: string;
    contactName?: string;
    field?: string;
    value?: string;
    // Account fields
    accountId?: string;
    accountName?: string;
    // Deal fields
    dealId?: string;
    dealName?: string;
    // Activity fields
    activityId?: string;
    activityType?: string;
    subject?: string;
    date?: string;
    // Common fields
    email?: string;
    company?: string | null;
    industry?: string | null;
    website?: string | null;
    amount?: string;
    stage?: string;
    closeDate?: string;
    // Multiple contact selection
    matchingContacts?: Array<{
      id: string;
      name: string;
      email?: string;
      company?: string;
    }>;
  };
  action?: string;
  // CRUD operation fields
  contactId?: string | null;
  accountId?: string | null;
  dealId?: string | null;
  activityId?: string | null;
  field?: string | null;
  value?: string | null;
  contactName?: string;
  accountName?: string;
  dealName?: string;
  activityType?: string;
  subject?: string;
  date?: string;
} 