'use client';
import { useEffect, useRef, useState } from 'react';
import {
  getAudioConstraints,
  getMediaRecorderOptions,
  setupAudioProcessing,
  stopMediaStream,
} from '@/lib/audio-config';

type Props = { onComplete: (blob: Blob, url: string) => void };

export default function Recorder({ onComplete }: Props) {
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [err, setErr] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
      stopMediaStream(streamRef.current);
    },
    []
  );

  async function start() {
    setErr(null);
    chunksRef.current = [];
    try {
      const constraints = getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply advanced audio processing for better echo cancellation
      const processedStream = await setupAudioProcessing(stream);
      streamRef.current = processedStream;

      const recorderOptions = getMediaRecorderOptions();
      const rec = new MediaRecorder(processedStream, recorderOptions);
      mediaRef.current = rec;
      rec.ondataavailable = e => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorderOptions.mimeType });
        const url = URL.createObjectURL(blob);
        onComplete(blob, url);
        stopMediaStream(stream);
        stopMediaStream(processedStream);
      };
      rec.start(1000);
      setStatus('recording');
    } catch (e: any) {
      setErr(e?.message || 'Microphone error');
      setStatus('idle');
    }
  }

  function pause() {
    const r = mediaRef.current;
    if (r && r.state === 'recording') {
      r.pause();
      setStatus('paused');
    }
  }
  function resume() {
    const r = mediaRef.current;
    if (r && r.state === 'paused') {
      r.resume();
      setStatus('recording');
    }
  }
  function stop() {
    const r = mediaRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
      setStatus('stopped');
    }
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="mb-2 text-sm text-white/80">Recorder</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={start}
          disabled={status === 'recording'}
          className="rounded-lg bg-orange-500 px-3 py-2 font-semibold text-[#0a3d62] disabled:opacity-50"
        >
          Start
        </button>
        {status === 'recording' && (
          <button
            onClick={pause}
            className="rounded-lg border border-white/25 px-3 py-2 text-white/90"
          >
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            onClick={resume}
            className="rounded-lg border border-white/25 px-3 py-2 text-white/90"
          >
            Resume
          </button>
        )}
        <button
          onClick={stop}
          disabled={status === 'idle'}
          className="rounded-lg border border-white/25 px-3 py-2 text-white/90 disabled:opacity-50"
        >
          Stop
        </button>
      </div>
      <div className="mt-2 text-xs text-white/60">
        Status: <span className="font-mono">{status}</span>
      </div>
      {err && <div className="mt-2 text-xs text-red-300">{err}</div>}
    </div>
  );
}
