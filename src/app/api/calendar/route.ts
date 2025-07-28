import { NextResponse } from 'next/server';
import { getTodaysEventsForUser } from '@/lib/gmail';

export async function GET() {
  try {
    const { events, summary } = await getTodaysEventsForUser();
    return NextResponse.json({ events, summary });
  } catch (error) {
    console.error('Error in calendar API:', error);
    return NextResponse.json({ events: [], summary: 'Could not fetch calendar events.' }, { status: 500 });
  }
} 