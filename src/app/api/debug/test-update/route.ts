import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { convex } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactName, field, value } = body;

    console.log('🧪 Test update request:', { contactName, field, value });

    // Get all contacts for the user
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('🧪 Found teams:', teams.length);
    
    if (teams.length === 0) {
      return NextResponse.json({ error: 'No teams found' }, { status: 404 });
    }
    
    const teamId = teams[0]._id;
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId: teamId.toString() });
    console.log('🧪 Found contacts:', contacts.length);

    // Find the contact by name
    const matchingContact = contacts.find(contact => {
      const contactFullName = contact.firstName && contact.lastName 
        ? `${contact.firstName} ${contact.lastName}`.toLowerCase()
        : contact.firstName?.toLowerCase() || contact.lastName?.toLowerCase() || '';
      const searchName = contactName.toLowerCase();
      
      return contactFullName.includes(searchName) || searchName.includes(contactFullName);
    });

    if (!matchingContact) {
      return NextResponse.json({ 
        error: 'Contact not found', 
        searchedFor: contactName,
        availableContacts: contacts.map(c => `${c.firstName} ${c.lastName}`.trim())
      }, { status: 404 });
    }

    console.log('🧪 Found contact:', matchingContact);

    // Test the update
    console.log('🧪 Attempting update with:', {
      contactId: matchingContact._id,
      updates: { [field]: value }
    });

    const result = await convex.mutation(api.crm.updateContact, {
      contactId: matchingContact._id,
      updates: { [field]: value }
    });

    console.log('🧪 Update result:', result);

    // Verify the update
    const updatedContact = await convex.query(api.crm.getContactById, { 
      contactId: matchingContact._id 
    });

    console.log('🧪 Updated contact:', updatedContact);

    return NextResponse.json({
      success: true,
      originalContact: matchingContact,
      updatedContact,
      updateDetails: {
        contactId: matchingContact._id,
        field,
        value,
        result
      }
    });

  } catch (error) {
    console.error('🧪 Test update error:', error);
    return NextResponse.json({ 
      error: 'Test update failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 