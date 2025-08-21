import { auth } from "@clerk/nextjs/server";
import ChatWithSidebar from "@/components/ChatWithSidebar";
import ConvexProviderWrapper from "@/components/ConvexProvider";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex flex-col bg-white w-full h-screen min-h-0">
        <main className="flex-1 min-h-0 w-full bg-white flex flex-col p-0 m-0 overflow-hidden">
          <div className="text-center py-12 w-full max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-black mb-4">
              Welcome to Shabe AI
            </h2>
            <p className="text-lg text-[#d9d2c7] mb-8">
              Upload files and chat with AI to analyze your data, generate charts, and get insights.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Check if user has completed onboarding
  try {
    const userProfile = await convex.query(api.profiles.getUserProfile, { userId });
    const teams = await convex.query(api.crm.getTeamsByUser, { userId });
    
    // If user doesn't have a profile or teams, redirect to onboarding
    if (!userProfile || !teams || teams.length === 0) {
      redirect('/onboarding');
    }
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    // If there's an error, redirect to onboarding to be safe
    redirect('/onboarding');
  }

  return (
    <div className="flex flex-col bg-white w-full h-screen min-h-0">
      <main className="flex-1 min-h-0 w-full bg-white flex flex-col p-0 m-0 overflow-hidden">
        <ConvexProviderWrapper>
          <ChatWithSidebar />
        </ConvexProviderWrapper>
      </main>
    </div>
  );
} 