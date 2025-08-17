import { SimplifiedIntent } from './simplifiedIntentClassifier';
import { conversationalHandler } from './conversationalHandler';
import { logger } from './logger';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

interface IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean;
  handle(intent: SimplifiedIntent, context: any): Promise<any>;
}

interface IntentRouterContext {
  userId: string;
  conversationManager?: any;
  messages?: any[];
  userProfile?: any;
  companyData?: any;
  lastAction?: string;
}

class IntentRouter {
  private handlers: IntentHandler[] = [];

  registerHandler(handler: IntentHandler) {
    this.handlers.push(handler);
  }

  async routeIntent(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Routing intent', {
      action: intent.action,
      confidence: intent.confidence,
      userId: context.userId,
      originalMessage: intent.originalMessage,
      entities: intent.entities
    });

    // Find the appropriate handler
    const handler = this.handlers.find(h => h.canHandle(intent));
    
    if (handler) {
      logger.info('Found handler for intent', {
        action: intent.action,
        handlerType: handler.constructor.name,
        userId: context.userId
      });
      return await handler.handle(intent, context);
    }

    logger.warn('No specific handler found, falling back to general conversation', {
      action: intent.action,
      userId: context.userId
    });

    // Fallback to general conversation
    return await conversationalHandler.handleConversation(
      intent.originalMessage || intent.context.userGoal || 'General conversation',
      context.conversationManager,
      context
    );
  }
}

// Chart Intent Handler
class ChartIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_chart' || 
           intent.action === 'modify_chart' || 
           intent.action === 'analyze_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling chart intent', {
      action: intent.action,
      userId: context.userId
    });

    if (intent.action === 'modify_chart') {
      logger.info('Handling chart modification request', {
        userId: context.userId
      });
    }

    // Use conversational handler for chart operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Chart operation',
      context.conversationManager,
      context
    );
  }
}

