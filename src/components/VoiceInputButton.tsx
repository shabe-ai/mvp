"use client";

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Button } from '@/components/shabe-ui';

interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function VoiceInputButton({ 
  onTranscript, 
  disabled = false, 
  className = "" 
}: VoiceInputButtonProps) {
  const {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    getFinalTranscript,
  } = useVoiceInput();

  const handleClick = () => {
    if (isListening) {
      stopListening();
      const finalTranscript = getFinalTranscript();
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript);
      }
    } else {
      startListening();
    }
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        variant={isListening ? "primary" : "subtle"}
        size="sm"
        className={`${className} ${
          isListening 
            ? "bg-accent-500 text-black animate-pulse" 
            : "text-ink-700 hover:bg-accent-50"
        }`}
        title={isListening ? "Stop recording" : "Start voice input"}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-danger-500 text-white text-sm rounded-ctl shadow-pop whitespace-nowrap z-50">
          {error}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-danger-500"></div>
        </div>
      )}

      {/* Transcript preview */}
      {transcript && !isListening && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-ink-900 text-white text-sm rounded-ctl shadow-pop whitespace-nowrap z-50 max-w-xs">
          "{transcript}"
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-ink-900"></div>
        </div>
      )}
    </div>
  );
}