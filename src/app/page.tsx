import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Chat from "@/components/Chat";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen h-screen flex flex-col bg-white overflow-hidden">
      <main className="flex-1 w-full h-full bg-white overflow-hidden p-0 m-0">
        {userId ? (
          <Chat hideTeamSelector />
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