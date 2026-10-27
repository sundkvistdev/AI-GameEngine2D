/**
 * Vortex2D Game Engine - Lightweight WebAudio Synthesizer & Audio Loader
 * Zero emojis. Clean, deterministic audio previewing and synth.
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSynthBeep(_freq: number = 440, _duration: number = 0.08, _type: OscillatorType = 'sine'): void {
  // UI interaction sound effects disabled per specification.
}

export async function decodeAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.error('Audio decode error:', err);
    return null;
  }
}

export function playAudioBuffer(buffer: AudioBuffer, volume: number = 1.0): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch (err) {
    console.error('Failed to play audio buffer:', err);
  }
}
