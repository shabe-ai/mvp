"use client";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

function GoogleIntegrationSection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(false);

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
  }, [user]);

  const handleConnect = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/google");
    const data = await res.json();
    setLoading(false);
    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
      <h2 className="text-xl font-semibold mb-2">Google Integration</h2>
      <p className="text-gray-600 mb-2">Connect your Google account to enable Gmail and Calendar features.</p>
      {loading ? (
        <div className="text-gray-400">Checking connection...</div>
      ) : isConnected ? (
        <>
          <div className="text-green-600 font-medium">✅ Google account connected!</div>
          {calendarError && (
            <button
              onClick={handleConnect}
              className="mt-3 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              Reconnect Google to enable Calendar features
            </button>
          )}
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Connect Google Account
        </button>
      )}
    </section>
  );
}

function GoogleDriveSection() {
  const { user } = useUser();
  const [folders, setFolders] = useState<Array<{id: string; name: string}>>([]);
  const [files, setFiles] = useState<Array<{id: string; name: string; mimeType: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [embeddingsResult, setEmbeddingsResult] = useState<{
    success: boolean;
    fileId: string;
    fileName?: string;
    fileType?: string;
    textLength: number;
    chunkCount: number;
    embeddingCount: number;
    semanticSearch?: {
      query: string;
      results: Array<{
        chunkText: string;
        similarity: number;
        chunkIndex: number;
      }>;
    };
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storageResult, setStorageResult] = useState<{
    success: boolean;
    documentId: string;
    chunkIds: string[];
    fileName: string;
    fileType: string;
    textLength: number;
    chunkCount: number;
    embeddingCount: number;
  } | null>(null);

  const testDriveConnection = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive?action=folders", {
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error('Drive connection error:', err);
      setError("Failed to connect to Google Drive");
    } finally {
      setLoading(false);
    }
  };

  const getFolderContents = async (folderId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/drive?action=contents&folderId=${folderId}`, {
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFiles(data.contents || []);
      }
    } catch (err) {
      console.error('Folder contents error:', err);
      setError("Failed to get folder contents");
    } finally {
      setLoading(false);
    }
  };

  const extractDocumentText = async (fileId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive/extract", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fileId }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setExtractedText(data.extractedText);
      }
    } catch (err) {
      console.error('Document extraction error:', err);
      setError("Failed to extract document text");
    } finally {
      setLoading(false);
    }
  };

  const processEmbeddings = async (fileId: string, query?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive/embeddings", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ fileId, query }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setEmbeddingsResult(data);
      }
    } catch (err) {
      console.error('Embeddings processing error:', err);
      setError("Failed to process embeddings");
    } finally {
      setLoading(false);
    }
  };

  const storeDocument = async (fileId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive/store", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          fileId, 
          teamId: 'default-team' // We'll get this from user context later
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setStorageResult(data);
      }
    } catch (err) {
      console.error('Document storage error:', err);
      setError("Failed to store document");
    } finally {
      setLoading(false);
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

  return (
    <div>
      {loading ? (
        <div className="text-gray-400">Testing Google Drive connection...</div>
      ) : error ? (
        <div className="text-red-600 mb-3">{error}</div>
      ) : folders.length > 0 ? (
        <div className="text-green-600 font-medium mb-3">
          ✅ Google Drive connected! Found {folders.length} folders.
        </div>
      ) : null}
      
      <div className="space-y-2">
        <button
          onClick={testDriveConnection}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Testing..." : "Test Google Drive Connection"}
        </button>
        
        {error && (error.includes("insufficient authentication scopes") || error.includes("403")) && (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
          >
            Reconnect Google to enable Drive features
          </button>
        )}
        
        {/* Manual reconnection button for testing */}
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          Reconnect Google Account
        </button>
      </div>
      
      {folders.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Available Folders:</h3>
          <div className="space-y-2">
            {folders.slice(0, 5).map((folder) => (
              <div key={folder.id} className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  📁 {folder.name}
                </div>
                <button
                  onClick={() => getFolderContents(folder.id)}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Browse
                </button>
              </div>
            ))}
            {folders.length > 5 && (
              <div className="text-sm text-gray-500">
                ... and {folders.length - 5} more folders
              </div>
            )}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Files in Folder:</h3>
          <div className="space-y-2">
            {files.slice(0, 10).map((file) => (
              <div key={file.id} className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  📄 {file.name} ({file.mimeType})
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => extractDocumentText(file.id)}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Extract
                  </button>
                  <button
                    onClick={() => processEmbeddings(file.id)}
                    className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                  >
                    Embed
                  </button>
                  <button
                    onClick={() => storeDocument(file.id)}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Store
                  </button>
                </div>
              </div>
            ))}
            {files.length > 10 && (
              <div className="text-sm text-gray-500">
                ... and {files.length - 10} more files
              </div>
            )}
          </div>
        </div>
      )}

      {extractedText && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Extracted Text:</h3>
          <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 max-h-40 overflow-y-auto">
            {extractedText.substring(0, 500)}
            {extractedText.length > 500 && '...'}
          </div>
        </div>
      )}

      {embeddingsResult && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Embeddings Results:</h3>
          <div className="bg-gray-50 p-3 rounded text-sm text-gray-800">
            <div className="mb-2">
              <strong>File:</strong> {embeddingsResult.fileName}
            </div>
            <div className="mb-2">
              <strong>Text Length:</strong> {embeddingsResult.textLength} characters
            </div>
            <div className="mb-2">
              <strong>Chunks:</strong> {embeddingsResult.chunkCount}
            </div>
            <div className="mb-2">
              <strong>Embeddings:</strong> {embeddingsResult.embeddingCount}
            </div>
            
            {embeddingsResult.semanticSearch && (
              <div className="mt-3">
                <strong>Semantic Search Results:</strong>
                <div className="mt-2 space-y-2">
                  {embeddingsResult.semanticSearch.results.map((result: {
                    chunkText: string;
                    similarity: number;
                    chunkIndex: number;
                  }, index: number) => (
                    <div key={index} className="border-l-2 border-purple-500 pl-2">
                      <div className="text-xs text-gray-600">
                        Chunk {result.chunkIndex} (similarity: {result.similarity.toFixed(3)})
                      </div>
                      <div className="text-sm">{result.chunkText}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Semantic Search Input */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Semantic Search:</h3>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter search query..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={() => {
              if (files.length > 0 && searchQuery) {
                processEmbeddings(files[0].id, searchQuery);
              }
            }}
            disabled={!searchQuery || files.length === 0}
            className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {storageResult && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Storage Results:</h3>
          <div className="bg-gray-50 p-3 rounded text-sm text-gray-800">
            <div className="mb-2">
              <strong>Document ID:</strong> {storageResult.documentId}
            </div>
            <div className="mb-2">
              <strong>File:</strong> {storageResult.fileName}
            </div>
            <div className="mb-2">
              <strong>Type:</strong> {storageResult.fileType}
            </div>
            <div className="mb-2">
              <strong>Text Length:</strong> {storageResult.textLength} characters
            </div>
            <div className="mb-2">
              <strong>Chunks:</strong> {storageResult.chunkCount}
            </div>
            <div className="mb-2">
              <strong>Embeddings:</strong> {storageResult.embeddingCount}
            </div>
            <div className="mb-2">
              <strong>Chunk IDs:</strong> {storageResult.chunkIds.length} stored
            </div>
            <div className="text-green-600 font-medium">
              ✅ Document successfully stored in Convex!
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <SignedIn>
        <div className="space-y-8">
          {/* Google Integration Section */}
          <GoogleIntegrationSection />

          {/* Team Details Section */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100 mb-6">
            <h2 className="text-xl font-semibold mb-2">Team Details</h2>
            <p className="text-gray-600 mb-2">View and manage your team information.</p>
            {/* TODO: Add team details UI here */}
            <div className="text-sm text-gray-400">(Team details UI coming soon)</div>
          </section>

          {/* Google Drive Integration Section */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100">
            <h2 className="text-xl font-semibold mb-2">Google Drive Integration</h2>
            <p className="text-gray-600 mb-2">Connect your Google Drive to enable AI-powered document analysis.</p>
            <GoogleDriveSection />
          </section>

          {/* Future Admin Features */}
          <section className="bg-white rounded-lg shadow p-6 border border-slate-100">
            <h2 className="text-xl font-semibold mb-2">More Admin Features</h2>
            <div className="text-sm text-gray-400">(More admin features coming soon)</div>
          </section>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Admin Access</h2>
          <p className="mb-6 text-gray-600">Please sign in to access admin features.</p>
          <SignInButton mode="modal">
            <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
} 