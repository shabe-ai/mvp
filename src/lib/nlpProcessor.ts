import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export interface Entity {
  type: 'contact' | 'account' | 'deal' | 'activity' | 'date' | 'amount' | 'email' | 'phone' | 'company';
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export interface ContextualReference {
  type: 'pronoun' | 'name' | 'ambiguous';
  value: string;
  possibleMatches: Array<{
    id: string;
    name: string;
    type: 'contact' | 'account' | 'deal' | 'activity';
    confidence: number;
  }>;
  resolvedEntity?: {
    id: string;
    name: string;
    type: 'contact' | 'account' | 'deal' | 'activity';
  };
  startIndex: number;
  endIndex: number;
}

export interface ConversationContext {
  lastMentionedContact?: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
  };
  lastMentionedAccount?: {
    id: string;
    name: string;
  };
  lastMentionedDeal?: {
    id: string;
    name: string;
  };
  lastMentionedActivity?: {
    id: string;
    name: string;
  };
  conversationHistory: Array<{
    message: string;
    entities: Entity[];
    timestamp: Date;
  }>;
  currentTopic?: string;
  userPreferences?: {
    preferredContactFormat: 'first_last' | 'last_first' | 'nickname';
    preferredDateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  };
}

export class NLPProcessor {
  private context: ConversationContext;

  constructor() {
    this.context = {
      conversationHistory: [],
      userPreferences: {
        preferredContactFormat: 'first_last',
        preferredDateFormat: 'MM/DD/YYYY'
      }
    };
  }

  /**
   * Enhanced entity recognition using GPT-4
   */
  async extractEntities(message: string, userId: string): Promise<Entity[]> {
    try {
      const { openaiClient } = await import('@/lib/openaiClient');
      
      // Get user's CRM data for context
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });

      const systemPrompt = `You are an expert entity recognition system. Extract entities from the user's message and return them in JSON format.

**Available CRM Data:**
Contacts: ${contacts.map(c => `${c.firstName} ${c.lastName} (${c.email || 'no email'})`).join(', ')}
Accounts: ${accounts.map(a => a.name).join(', ')}
Deals: ${deals.map(d => d.name).join(', ')}
Activities: ${activities.map(a => a.subject).join(', ')}

**Entity Types to Extract:**
- contact: Person names from the CRM data
- account: Company/account names
- deal: Deal/opportunity names
- activity: Activity/task subjects
- date: Dates in various formats
- amount: Monetary amounts
- email: Email addresses
- phone: Phone numbers
- company: Company names (not in CRM)

**Instructions:**
1. Look for exact matches in the CRM data first
2. Handle partial matches and nicknames
3. Extract dates in various formats (today, tomorrow, next week, 2024-01-15, etc.)
4. Extract amounts with currency symbols ($1000, 5000, etc.)
5. Return confidence scores (0.0-1.0)
6. Include start and end character indices

**Output Format:**
{
  "entities": [
    {
      "type": "contact",
      "value": "John Smith",
      "confidence": 0.95,
      "startIndex": 10,
      "endIndex": 20,
      "metadata": {
        "contactId": "contact_id_here",
        "email": "john@example.com"
      }
    }
  ]
}

**Message to analyze:** "${message}"`;