// Data Intent Handler
class DataIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_data' || 
           intent.action === 'export_data' ||
           intent.action === 'explore_data' ||
           intent.action === 'view_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling data intent', {
      action: intent.action,
      originalMessage: intent.originalMessage,
      entities: intent.entities,
      userId: context.userId
    });

    // For view_data actions, provide intelligent responses using available data
    if (intent.action === 'view_data') {
      logger.info('Processing view_data action', {
        originalMessage: intent.originalMessage,
        userId: context.userId
      });
      
      const userMessage = intent.originalMessage.toLowerCase();
      


      try {
        // Use Convex client directly for all data queries
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        
        // Get team ID by querying user's teams
        let teamId: string;
        try {
          const teams = await convex.query(api.crm.getTeamsByUser, { userId: context.userId });
          teamId = teams.length > 0 ? teams[0]._id : 'default';
          
          logger.info('Team ID retrieved for data query', {
            teamId,
            teamsCount: teams.length,
            userId: context.userId
          });
        } catch (error) {
          logger.error('Failed to get team ID', error as Error, { userId: context.userId });
          return {
            type: 'text',
            content: "I'm having trouble accessing your team data. Please try again in a moment.",
            data: { error: 'Failed to get team ID' }
          };
        }
        
        // Determine what data the user is asking about
        let dataType = 'contacts'; // default
        let queryType = 'list'; // default
        
        // Detect data type from user message
        if (userMessage.includes('contact')) {
          dataType = 'contacts';
        } else if (userMessage.includes('deal')) {
          dataType = 'deals';
        } else if (userMessage.includes('account')) {
          dataType = 'accounts';
        } else if (userMessage.includes('activity') || userMessage.includes('task')) {
          dataType = 'activities';
        }
        
                   // Detect query type
           if (userMessage.includes('how many') || userMessage.includes('count')) {
             queryType = 'count';
           } else if (userMessage.includes('details') || userMessage.includes('email') || userMessage.includes('phone') || userMessage.includes('company') || userMessage.includes("'s") || userMessage.includes('view')) {
             queryType = 'details';
           } else if (userMessage.includes('name') || userMessage.includes('list') || userMessage.includes('show')) {
             queryType = 'list';
           }
           
           // If we have a specific contact name in entities, default to details unless it's explicitly a count
           if (intent.entities?.contactName && queryType !== 'count') {
             queryType = 'details';
           }
        
        logger.info('Data query analysis', {
          dataType,
          queryType,
          userMessage,
          userId: context.userId
        });

        // Fetch data based on type
        let data: any[] = [];
        let content = '';
        
        switch (dataType) {
          case 'contacts':
            data = await convex.query(api.crm.getContactsByTeam, { teamId });
            break;
          case 'deals':
            data = await convex.query(api.crm.getDealsByTeam, { teamId });
            break;
          case 'accounts':
            data = await convex.query(api.crm.getAccountsByTeam, { teamId });
            break;
          case 'activities':
            data = await convex.query(api.crm.getActivitiesByTeam, { teamId });
            break;
          default:
            data = await convex.query(api.crm.getContactsByTeam, { teamId });
        }

        logger.info('Successfully retrieved data from Convex', {
          dataType,
          dataCount: data.length,
          userId: context.userId
        });

        // Generate intelligent response based on query type
        logger.info('Generating response content', {
          queryType,
          dataType,
          dataLength: data.length,
          userId: context.userId
        });
        
        switch (queryType) {
          case 'count':
            content = `You have ${data.length} ${dataType} in your database.`;
            logger.info('Generated count response', { content, userId: context.userId });
            break;
            
          case 'list':
            if (dataType === 'contacts') {
              const names = data.map(contact => {
                const firstName = contact.firstName || '';
                const lastName = contact.lastName || '';
                return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unknown';
              });
              
              if (names.length <= 10) {
                content = `Here are your ${dataType}:\n${names.join(', ')}`;
              } else {
                content = `You have ${data.length} ${dataType}. Here are the first 10:\n${names.slice(0, 10).join(', ')}...`;
              }
            } else {
              const items = data.map(item => item.name || item.title || item.subject || 'Unknown');
              if (items.length <= 10) {
                content = `Here are your ${dataType}:\n${items.join(', ')}`;
              } else {
                content = `You have ${data.length} ${dataType}. Here are the first 10:\n${items.slice(0, 10).join(', ')}...`;
              }
            }
            break;
            
                       case 'details':
               if (dataType === 'contacts') {
                 // Check if we have a specific contact name in the entities
                 const contactName = intent.entities?.contactName;
                 
                 if (contactName) {
                   // Filter for the specific contact
                   const targetContact = data.find(contact => {
                     const fullName = contact.firstName && contact.lastName ? 
                       `${contact.firstName} ${contact.lastName}`.toLowerCase() : 
                       (contact.firstName || contact.lastName || '').toLowerCase();
                     return fullName.includes(contactName.toLowerCase());
                   });
                   
                   if (targetContact) {
                     const name = targetContact.firstName && targetContact.lastName ? 
                       `${targetContact.firstName} ${targetContact.lastName}` : 
                       targetContact.firstName || targetContact.lastName || 'Unknown';
                     const email = targetContact.email || 'No email';
                     const phone = targetContact.phone || 'No phone';
                     const company = targetContact.company || 'No company';
                     const leadStatus = targetContact.leadStatus || 'No status';
                     
                     content = `Here are the details for ${name}:\n\n` +
                       `📧 Email: ${email}\n` +
                       `📞 Phone: ${phone}\n` +
                       `🏢 Company: ${company}\n` +
                       `📊 Lead Status: ${leadStatus}`;
                   } else {
                     content = `I couldn't find a contact named "${contactName}". Here are all your contacts:\n` +
                       data.map(contact => {
                         const name = contact.firstName && contact.lastName ? 
                           `${contact.firstName} ${contact.lastName}` : 
                           contact.firstName || contact.lastName || 'Unknown';
                         return `• ${name}`;
                       }).join('\n');
                   }
                 } else {
                   // Show details for first 5 contacts
                   const details = data.slice(0, 5).map(contact => {
                     const name = contact.firstName && contact.lastName ? 
                       `${contact.firstName} ${contact.lastName}` : 
                       contact.firstName || contact.lastName || 'Unknown';
                     const email = contact.email || 'No email';
                     const phone = contact.phone || 'No phone';
                     const company = contact.company || 'No company';
                     return `${name} (${email}, ${phone}, ${company})`;
                   });
                   content = `Here are the details for your ${dataType}:\n${details.join('\n')}`;
                 }
               } else {
                 const details = data.slice(0, 5).map(item => {
                   const name = item.name || item.title || item.subject || 'Unknown';
                   const description = item.description || 'No description';
                   return `${name}: ${description}`;
                 });
                 content = `Here are the details for your ${dataType}:\n${details.join('\n')}`;
               }
               break;
            
          default:
            content = `You have ${data.length} ${dataType} in your database.`;
        }

                   // Only include data field for details queries, not for simple counts or lists
           const response: any = {
             type: 'text',
             content
           };
           
           logger.info('Final response object', {
             type: response.type,
             content: response.content,
             hasData: queryType === 'details',
             userId: context.userId
           });
           
           // Don't add data field to avoid triggering Data Preview modal
           // The formatted content is sufficient for user display
        
        return response;
        
      } catch (error) {
        logger.error('Error retrieving data', error as Error, { 
          dataType: 'unknown',
          userId: context.userId 
        });
        
        return {
          type: 'text',
          content: "I'm having trouble accessing your data right now. Please try again in a moment.",
          data: {
            error: 'Failed to retrieve data'
          }
        };
      }
    }
    
    // For other data operations, use conversational handler
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Data operation',
      context.conversationManager,
      context
    );
  }
}

