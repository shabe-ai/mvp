import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Chat from "@/components/Chat";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Shabe CRM
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {userId ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <div className="flex items-center space-x-2">
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      Sign Up
                    </button>
                  </SignUpButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {userId ? (
          <Chat />
        ) : (
          <div className="text-center py-12">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Welcome to Shabe CRM
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                Your AI-powered conversational CRM. Manage contacts, accounts, deals, and activities through natural language.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <SignInButton mode="modal">
                  <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Get Started
                  </button>
                </SignInButton>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 