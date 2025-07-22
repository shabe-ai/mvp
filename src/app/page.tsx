import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Chat from "@/components/Chat";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center">
      <main className="flex-1 w-full flex items-center justify-center">
        {userId ? (
          <div className="w-full max-w-4xl h-[80vh] flex items-center justify-center">
            <Chat hideTeamSelector />
          </div>
        ) : (
          <div className="text-center py-12 w-full max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Welcome to Shabe CRM
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Your AI-powered conversational CRM. Manage contacts, accounts, deals, and activities through natural language.
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 