// CRUD Intent Handler
class CrudIntentHandler implements IntentHandler {
  private convex: ConvexHttpClient;

  constructor() {
    this.convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }

  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'create_contact' || 
           intent.action === 'update_contact' || 
           intent.action === 'delete_contact' ||
           intent.action === 'create_account' ||
           intent.action === 'update_account' ||
           intent.action === 'delete_account' ||
           intent.action === 'create_deal' ||
           intent.action === 'update_deal' ||
           intent.action === 'delete_deal';
  }

  private parseContactData(entities: any, originalMessage: string): {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    leadStatus?: string;
  } {
    // Try to extract from entities first
    let firstName = entities.firstName || '';
    let lastName = entities.lastName || '';
    let email = entities.email || '';
    let phone = entities.phone || '';
    let company = entities.company || '';
    let leadStatus = entities.leadStatus || '';

    // If we have a contactName, try to split it into first and last name
    if (entities.contactName && !firstName && !lastName) {
      const nameParts = entities.contactName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // If we still don't have names, try to extract from the original message
    if (!firstName && !lastName) {
      const nameMatch = originalMessage.match(/([A-Za-z]+)\s+([A-Za-z]+)/);
      if (nameMatch) {
        firstName = nameMatch[1];
        lastName = nameMatch[2];
      }
    }

    // Extract email if not already found
    if (!email) {
      const emailMatch = originalMessage.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        email = emailMatch[1];
      }
    }

    // Extract phone if not already found
    if (!phone) {
      const phoneMatch = originalMessage.match(/(?:phone|tel|mobile|cell)[:\s-]*([0-9\-\(\)\s]+)/i);
      if (phoneMatch) {
        phone = phoneMatch[1].trim();
      }
    }

    // Extract company if not already found
    if (!company) {
      const companyMatch = originalMessage.match(/(?:company|corp|inc|llc)[:\s-]*([A-Za-z0-9\s]+)/i);
      if (companyMatch) {
        company = companyMatch[1].trim();
      }
    }

    return {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      company: company || undefined,
      leadStatus: leadStatus || undefined
    };
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling CRUD intent', {
      action: intent.action,
      userId: context.userId
    });

    // Handle all CRUD operations comprehensively
    switch (intent.action) {
      case 'create_contact':
        // Check if we have contact details in the intent entities
        if (intent.entities?.firstName || intent.entities?.email || intent.entities?.contactName) {
          // We have contact details, try to create the contact
          try {
            logger.info('Attempting to create contact with provided details', {
              entities: intent.entities,
              userId: context.userId
            });

            // Parse contact details from entities
            const contactData = this.parseContactData(intent.entities, intent.originalMessage);
            
            if (!contactData.firstName || !contactData.lastName || !contactData.email) {
              return {
                type: 'text',
                content: `I need more information to create the contact. Please provide:

**Required:**
• First Name
• Last Name  
• Email

You provided: ${JSON.stringify(contactData, null, 2)}

Please provide the missing required fields.`,
                conversationContext: {
                  phase: 'data_collection',
                  action: 'create_contact',
                  referringTo: 'new_request'
                }
              };
            }

            // Get team ID
            const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
            const teamId = teams.length > 0 ? teams[0]._id : 'default';

            // Create the contact
            const contactId = await this.convex.mutation(api.crm.createContact, {
              teamId,
              createdBy: context.userId,
              firstName: contactData.firstName,
              lastName: contactData.lastName,
              email: contactData.email,
              phone: contactData.phone,
              company: contactData.company,
              leadStatus: (contactData.leadStatus as 'new' | 'contacted' | 'qualified' | 'unqualified') || 'new',
              contactType: 'contact',
              source: 'chat_creation'
            });

            logger.info('Contact created successfully', {
              contactId,
              contactData,
              userId: context.userId
            });

            return {
              type: 'text',
              content: `✅ Contact created successfully!

**Contact Details:**
• Name: ${contactData.firstName} ${contactData.lastName}
• Email: ${contactData.email}
${contactData.phone ? `• Phone: ${contactData.phone}` : ''}
${contactData.company ? `• Company: ${contactData.company}` : ''}
• Lead Status: ${contactData.leadStatus || 'new'}

The contact has been added to your database.`,
              conversationContext: {
                phase: 'exploration',
                action: 'create_contact',
                referringTo: 'new_request'
              }
            };

          } catch (error) {
            logger.error('Failed to create contact', error instanceof Error ? error : undefined, {
              entities: intent.entities,
              userId: context.userId
            });

            return {
              type: 'text',
              content: `❌ Sorry, I encountered an error while creating the contact. Please try again or provide the information in a different format.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              conversationContext: {
                phase: 'data_collection',
                action: 'create_contact',
                referringTo: 'new_request'
              }
            };
          }
        } else {
          // No contact details provided, show data collection prompt
          return {
            type: 'text',
            content: `I'd be happy to help you create a new contact! 

To create a contact, I'll need some information from you. Please provide:

**Required:**
• First Name
• Last Name  
• Email

**Optional:**
• Phone Number
• Company
• Lead Status

You can provide this information in any format, for example:
"Create a contact for John Smith, john.smith@example.com, phone 555-0123, company TechCorp"

What details would you like to include for the new contact?`,
            suggestions: [
              "Create contact: John Smith, john@example.com",
              "Add contact: Sarah Wilson, sarah@company.com, phone 555-0123",
              "New contact: Mike Johnson, mike@tech.com, company TechStart"
            ],
            conversationContext: {
              phase: 'data_collection',
              action: 'create_contact',
              referringTo: 'new_request'
            }
          };
        }

      case 'create_account':
        return {
          type: 'text',
          content: `I'd be happy to help you create a new account! 

To create an account, I'll need some information from you. Please provide:

**Required:**
• Company Name

**Optional:**
• Industry
• Website
• Phone Number
• Annual Revenue
• Employee Count

You can provide this information in any format, for example:
"Create account for TechCorp, industry technology, website techcorp.com, revenue 5M"

What details would you like to include for the new account?`,
          suggestions: [
            "Create account: TechCorp, technology industry",
            "Add account: Global Solutions, website globalsolutions.com",
            "New account: Startup Inc, revenue 2M, 50 employees"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'create_account',
            referringTo: 'new_request'
          }
        };

      case 'create_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you create a new deal! 

To create a deal, I'll need some information from you. Please provide:

**Required:**
• Deal Name
• Stage (prospecting, qualification, proposal, negotiation, closed_won, closed_lost)

**Optional:**
• Amount
• Contact/Account (if related)
• Close Date
• Probability
• Description

You can provide this information in any format, for example:
"Create deal for Software License, stage proposal, amount 50000, close date next month"

What details would you like to include for the new deal?`,
          suggestions: [
            "Create deal: Software License, proposal stage, 50K",
            "Add deal: Consulting Project, qualification, 25K",
            "New deal: Enterprise Contract, negotiation, 100K"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'create_deal',
            referringTo: 'new_request'
          }
        };

      case 'update_contact':
        // Check if we have update details in the intent entities
        if (intent.entities?.contactName && intent.entities?.field && intent.entities?.value) {
          // We have update details, try to update the contact
          try {
            logger.info('Attempting to update contact with provided details', {
              entities: intent.entities,
              userId: context.userId
            });

            const contactName = intent.entities.contactName;
            const field = intent.entities.field;
            const value = intent.entities.value;

            // Get team ID
            const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
            const teamId = teams.length > 0 ? teams[0]._id : 'default';

            // Find the contact by name
            const contacts = await this.convex.query(api.crm.getContactsByTeam, { teamId });
            const targetContact = contacts.find(contact => {
              const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
              return fullName.includes(contactName.toLowerCase());
            });

            if (!targetContact) {
              return {
                type: 'text',
                content: `❌ I couldn't find a contact named "${contactName}". 

Available contacts:
${contacts.slice(0, 5).map(contact => {
  const name = contact.firstName && contact.lastName ? 
    `${contact.firstName} ${contact.lastName}` : 
    contact.firstName || contact.lastName || 'Unknown';
  return `• ${name}`;
}).join('\n')}

Please check the spelling or try a different contact name.`,
                conversationContext: {
                  phase: 'data_collection',
                  action: 'update_contact',
                  referringTo: 'new_request'
                }
              };
            }

            // Validate field name
            const validFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'title', 'leadStatus'];
            if (!validFields.includes(field)) {
              return {
                type: 'text',
                content: `❌ Invalid field "${field}". 

Valid fields to update:
• firstName, lastName, email, phone, company, title, leadStatus

Please specify a valid field to update.`,
                conversationContext: {
                  phase: 'data_collection',
                  action: 'update_contact',
                  referringTo: 'new_request'
                }
              };
            }

            // Update the contact
            await this.convex.mutation(api.crm.updateContact, {
              contactId: targetContact._id,
              updates: { [field]: value }
            });

            logger.info('Contact updated successfully', {
              contactId: targetContact._id,
              field,
              value,
              userId: context.userId
            });

            const updatedName = targetContact.firstName && targetContact.lastName ? 
              `${targetContact.firstName} ${targetContact.lastName}` : 
              targetContact.firstName || targetContact.lastName || 'Unknown';

            return {
              type: 'text',
              content: `✅ Contact updated successfully!

**Updated Contact:**
• Name: ${updatedName}
• Field: ${field}
• New Value: ${value}

The changes have been saved to your database.`,
              conversationContext: {
                phase: 'exploration',
                action: 'update_contact',
                referringTo: 'new_request'
              }
            };

          } catch (error) {
            logger.error('Failed to update contact', error instanceof Error ? error : undefined, {
              entities: intent.entities,
              userId: context.userId
            });

            return {
              type: 'text',
              content: `❌ Sorry, I encountered an error while updating the contact. Please try again.

Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              conversationContext: {
                phase: 'data_collection',
                action: 'update_contact',
                referringTo: 'new_request'
              }
            };
          }
        } else {
          // No update details provided, show data collection prompt
          return {
            type: 'text',
            content: `I'd be happy to help you update a contact! 

Please provide:
• Contact name (who to update)
• What field to update (email, phone, company, lead status, etc.)
• New value

For example:
"Update John Smith's email to john.new@company.com"
"Change Sarah Wilson's phone to 555-9999"
"Set Mike Johnson's lead status to qualified"

Which contact would you like to update and what changes should I make?`,
            suggestions: [
              "Update John Smith's email to john.new@company.com",
              "Change Sarah Wilson's phone to 555-9999",
              "Set Mike Johnson's lead status to qualified"
            ],
            conversationContext: {
              phase: 'data_collection',
              action: 'update_contact',
              referringTo: 'new_request'
            }
          };
        }

      case 'update_account':
        return {
          type: 'text',
          content: `I'd be happy to help you update an account! 

Please provide:
• Account name (which account to update)
• What field to update (industry, website, revenue, etc.)
• New value

For example:
"Update TechCorp's industry to software"
"Change Global Solutions revenue to 10M"
"Set Startup Inc website to startupinc.com"

Which account would you like to update and what changes should I make?`,
          suggestions: [
            "Update TechCorp's industry to software",
            "Change Global Solutions revenue to 10M",
            "Set Startup Inc website to startupinc.com"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'update_account',
            referringTo: 'new_request'
          }
        };

      case 'update_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you update a deal! 

Please provide:
• Deal name (which deal to update)
• What field to update (stage, amount, close date, etc.)
• New value

For example:
"Update Software License deal stage to closed_won"
"Change Consulting Project amount to 30K"
"Set Enterprise Contract close date to December 15"

Which deal would you like to update and what changes should I make?`,
          suggestions: [
            "Update Software License deal stage to closed_won",
            "Change Consulting Project amount to 30K",
            "Set Enterprise Contract close date to December 15"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'update_deal',
            referringTo: 'new_request'
          }
        };

      case 'delete_contact':
        return {
          type: 'text',
          content: `I'd be happy to help you delete a contact! 

Please provide the name of the contact you want to delete.

For example:
"Delete John Smith"
"Remove Sarah Wilson from contacts"
"Delete contact Mike Johnson"

⚠️ **Warning**: This action cannot be undone. The contact and all associated data will be permanently removed.

Which contact would you like to delete?`,
          suggestions: [
            "Delete John Smith",
            "Remove Sarah Wilson from contacts",
            "Delete contact Mike Johnson"
          ],
          conversationContext: {
            phase: 'confirmation',
            action: 'delete_contact',
            referringTo: 'new_request'
          }
        };

      case 'delete_account':
        return {
          type: 'text',
          content: `I'd be happy to help you delete an account! 

Please provide the name of the account you want to delete.

For example:
"Delete TechCorp"
"Remove Global Solutions account"
"Delete account Startup Inc"

⚠️ **Warning**: This action cannot be undone. The account and all associated data will be permanently removed.

Which account would you like to delete?`,
          suggestions: [
            "Delete TechCorp",
            "Remove Global Solutions account",
            "Delete account Startup Inc"
          ],
          conversationContext: {
            phase: 'confirmation',
            action: 'delete_account',
            referringTo: 'new_request'
          }
        };

      case 'delete_deal':
        return {
          type: 'text',
          content: `I'd be happy to help you delete a deal! 

Please provide the name of the deal you want to delete.

For example:
"Delete Software License deal"
"Remove Consulting Project"
"Delete deal Enterprise Contract"

⚠️ **Warning**: This action cannot be undone. The deal and all associated data will be permanently removed.

Which deal would you like to delete?`,
          suggestions: [
            "Delete Software License deal",
            "Remove Consulting Project",
            "Delete deal Enterprise Contract"
          ],
          conversationContext: {
            phase: 'confirmation',
            action: 'delete_deal',
            referringTo: 'new_request'
          }
        };

      default:
        // For any other CRUD operations, use conversational handler
        return await conversationalHandler.handleConversation(
          intent.context.userGoal || 'CRUD operation',
          context.conversationManager,
          context
        );
    }

    // For other CRUD operations, use conversational handler
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'CRUD operation',
      context.conversationManager,
      context
    );
  }
}

