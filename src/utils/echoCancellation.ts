import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
/**
 * Echo Cancellation and Audio Enhancement Utilities
 * Prevents feedback loops and improves audio quality
 */

export class EchoCancellationService {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseSuppression: boolean = true;
  private echoCancellation: boolean = true;
  private autoGainControl: boolean = true;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    if (
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as any).webkitAudioContext)
    ) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Set up echo cancellation for microphone input
   */
  async setupEchoCancellation(stream: MediaStream): Promise<MediaStream> {
    if (!this.audioContext) {
      logWarn('App', 'Warning message', {});
      return stream;
    }

    try {
      // Create audio nodes
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.compressor = this.audioContext.createDynamicsCompressor();

      // Configure analyser for voice activity detection
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Configure compressor to reduce feedback
      this.compressor.threshold.value = -30;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Configure gain control
      this.gainNode.gain.value = 0.8; // Reduce gain to prevent feedback

      // Create processor for custom echo cancellation
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      // Echo cancellation algorithm
      let previousSamples: Float32Array = new Float32Array(bufferSize);
      let echoBuffer: Float32Array[] = [];
      const maxEchoBufferSize = 10;

      this.processor.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);

        // Simple echo cancellation using adaptive filtering
        for (let i = 0; i < input.length; i++) {
          let sample = input[i];

          // Apply noise gate
          if (Math.abs(sample) < 0.01) {
            sample = 0;
          }

          // Subtract echo estimate
          if (echoBuffer.length > 0) {
            const echoEstimate = this.estimateEcho(echoBuffer, i);
            sample = sample - echoEstimate * 0.3; // Adaptive factor
          }

          // Limit output to prevent clipping
          output[i] = Math.max(-1, Math.min(1, sample));
        }

        // Update echo buffer
        echoBuffer.push(new Float32Array(input));
        if (echoBuffer.length > maxEchoBufferSize) {
          echoBuffer.shift();
        }

        previousSamples = new Float32Array(input);
      };

      // Connect audio nodes
      this.source.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Create enhanced stream
      const destination = this.audioContext.createMediaStreamDestination();
      this.processor.connect(destination);

      return destination.stream;
    } catch (error) {
      logError('App', 'Error message', {});
      return stream;
    }
  }

  /**
   * Estimate echo from buffer history
   */
  private estimateEcho(buffer: Float32Array[], sampleIndex: number): number {
    let echo = 0;
    const weights = [0.5, 0.3, 0.15, 0.05]; // Decay weights

    for (let i = 0; i < Math.min(buffer.length, weights.length); i++) {
      const bufferIndex = buffer.length - 1 - i;
      if (bufferIndex >= 0 && sampleIndex < buffer[bufferIndex].length) {
        echo += buffer[bufferIndex][sampleIndex] * weights[i];
      }
    }

    return echo;
  }

  /**
   * Get optimized audio constraints for voice
   */
  getAudioConstraints(): MediaTrackConstraints {
    return {
      echoCancellation: this.echoCancellation,
      noiseSuppression: this.noiseSuppression,
      autoGainControl: this.autoGainControl,
      sampleRate: 48000,
      sampleSize: 16,
      channelCount: 1,
      // Additional constraints for better quality
      latency: 0.01,
      volume: 0.8,
    } as MediaTrackConstraints;
  }

  /**
   * Detect voice activity
   */
  detectVoiceActivity(): boolean {
    if (!this.analyser) return false;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume in voice frequency range (300-3400 Hz)
    const voiceFreqStart = Math.floor((300 * bufferLength) / (this.audioContext!.sampleRate / 2));
    const voiceFreqEnd = Math.floor((3400 * bufferLength) / (this.audioContext!.sampleRate / 2));

    let sum = 0;
    for (let i = voiceFreqStart; i < voiceFreqEnd; i++) {
      sum += dataArray[i];
    }

    const average = sum / (voiceFreqEnd - voiceFreqStart);
    return average > 30; // Threshold for voice activity
  }

  /**
   * Adjust gain dynamically based on input level
   */
  adjustGain(targetLevel: number = 0.7) {
    if (!this.analyser || !this.gainNode) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Adjust gain smoothly
    const currentGain = this.gainNode.gain.value;
    const targetGain = targetLevel / (rms + 0.001); // Avoid division by zero
    const newGain = currentGain * 0.9 + Math.min(2, Math.max(0.1, targetGain)) * 0.1;

    this.gainNode.gain.setValueAtTime(newGain, this.audioContext!.currentTime);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.compressor) {
      this.compressor.disconnect();
      this.compressor = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  /**
   * Toggle settings
   */
  setNoiseSuppression(enabled: boolean) {
    this.noiseSuppression = enabled;
  }

  setEchoCancellation(enabled: boolean) {
    this.echoCancellation = enabled;
  }

  setAutoGainControl(enabled: boolean) {
    this.autoGainControl = enabled;
  }
}

// Singleton instance
export const echoCancellation = new EchoCancellationService();
