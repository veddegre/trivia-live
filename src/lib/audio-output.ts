/** Tell iOS to keep playing even when the mute switch is on. Call inside a tap. */
export function holdPlaybackSession() {
  const session = (
    navigator as Navigator & { audioSession?: { type: string } }
  ).audioSession;
  if (session) session.type = "playback";
}
