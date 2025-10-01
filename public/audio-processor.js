/**
 * AudioWorkletProcessor for handling audio streaming
 * Replaces deprecated ScriptProcessorNode
 */

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input && input[0]) {
      const inputData = input[0];

      // Accumulate samples
      for (let i = 0; i < inputData.length; i++) {
        this.buffer[this.bufferIndex++] = inputData[i];

        // When buffer is full, send it to main thread
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({
            type: 'audio-chunk',
            audioData: this.buffer.slice(0, this.bufferIndex),
          });
          this.bufferIndex = 0;
        }
      }
    }

    // Keep processor alive
    return true;
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
