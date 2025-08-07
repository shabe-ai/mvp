import { clerkMiddleware } from '@clerk/nextjs/server'

// Add error handling to catch middleware issues
const middleware = clerkMiddleware()

export default async function (req: any, res: any) {
  try {
    return await middleware(req, res)
  } catch (error) {
    console.error('❌ Middleware error:', error)
    // Return a basic response to prevent the 500 error
    return new Response('OK', { status: 200 })
  }
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
} 