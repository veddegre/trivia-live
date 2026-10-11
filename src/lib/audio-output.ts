/**
 * Safari only allows sound to start in the turn of a tap. Call this, and
 * `audio.play()` or `unlockAudioContext`, before any await.
 */
export function holdPlaybackSession() {
  const session = (
    navigator as Navigator & { audioSession?: { type: string } }
  ).audioSession;
  if (session) session.type = "playback";
}

/** Resume a Web Audio context from a tap, with a one-sample buffer so iOS unlocks. */
export function unlockAudioContext(ctx: AudioContext): Promise<void> {
  const pending = ctx.resume();
  try {
    const silent = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
    const node = ctx.createBufferSource();
    node.buffer = silent;
    node.connect(ctx.destination);
    node.start();
  } catch {
    /* The context cannot start a node until resume settles. */
  }
  return pending.then(() => undefined);
}
