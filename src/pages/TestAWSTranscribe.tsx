import React, { useState } from 'react';
import { awsTranscribeStreamingFixed } from '../services/_deprecated/awsTranscribeMedicalStreamingFixed.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export default function TestAWSTranscribe() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
      logDebug("TestAWSTranscribe", "Adding log entry", { message });
  };

  const startRecording = async () => {
    try {
      setError('');
      setTranscript('');
      setInterimTranscript('');
      setLogs([]);

      addLog('Starting AWS Transcribe Medical...');
      setIsRecording(true);

      await awsTranscribeStreamingFixed.startTranscription(
        'DICTATION',
        result => {
          addLog(
            `Received ${result.isPartial ? 'partial' : 'final'} transcript: ${result.transcript}`
          );

          if (result.isPartial) {
            setInterimTranscript(result.transcript);
          } else {
            setTranscript(prev => prev + ' ' + result.transcript);
            setInterimTranscript('');
          }
        },
        error => {
          addLog(`Error: ${error.message}`);
          setError(error.message);
          setIsRecording(false);
        }
      );

      addLog('AWS Transcribe Medical started successfully');
    } catch (err: any) {
      addLog(`Failed to start: ${err.message}`);
      setError(err.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    addLog('Stopping AWS Transcribe Medical...');
    awsTranscribeStreamingFixed.stop();
    setIsRecording(false);
    setInterimTranscript('');
    addLog('Stopped');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AWS Transcribe Medical Test</h1>

      <div className="mb-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-6 py-3 rounded-lg font-semibold text-white ${
            isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isRecording ? '🛑 Stop Recording' : '🎤 Start Recording'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Final Transcript:</h2>
          <div className="p-4 bg-gray-100 rounded min-h-[100px]">
            {transcript || <span className="text-gray-500">No transcript yet...</span>}
          </div>
        </div>

        {interimTranscript && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Interim:</h2>
            <div className="p-4 bg-yellow-50 rounded">
              <span className="text-gray-600 italic">{interimTranscript}</span>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-2">Logs:</h2>
          <div className="p-4 bg-black text-green-400 rounded font-mono text-sm max-h-64 overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log, i) => <div key={i}>{log}</div>)
            ) : (
              <span className="text-gray-500">No logs yet...</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Test Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Start Recording" to begin</li>
          <li>
            Speak medical terms clearly: "Patient presents with hypertension and diabetes mellitus
            type 2"
          </li>
          <li>Watch for real-time transcription in the interim section</li>
          <li>Final transcripts appear in the main transcript area</li>
          <li>Check logs for detailed debugging information</li>
        </ol>
      </div>
    </div>
  );
}
