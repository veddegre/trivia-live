/** Copy channel samples end-to-start. The input array is left unchanged. */
export function reverseChannelData(
  input: ArrayLike<number>
): Float32Array<ArrayBuffer> {
  const out = new Float32Array(input.length);
  const last = input.length - 1;
  for (let i = 0; i <= last; i++) {
    out[i] = input[last - i];
  }
  return out;
}

/** A new buffer with every channel reversed. Browsers cannot play HTML audio backwards. */
export function reverseAudioBuffer(
  ctx: AudioContext,
  source: AudioBuffer
): AudioBuffer {
  const reversed = ctx.createBuffer(
    source.numberOfChannels,
    source.length,
    source.sampleRate
  );
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    reversed.copyToChannel(
      reverseChannelData(source.getChannelData(channel)),
      channel
    );
  }
  return reversed;
}
