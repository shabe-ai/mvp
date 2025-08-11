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
  enhancedChart?: boolean;
  data?: any[] | {
    records: any[];
    type: string;
    count: number;
    displayFormat: string;
  };
  suggestions?: string[];
  nextSteps?: string[];
  conversationContext?: {
    phase: string;
    action: string;
    referringTo?: string;
    // CRUD operation fields
    contactId?: string;
    field?: string;
    value?: string;
    contactName?: string;
  };
  error?: boolean;
  needsClarification?: boolean;
  // CRUD operation fields
  action?: string;
  contactId?: string;
  field?: string;
  value?: string;
  contactName?: string;
} 