// Email Intent Handler
class EmailIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'send_email';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling email intent', {
      action: intent.action,
      userId: context.userId
    });

    try {
      const recipient = intent.entities?.recipient;
      const contentType = intent.entities?.content_type;

      if (!recipient) {
        return {
          type: 'text',
          content: `I'd be happy to help you send an email! 

Please provide the recipient's name or email address.

For example:
"Send an email to john@example.com"
"Email Sarah Johnson about the meeting"
"Send a thank you email to Mike Chen"

Who would you like to send an email to?`,
          suggestions: [
            "Send email to john@example.com",
            "Email Sarah Johnson",
            "Send thank you to Mike Chen"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'send_email',
            referringTo: 'new_request'
          }
        };
      }

      // Get team ID and find the contact
      const teams = await this.convex.query(api.crm.getTeamsByUser, { userId: context.userId });
      const teamId = teams.length > 0 ? teams[0]._id : 'default';
      const contacts = await this.convex.query(api.crm.getContactsByTeam, { teamId });

      // Find matching contact
      const matchingContact = contacts.find(contact => {
        const contactName = contact.firstName && contact.lastName 
          ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
          : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
        const searchName = recipient.toLowerCase();
        
        return contactName.includes(searchName) || 
               searchName.includes(contactName) ||
               contactName.split(' ').some((part: string) => searchName.includes(part)) ||
               searchName.split(' ').some((part: string) => contactName.includes(part));
      });

      if (matchingContact) {
        // Contact exists, draft email
        const emailContent = this.generateEmailContent(matchingContact, contentType);
        
        return {
          type: 'email_draft',
          content: `I've drafted an email for you to ${matchingContact.firstName} ${matchingContact.lastName}.`,
          emailDraft: {
            to: matchingContact.email,
            subject: emailContent.subject,
            content: emailContent.content
          },
          conversationContext: {
            phase: 'confirmation',
            action: 'send_email',
            referringTo: 'new_request'
          }
        };
      } else {
        // Contact doesn't exist
        return {
          type: 'text',
          content: `I couldn't find a contact named "${recipient}" in your database. 

Would you like me to help you create a new contact for this person? Please provide their email address so I can add them to your contacts and then send the email.

For example:
"Create contact: ${recipient}, ${recipient.toLowerCase().replace(' ', '.')}@example.com"`,
          suggestions: [
            `Create contact: ${recipient}, ${recipient.toLowerCase().replace(' ', '.')}@example.com`,
            "Show me my contacts",
            "Send email to existing contact"
          ],
          conversationContext: {
            phase: 'data_collection',
            action: 'create_contact',
            referringTo: 'new_request'
          }
        };
      }

    } catch (error) {
      logger.error('Error handling email intent', error instanceof Error ? error : undefined, {
        intent,
        userId: context.userId
      });

      return {
        type: 'text',
        content: `I encountered an issue while processing your email request. Please try again or provide more specific details about who you'd like to email.`,
        conversationContext: {
          phase: 'error',
          action: 'send_email',
          referringTo: 'new_request'
        }
      };
    }
  }

  private generateEmailContent(contact: any, contentType?: string): { subject: string; content: string } {
    const firstName = contact.firstName || 'there';
    const lastName = contact.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (contentType?.toLowerCase().includes('thank')) {
      return {
        subject: 'Thank You',
        content: `Dear ${fullName},

Thank you for taking the time to meet with me yesterday. I really appreciate the opportunity to discuss our collaboration.

I look forward to working together and will follow up with next steps soon.

Best regards,
[Your Name]`
      };
    } else if (contentType?.toLowerCase().includes('follow')) {
      return {
        subject: 'Follow Up',
        content: `Dear ${fullName},

I hope this email finds you well. I wanted to follow up on our recent conversation and see if you have any questions or need additional information.

Please don't hesitate to reach out if there's anything I can help with.

Best regards,
[Your Name]`
      };
    } else {
      return {
        subject: 'Hello',
        content: `Dear ${fullName},

I hope this message finds you well.

[Your message here]

Best regards,
[Your Name]`
      };
    }
  }

  private convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// Analysis Intent Handler
class AnalysisIntentHandler implements IntentHandler {
  canHandle(intent: SimplifiedIntent): boolean {
    return intent.action === 'analyze_data';
  }

  async handle(intent: SimplifiedIntent, context: IntentRouterContext): Promise<any> {
    logger.info('Handling analysis intent', {
      action: intent.action,
      userId: context.userId
    });

    // Use conversational handler for analysis operations
    return await conversationalHandler.handleConversation(
      intent.context.userGoal || 'Analysis operation',
      context.conversationManager,
      context
    );
  }
}

// Create and configure the router
export const intentRouter = new IntentRouter();

// Register all handlers
intentRouter.registerHandler(new ChartIntentHandler());
intentRouter.registerHandler(new DataIntentHandler());
intentRouter.registerHandler(new CrudIntentHandler());
intentRouter.registerHandler(new EmailIntentHandler());
intentRouter.registerHandler(new AnalysisIntentHandler()); 