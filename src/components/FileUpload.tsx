import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: string;
  type: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  content?: string;
  error?: string;
}

interface FileUploadProps {
  onFilesProcessed: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

export default function FileUpload({ onFilesProcessed, maxFiles = 3 }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          
          if (file.type === 'text/plain' || file.type === 'text/csv') {
            resolve(content);
          } else if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // For Excel files, we'll extract what we can from the content
            // In a real implementation, you'd use a library like xlsx
            resolve(`Excel file: ${file.name} - Content extraction available`);
          } else if (file.type === 'application/pdf') {
            // For PDF files, we'll note that extraction is available
            resolve(`PDF file: ${file.name} - Content extraction available`);
          } else {
            resolve(`File: ${file.name} - Content type: ${file.type}`);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const processFile = async (file: File): Promise<UploadedFile> => {
    const id = Math.random().toString(36).substr(2, 9);
    const uploadedFile: UploadedFile = {
      id,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      status: 'uploading'
    };

    setUploadedFiles(prev => [...prev, uploadedFile]);

    try {
      // Update status to processing
      setUploadedFiles(prev => 
        prev.map(f => f.id === id ? { ...f, status: 'processing' } : f)
      );

      // Extract text content
      const content = await extractTextFromFile(file);
      
      // Update with success
      const processedFile: UploadedFile = {
        ...uploadedFile,
        status: 'success',
        content
      };

      setUploadedFiles(prev => 
        prev.map(f => f.id === id ? processedFile : f)
      );

      return processedFile;
    } catch (error) {
      // Update with error
      const errorFile: UploadedFile = {
        ...uploadedFile,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to process file'
      };

      setUploadedFiles(prev => 
        prev.map(f => f.id === id ? errorFile : f)
      );

      throw error;
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    // Check if adding these files would exceed the limit
    if (uploadedFiles.length + validFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    try {
      const processedFiles = await Promise.all(validFiles.map(processFile));
      onFilesProcessed(processedFiles.filter(f => f.status === 'success'));
    } catch (error) {
      console.error('Error processing files:', error);
    }
  }, [uploadedFiles.length, maxFiles, onFilesProcessed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  }, [handleFileUpload]);

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'success':
        return 'Ready';
      case 'error':
        return 'Error';
    }
  };

  return (
    <div className="mb-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-amber-400 bg-amber-50'
            : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 font-medium mb-2">
          Drop files here or click to upload
        </p>
        <p className="text-slate-500 text-sm mb-4">
          Upload up to {maxFiles} files (max 10MB each)
        </p>
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          accept=".txt,.csv,.pdf,.xlsx,.xls,.doc,.docx"
        />
        <label
          htmlFor="file-upload"
          className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 cursor-pointer transition-colors"
        >
          Choose Files
        </label>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            Uploaded Files ({uploadedFiles.length}/{maxFiles})
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(file.status)}
                    <span className="text-xs text-slate-600">
                      {getStatusText(file.status)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 