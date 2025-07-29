"use client";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import TeamManagement from "@/components/TeamManagement";

interface GoogleFolder {
  id: string;
  name: string;
}

interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
}

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(false);
  
  // Google Drive processing states
  const [showDriveSection, setShowDriveSection] = useState(false);
  const [folders, setFolders] = useState<GoogleFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [folderFiles, setFolderFiles] = useState<GoogleFile[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/test-token")
      .then(res => res.json())
      .then(data => {
        setIsConnected(!!data.hasToken);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // Test calendar access
    fetch("/api/calendar")
      .then(res => res.json())
      .then(data => {
        if (data.summary && data.summary.toLowerCase().includes("insufficient authentication scopes")) {
          setCalendarError(true);
        } else {
          setCalendarError(false);
        }
      })
      .catch(() => setCalendarError(true));
    
    // Load current team
    loadCurrentTeam();
  }, [user]);

  const loadCurrentTeam = async () => {
    try {
      const response = await fetch('/api/teams/current');
      const data = await response.json();
      if (data.team) {
        setCurrentTeam(data.team);
      }
    } catch (error) {
      console.error('Failed to load current team:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/google");
    const data = await res.json();
    setLoading(false);
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  };

  const loadFolders = async () => {
    if (!isConnected) return;
    
    try {
      const response = await fetch('/api/drive?action=folders');
      const data = await response.json();
      if (data.folders) {
        setFolders(data.folders);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadFolderContents = async (folderId: string) => {
    try {
      const response = await fetch(`/api/drive?action=contents&folderId=${folderId}`);
      const data = await response.json();
      if (data.files) {
        setFolderFiles(data.files);
        setTotalFiles(data.files.length);
      }
    } catch (error) {
      console.error('Failed to load folder contents:', error);
    }
  };

  const processFiles = async () => {
    if (!selectedFolder || !currentTeam) return;
    
    setProcessingFiles(true);
    setProcessedCount(0);
    
    try {
      // Get files in the selected folder
      const response = await fetch(`/api/drive?action=contents&folderId=${selectedFolder}`);
      const data = await response.json();
      
      if (!data.files) {
        throw new Error('No files found');
      }
      
      const processableFiles = data.files.filter((file: GoogleFile) => {
        const isSupportedType = file.mimeType.includes('document') ||
          file.mimeType.includes('pdf') ||
          file.mimeType.includes('text') ||
          file.mimeType.includes('spreadsheet') ||
          file.mimeType.includes('csv') ||
          file.mimeType.includes('excel') ||
          file.mimeType.includes('xlsx') ||
          file.mimeType.includes('xls');
        
        if (file.mimeType.includes('html') && file.size && parseInt(file.size) > 500000) {
          return false;
        }
        
        return isSupportedType;
      });
      
      setTotalFiles(processableFiles.length);
      
      // Process each file
      for (let i = 0; i < processableFiles.length; i++) {
        const file = processableFiles[i];
        
        try {
          const storeResponse = await fetch('/api/drive/store', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileId: file.id,
              teamId: currentTeam.id
            }),
          });
          
          if (storeResponse.ok) {
            setProcessedCount(i + 1);
          }
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
        }
      }
      
      alert(`Successfully processed ${processedCount} documents for your team!`);
    } catch (error) {
      console.error('Failed to process files:', error);
      alert('Failed to process files. Please try again.');
    } finally {
      setProcessingFiles(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center mr-4">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
            <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Google Workspace Integration</h2>
          <p className="text-slate-600">Connect your Google account to enable Gmail, Google Drive, and Calendar features.</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Connection Status</h3>
            <p className="text-slate-600">
              {isConnected === null ? "Checking..." : 
               isConnected ? "✅ Connected" : "❌ Not connected"}
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Connecting..." : "Connect Google Account"}
          </button>
        </div>

        {calendarError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-800">
                Calendar access requires additional permissions. Please reconnect your Google account.
              </p>
            </div>
          </div>
        )}

        {/* Google Drive Processing Section */}
        {isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-blue-900 mb-1">📁 Google Drive Processing</h4>
                <p className="text-blue-700 text-sm">
                  Process your Google Drive files once to enable AI context in chat.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDriveSection(!showDriveSection);
                  if (!showDriveSection) {
                    loadFolders();
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {showDriveSection ? "Hide" : "Show Drive Processing"}
              </button>
            </div>

            {showDriveSection && (
              <div className="space-y-4">
                {/* Folder Selection */}
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Select Google Drive Folder
                  </label>
                  <select
                    value={selectedFolder}
                    onChange={(e) => {
                      setSelectedFolder(e.target.value);
                      if (e.target.value) {
                        loadFolderContents(e.target.value);
                      }
                    }}
                    className="w-full p-3 border border-blue-300 rounded-lg bg-white text-blue-900"
                  >
                    <option value="">Choose a folder...</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File List */}
                {selectedFolder && folderFiles.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-blue-900 mb-2">
                      Files in folder ({folderFiles.length} total)
                    </h5>
                    <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-blue-200 p-3">
                      {folderFiles.slice(0, 10).map((file) => (
                        <div key={file.id} className="text-sm text-blue-800 py-1">
                          📄 {file.name}
                        </div>
                      ))}
                      {folderFiles.length > 10 && (
                        <div className="text-sm text-blue-600 py-1">
                          ... and {folderFiles.length - 10} more files
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Processing Button */}
                {selectedFolder && (
                  <button
                    onClick={processFiles}
                    disabled={processingFiles || !currentTeam}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingFiles ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing... ({processedCount}/{totalFiles})
                      </div>
                    ) : (
                      "Process Files for AI Context"
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-lg font-semibold text-blue-900 mb-2">💡 Integration Tip</h4>
              <p className="text-blue-700">
                Once connected and files are processed, you can use Google Drive integration in the main chat interface. 
                Go to the Home page to start chatting with AI context from your documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
          Admin Dashboard
        </h1>
        <p className="text-slate-600 text-lg">Manage your Shabe workspace settings and integrations.</p>
      </div>
      
      <SignedIn>
        <div className="space-y-8">
          {/* Google Integration Section */}
          <GoogleIntegrationSection />

          {/* Team Management Section */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-slate-500 to-slate-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Team Management</h2>
                <p className="text-slate-600">View and manage your teams, members, and statistics.</p>
              </div>
            </div>
            
            <TeamManagement />
          </section>

          {/* Future Admin Features */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">More Admin Features</h2>
                <p className="text-slate-600">Additional administrative tools and settings.</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-slate-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-slate-500">More admin features coming soon</span>
              </div>
            </div>
          </section>
        </div>
      </SignedIn>
      
      <SignedOut>
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Admin Access Required</h2>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            Please sign in to access admin features and manage your Shabe workspace settings.
          </p>
          <div className="flex justify-center space-x-4">
            <SignInButton mode="modal">
              <button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </div>
  );
} 