      const response = await openaiClient.chatCompletionsCreate({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }, {
        userId,
        operation: 'entity_extraction',
        model: 'gpt-4'
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      try {
        const result = JSON.parse(content);
        return result.entities || [];
      } catch (error) {
        console.error('Failed to parse entity extraction result:', error);
        return [];
      }
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Resolve contextual references (pronouns, ambiguous names)
   */
  async resolveContextualReferences(
    message: string, 
    entities: Entity[], 
    userId: string
  ): Promise<ContextualReference[]> {
    const references: ContextualReference[] = [];
    
    // Look for pronouns
    const pronouns = ['he', 'she', 'they', 'him', 'her', 'them', 'his', 'her', 'their'];
    const words = message.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      if (pronouns.includes(word)) {
        const startIndex = message.toLowerCase().indexOf(word, i > 0 ? message.toLowerCase().indexOf(words[i-1]) + words[i-1].length : 0);
        const endIndex = startIndex + word.length;
        
        const possibleMatches = await this.getPossibleMatches(word, userId);
        references.push({
          type: 'pronoun',
          value: word,
          possibleMatches,
          startIndex,
          endIndex
        });
      }
    }

    // Look for ambiguous names (names that could match multiple entities)
    for (const entity of entities) {
      if (entity.type === 'contact' && entity.confidence < 0.8) {
        const possibleMatches = await this.getPossibleMatches(entity.value, userId);
        if (possibleMatches.length > 1) {
          references.push({
            type: 'ambiguous',
            value: entity.value,
            possibleMatches,
            startIndex: entity.startIndex,
            endIndex: entity.endIndex
          });
        }
      }
    }

    return references;
  }

  /**
   * Get possible matches for a name/pronoun
   */
  private async getPossibleMatches(value: string, userId: string): Promise<Array<{
    id: string;
    name: string;
    type: 'contact' | 'account' | 'deal' | 'activity';
    confidence: number;
  }>> {
    try {
      const teams = await convex.query(api.crm.getTeamsByUser, { userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      
      const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
      const accounts = await convex.query(api.crm.getAccountsByTeam, { teamId });
      const deals = await convex.query(api.crm.getDealsByTeam, { teamId });
      const activities = await convex.query(api.crm.getActivitiesByTeam, { teamId });

      const matches: Array<{
        id: string;
        name: string;
        type: 'contact' | 'account' | 'deal' | 'activity';
        confidence: number;
      }> = [];

      // Check contacts
      for (const contact of contacts) {
        const fullName = `${contact.firstName} ${contact.lastName}`;
        const firstName = contact.firstName || '';
        const lastName = contact.lastName || '';
        
        let confidence = 0;
        if (value.toLowerCase() === fullName.toLowerCase()) confidence = 1.0;
        else if (value.toLowerCase() === firstName.toLowerCase()) confidence = 0.9;
        else if (value.toLowerCase() === lastName.toLowerCase()) confidence = 0.8;
        else if (fullName.toLowerCase().includes(value.toLowerCase())) confidence = 0.7;
        else if (value.toLowerCase().includes(firstName.toLowerCase()) || value.toLowerCase().includes(lastName.toLowerCase())) confidence = 0.6;
        
        if (confidence > 0.5) {
          matches.push({
            id: contact._id,
            name: fullName,
            type: 'contact',
            confidence
          });
        }
      }

      // Check accounts
      for (const account of accounts) {
        const confidence = account.name.toLowerCase().includes(value.toLowerCase()) ? 0.7 : 0;
        if (confidence > 0.5) {
          matches.push({
            id: account._id,
            name: account.name,
            type: 'account',
            confidence
          });
        }
      }

      // Check deals
      for (const deal of deals) {
        const confidence = deal.name.toLowerCase().includes(value.toLowerCase()) ? 0.7 : 0;
        if (confidence > 0.5) {
          matches.push({
            id: deal._id,
            name: deal.name,
            type: 'deal',
            confidence
          });
        }
      }

      // Check activities
      for (const activity of activities) {
        const confidence = activity.subject.toLowerCase().includes(value.toLowerCase()) ? 0.7 : 0;
        if (confidence > 0.5) {
          matches.push({
            id: activity._id,
            name: activity.subject,
            type: 'activity',
            confidence
          });
        }
      }

      // Sort by confidence and return top matches
      return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    } catch (error) {
      console.error('Error getting possible matches:', error);
      return [];
    }
  }

  /**
   * Resolve ambiguity by asking user for clarification
   */
  async resolveAmbiguity(references: ContextualReference[]): Promise<{
    needsClarification: boolean;
    clarificationMessage?: string;
    resolvedReferences: ContextualReference[];
  }> {
    const unresolved = references.filter(ref => !ref.resolvedEntity && ref.possibleMatches.length > 1);
    
    if (unresolved.length === 0) {
      return {
        needsClarification: false,
        resolvedReferences: references
      };
    }

    const clarificationParts = unresolved.map(ref => {
      const options = ref.possibleMatches.map(match => 
        `- ${match.name} (${match.type})`
      ).join('\n');
      
      return `**${ref.value}** could refer to:\n${options}`;
    });

    const clarificationMessage = `I found some ambiguous references. Could you please clarify:\n\n${clarificationParts.join('\n\n')}\n\nPlease specify which one you mean, or provide more details.`;

    return {
      needsClarification: true,
      clarificationMessage,
      resolvedReferences: references
    };
  }

  /**
   * Update conversation context with new information
   */
  updateContext(message: string, entities: Entity[], resolvedReferences: ContextualReference[]): void {
    // Update last mentioned entities
    for (const entity of entities) {
      if (entity.type === 'contact' && entity.metadata?.contactId) {
        this.context.lastMentionedContact = {
          id: entity.metadata.contactId,
          name: entity.value,
          firstName: entity.metadata.firstName || '',
          lastName: entity.metadata.lastName || ''
        };
      }
      // Similar updates for other entity types...
    }

    // Update conversation history
    this.context.conversationHistory.push({
      message,
      entities,
      timestamp: new Date()
    });

    // Keep only last 10 messages for context
    if (this.context.conversationHistory.length > 10) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-10);
    }
  }

  /**
   * Get current conversation context
   */
  getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Process a message with full NLP pipeline
   */
  async processMessage(message: string, userId: string): Promise<{
    entities: Entity[];
    references: ContextualReference[];
    needsClarification: boolean;
    clarificationMessage?: string;
    context: ConversationContext;
  }> {
    // Extract entities
    const entities = await this.extractEntities(message, userId);
    
    // Resolve contextual references
    const references = await this.resolveContextualReferences(message, entities, userId);
    
    // Check for ambiguity
    const ambiguityResult = await this.resolveAmbiguity(references);
    
    // Update context
    this.updateContext(message, entities, ambiguityResult.resolvedReferences);
    
    return {
      entities,
      references: ambiguityResult.resolvedReferences,
      needsClarification: ambiguityResult.needsClarification,
      clarificationMessage: ambiguityResult.clarificationMessage,
      context: this.getContext()
    };
  }
}

// Export singleton instance
export const nlpProcessor = new NLPProcessor(); 