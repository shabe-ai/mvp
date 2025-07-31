import { auth } from "@clerk/nextjs/server";
import Chat from "@/components/Chat";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col bg-white w-full h-full flex-1 min-h-0">
      <main className="flex-1 min-h-0 w-full bg-white flex flex-col p-0 m-0">
        {userId ? (
          <Chat />
        ) : (
          <div className="text-center py-12 w-full max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Welcome to Shabe AI
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Upload files and chat with AI to analyze your data, generate charts, and get insights.
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 