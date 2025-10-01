import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
/**
 * Audio Configuration for Echo Cancellation
 * Fixes echo issues in voice recording and playback
 */

/**
 * Get optimized audio constraints for recording
 * Includes echo cancellation, noise suppression, and auto gain control
 */
export function getAudioConstraints() {
  return {
    audio: {
      // Echo cancellation - CRITICAL for preventing echo
      echoCancellation: true,

      // Noise suppression - reduces background noise
      noiseSuppression: true,

      // Auto gain control - normalizes volume
      autoGainControl: true,

      // Sample rate for better quality
      sampleRate: 48000,

      // Channel count
      channelCount: 1,

      // Sample size
      sampleSize: 16,

      // Additional constraints for better quality
      googEchoCancellation: true,
      googAutoGainControl: true,
      googNoiseSuppression: true,
      googHighpassFilter: true,
      googTypingNoiseDetection: true,
    },
  };
}

/**
 * Get media recorder options for best compatibility
 */
export function getMediaRecorderOptions() {
  // Check for supported mime types
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];

  let selectedMimeType = 'audio/webm';

  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }
  }

  return {
    mimeType: selectedMimeType,
    audioBitsPerSecond: 128000,
  };
}

/**
 * Setup audio context for echo cancellation
 * Creates an audio processing pipeline
 */
export async function setupAudioProcessing(stream: MediaStream): Promise<MediaStream> {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream);

    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.9; // Slightly reduce gain to prevent feedback

    // Create dynamics compressor to prevent clipping
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    // Connect the audio graph
    source.connect(gainNode);
    gainNode.connect(compressor);

    // Create destination stream
    const destination = audioContext.createMediaStreamDestination();
    compressor.connect(destination);

    return destination.stream;
  } catch (error) {
    logWarn('App', 'Warning message', {});
    return stream;
  }
}

/**
 * Stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
}

/**
 * Configure Web Speech API for better recognition
 */
export function configureSpeechRecognition(recognition: any) {
  if (!recognition) return;

  // Set recognition parameters
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = 'en-US';

  // Additional settings if available
  if ('audiostart' in recognition) {
    // Some browsers support additional audio processing hints
    (recognition as any).audiostart = true;
  }
}

/**
 * Audio playback configuration to prevent echo
 */
export function configureAudioPlayback(audioElement: HTMLAudioElement) {
  // Set volume slightly lower to prevent feedback
  audioElement.volume = 0.8;

  // Disable audio processing that might cause echo
  if ('setSinkId' in audioElement) {
    // Use default audio output
    (audioElement as any).setSinkId('default').catch(() => {});
  }

  // Set crossorigin if needed
  audioElement.crossOrigin = 'anonymous';

  // Preload audio
  audioElement.preload = 'auto';
}

/**
 * Check if echo cancellation is supported
 */
export async function checkEchoCancellationSupport(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true },
    });

    const tracks = stream.getAudioTracks();
    const settings = tracks[0]?.getSettings();

    // Clean up
    stream.getTracks().forEach(track => track.stop());

    return settings?.echoCancellation === true;
  } catch {
    return false;
  }
}

/**
 * Get optimal audio settings based on browser capabilities
 */
export async function getOptimalAudioSettings() {
  const hasEchoCancellation = await checkEchoCancellationSupport();

  if (!hasEchoCancellation) {
    logWarn('App', 'Warning message', {});
  }

  return {
    audio: {
      echoCancellation: hasEchoCancellation ? { ideal: true } : false,
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 1 },
      sampleSize: { ideal: 16 },
    },
  };
}
