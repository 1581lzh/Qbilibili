const MUSIC_MAX_SIZE_MB = 50;
const MUSIC_COMPRESSION_TARGET_MB = 45; // 90% of limit

export interface MusicCompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export async function compressMusic(
  file: File,
  targetSizeMB: number = MUSIC_COMPRESSION_TARGET_MB
): Promise<MusicCompressionResult> {
  const originalSize = file.size;
  const originalSizeMB = originalSize / (1024 * 1024);
  const targetSizeBytes = targetSizeMB * 1024 * 1024;

  if (originalSizeMB <= MUSIC_MAX_SIZE_MB) {
    return { file, compressed: false, originalSize, compressedSize: originalSize };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const compressedBlob = await encodeAudioBuffer(audioContext, audioBuffer, file.type);
    await audioContext.close();

    if (compressedBlob.size >= originalSize) {
      return { file, compressed: false, originalSize, compressedSize: originalSize };
    }

    const compressedFile = new File([compressedBlob], file.name, { type: file.type });
    return { file: compressedFile, compressed: true, originalSize, compressedSize: compressedBlob.size };
  } catch {
    return { file, compressed: false, originalSize, compressedSize: originalSize };
  }
}

async function encodeAudioBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  mimeType: string
): Promise<Blob> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();

  const bitRate = 128;
  return audioBufferToWav(renderedBuffer, bitRate);
}

function audioBufferToWav(buffer: AudioBuffer, bitRate: number): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    interleaved = new Float32Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      interleaved[i * 2] = left[i];
      interleaved[i * 2 + 1] = right[i];
    }
  } else {
    interleaved = buffer.getChannelData(0);
  }

  const dataLength = interleaved.length * (bitDepth / 8);
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function needsMusicCompression(file: File): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB > MUSIC_MAX_SIZE_MB;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
