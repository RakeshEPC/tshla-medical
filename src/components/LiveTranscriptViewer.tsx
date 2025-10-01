import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Search, Download, Eye, EyeOff } from 'lucide-react';
import type { LiveTranscriptEntry } from '../types/callSummary';

interface LiveTranscriptViewerProps {
  transcripts: LiveTranscriptEntry[];
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  callSid?: string;
  className?: string;
}

export const LiveTranscriptViewer: React.FC<LiveTranscriptViewerProps> = ({
  transcripts,
  isActive,
  isExpanded,
  onToggleExpanded,
  callSid,
  className = '',
}) => {
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'Patient':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'AI Assistant':
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getSpeakerIcon = (speaker: string) => {
    switch (speaker) {
      case 'Patient':
        return <User className="w-4 h-4" />;
      case 'AI Assistant':
        return <Bot className="w-4 h-4" />;
      default:
        return <Mic className="w-4 h-4" />;
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className={`p-4 border-b border-gray-200 ${isActive ? 'bg-green-50' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isActive ? (
              <>
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                <Mic className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Live Transcript</h3>
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-700">Call Transcript</h3>
              </>
            )}
            {callSid && (
              <span className="text-xs text-gray-500 font-mono">{callSid.slice(-8)}</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">{transcripts.length} entries</span>
            <button
              onClick={onToggleExpanded}
              className="p-1 text-gray-600 hover:text-gray-800 rounded"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              className="p-1 text-gray-600 hover:text-gray-800 rounded"
              title="Download Transcript"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Content */}
      {isExpanded && (
        <div className="p-4">
          <div
            ref={transcriptContainerRef}
            className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-3 bg-gray-50"
          >
            {transcripts.length > 0 ? (
              transcripts.map((entry, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 ${getSpeakerColor(entry.speaker)} ${
                    entry.speaker === 'Patient' ? 'ml-0 mr-8' : 'ml-8 mr-0'
                  }`}
                >
                  {/* Speaker Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getSpeakerIcon(entry.speaker)}
                      <span className="text-sm font-semibold">{entry.speaker}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      {entry.confidence && (
                        <span className={`${getConfidenceColor(entry.confidence)}`}>
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      )}
                      <span className="text-gray-500">{formatTime(entry.timestamp)}</span>
                      {entry.isPartial && (
                        <span className="text-blue-500" title="Partial transcript">
                          •
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transcript Text */}
                  <p
                    className={`text-sm ${entry.isPartial ? 'italic text-gray-600' : 'text-gray-900'}`}
                  >
                    {entry.text}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  {isActive ? 'Listening for conversation...' : 'No transcript available'}
                </p>
                {isActive && (
                  <p className="text-xs text-gray-400 mt-1">
                    Transcripts will appear here as the conversation progresses
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {!isExpanded && transcripts.length > 0 && (
        <div className="p-4">
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span>Latest:</span>
              <span className="font-medium">{transcripts[transcripts.length - 1]?.speaker}</span>
            </div>
            <p className="mt-1 text-gray-900 truncate">
              {transcripts[transcripts.length - 1]?.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptViewer;
