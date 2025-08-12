import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactName, field, value } = body;

    console.log('🧪 Test update called with:', { contactName, field, value, userId });

    // Import Convex for database operations
    const { convex } = await import('@/lib/convex');
    const { api } = await import('@/convex/_generated/api');

    // Get teams for the user
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('🧪 Teams found:', teams.length);
    
    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found' });
    }

    const teamId = teams[0]._id;
    console.log('🧪 Using team ID:', teamId);
    
    // Get all contacts for the team
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    console.log('🧪 Contacts found:', contacts.length);
    
    // Find the contact
    const matchingContact = contacts.find(contact => {
      const contactFullName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = contactName.toLowerCase();
      
      const matches = contactFullName.includes(searchName) || 
             searchName.includes(contactFullName) ||
             contactFullName.split(' ').some((part: string) => searchName.includes(part)) ||
             searchName.split(' ').some((part: string) => contactFullName.includes(part));
      
      console.log(`🧪 Checking "${contactFullName}" against "${searchName}": ${matches}`);
      return matches;
    });

    if (!matchingContact) {
      console.log('🧪 No matching contact found');
      return NextResponse.json({ 
        error: 'Contact not found',
        searchedFor: contactName,
        availableContacts: contacts.map(c => `${c.firstName} ${c.lastName}`)
      });
    }

    console.log('🧪 Found matching contact:', matchingContact);
    console.log('🧪 Current contact data:', {
      id: matchingContact._id,
      firstName: matchingContact.firstName,
      lastName: matchingContact.lastName,
      company: matchingContact.company,
      title: matchingContact.title,
      email: matchingContact.email
    });

    // Perform the update
    console.log('🧪 Performing update with:', {
      contactId: matchingContact._id,
      updates: { [field]: value }
    });

    try {
      const result = await convex.mutation(api.crm.updateContact, {
        contactId: matchingContact._id as any,
        updates: { [field]: value }
      });

      console.log('🧪 Update result:', result);

      // Verify the update
      const updatedContact = await convex.query(api.crm.getContactById, { 
        contactId: matchingContact._id as any 
      });

      console.log('🧪 Updated contact data:', updatedContact);

      return NextResponse.json({
        success: true,
        message: `Updated ${contactName}'s ${field} to ${value}`,
        contactId: matchingContact._id,
        before: {
          [field]: matchingContact[field as keyof typeof matchingContact]
        },
        after: {
          [field]: updatedContact?.[field as keyof typeof updatedContact]
        },
        fullContact: updatedContact
      });

    } catch (updateError) {
      console.error('🧪 Update failed:', updateError);
      return NextResponse.json({ 
        error: 'Update failed',
        details: updateError instanceof Error ? updateError.message : String(updateError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error('🧪 Test update API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 