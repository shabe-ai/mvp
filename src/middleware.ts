import { clerkMiddleware } from '@clerk/nextjs/server'
import type { NextRequest, NextResponse } from 'next/server'

export default clerkMiddleware()

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
} 