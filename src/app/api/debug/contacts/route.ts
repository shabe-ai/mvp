import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Import Convex for database operations
    const { convex } = await import('@/lib/convex');
    const { api } = await import('@/convex/_generated/api');

    console.log('🔍 Debug: Getting teams for user:', userId);
    
    // Get teams for the user
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    console.log('🔍 Debug: Teams found:', teams.length);
    
    if (teams.length === 0) {
      return NextResponse.json({
        error: 'No teams found for user',
        userId,
        teams: []
      });
    }

    const teamId = teams[0]._id;
    console.log('🔍 Debug: Using team ID:', teamId);
    
    // Get all contacts for the team
    const contacts = await convex.query(api.crm.getContactsByTeam, { teamId });
    console.log('🔍 Debug: Contacts found:', contacts.length);
    
    // Format contacts for display
    const formattedContacts = contacts.map(contact => ({
      id: contact._id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      email: contact.email,
      company: contact.company,
      title: contact.title,
      phone: contact.phone,
      leadStatus: contact.leadStatus,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    }));

    return NextResponse.json({
      success: true,
      userId,
      teamId,
      totalContacts: contacts.length,
      contacts: formattedContacts,
      rawContacts: contacts // Include raw data for debugging
    });

  } catch (error) {
    console.error('❌ Debug contacts API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 