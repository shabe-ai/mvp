"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface Folder {
  id: string;
  name: string;
  mimeType: string;
}

interface File {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

interface ProcessingStatus {
  [fileId: string]: 'pending' | 'processing' | 'completed' | 'failed';
}

export default function GoogleDriveIntegration({ 
  onDocumentsProcessed 
}: { 
  onDocumentsProcessed?: (count: number) => void 
}) {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test-token");
      const data = await res.json();
      setIsConnected(!!data.hasToken);
    } catch (err) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting Google account:', error);
      setError("Failed to connect Google account");
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/drive?action=folders");
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      setLoading(false);
    }
  };

  const loadFolderContents = async (folderId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/drive?action=contents&folderId=${folderId}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setFiles(data.contents || []);
        setSelectedFolder(folderId);
      }
    } catch (error) {
      console.error('Error loading folder contents:', error);
      setError("Failed to load folder contents");
    } finally {
      setLoading(false);
    }
  };

  const processFolderDocuments = async (folderId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      // Get current team ID
      const teamRes = await fetch("/api/teams/current");
      const teamData = await teamRes.json();
      
      if (!teamData.success) {
        setError("Failed to get team information");
        return;
      }

      const teamId = teamData.team.id;

      // First get all files in the folder
      const res = await fetch(`/api/drive?action=contents&folderId=${folderId}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      const folderFiles = data.contents || [];
      const processableFiles = folderFiles.filter((file: File) => {
        // Check if file type is supported
        const isSupportedType = file.mimeType.includes('document') || 
          file.mimeType.includes('pdf') ||
          file.mimeType.includes('text') ||
          file.mimeType.includes('spreadsheet') ||
          file.mimeType.includes('csv') ||
          file.mimeType.includes('excel') ||
          file.mimeType.includes('xlsx') ||
          file.mimeType.includes('xls');
        
        // Skip HTML files that are too large (they cause processing issues)
        if (file.mimeType.includes('html') && file.size && parseInt(file.size) > 500000) {
          return false;
        }
        
        return isSupportedType;
      });

      if (processableFiles.length === 0) {
        setError("No processable documents found in this folder");
        return;
      }

      // Initialize processing status
      const initialStatus: ProcessingStatus = {};
      processableFiles.forEach((file: File) => {
        initialStatus[file.id] = 'pending';
      });
      setProcessingStatus(initialStatus);

      // Process each file
      let processedCount = 0;
      for (const file of processableFiles) {
        try {
          setProcessingStatus(prev => ({ ...prev, [file.id]: 'processing' }));
          
          const processRes = await fetch("/api/drive/store", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fileId: file.id, 
              teamId: teamId
            }),
          });
          
          const processData = await processRes.json();
          
          if (processData.success) {
            setProcessingStatus(prev => ({ ...prev, [file.id]: 'completed' }));
            processedCount++;
          } else {
            setProcessingStatus(prev => ({ ...prev, [file.id]: 'failed' }));
          }
        } catch (error) {
          console.error('Error processing file:', file.name, error);
          setProcessingStatus(prev => ({ ...prev, [file.id]: 'failed' }));
        }
      }

      if (processedCount > 0) {
        onDocumentsProcessed?.(processedCount);
      }

    } catch (error) {
      console.error('Error processing documents:', error);
      setError("Failed to process documents");
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected && !loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-900">Connect Google Drive</h3>
            <p className="text-sm text-blue-700 mt-1">
              Connect your Google Drive to enable document context in chat
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect Google Drive"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Google Drive Documents</h3>
          <p className="text-sm text-gray-600 mt-1">
            Select a folder to process documents for chat context
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {folders.length === 0 ? (
            <button
              onClick={loadFolders}
              disabled={loading}
              className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Folders"}
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Folder:
              </label>
              <select
                value={selectedFolder}
                onChange={(e) => {
                  setSelectedFolder(e.target.value);
                  if (e.target.value) {
                    loadFolderContents(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Choose a folder...</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedFolder && files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Files in folder ({files.length})
                </span>
                <button
                  onClick={() => processFolderDocuments(selectedFolder)}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Process All Documents"}
                </button>
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {files.slice(0, 5).map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate">
                      📄 {file.name}
                    </span>
                    {processingStatus[file.id] && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        processingStatus[file.id] === 'completed' ? 'bg-green-100 text-green-800' :
                        processingStatus[file.id] === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        processingStatus[file.id] === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {processingStatus[file.id]}
                      </span>
                    )}
                  </div>
                ))}
                {files.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ... and {files.length - 5} more files
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 