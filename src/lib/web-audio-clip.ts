import { holdPlaybackSession } from "@/lib/audio-output";

/**
 * Safari's decodeAudioData promise is unreliable. Callbacks and the promise
 * can both settle; only the first result counts.
 */
export function decodeAudioBuffer(
  ctx: AudioContext,
  bytes: ArrayBuffer
): Promise<AudioBuffer> {
  const copy = bytes.slice(0);
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const bad = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Could not decode audio"));
    };
    try {
      const pending = ctx.decodeAudioData(copy, ok, bad) as
        | Promise<AudioBuffer>
        | undefined;
      if (pending && typeof pending.then === "function") pending.then(ok, bad);
    } catch {
      bad();
    }
  });
}

export type ArmedContext = {
  /** Resolves when the context has left the suspended state. */
  resumed: Promise<void>;
  /** Stop the silence that is holding the audio session open. */
  release: () => void;
};

/** Call synchronously from a tap. Later taps resume again; the silent loop stays. */
export function pokeAudioContext(
  ctx: AudioContext,
  existing: ArmedContext | null
): ArmedContext {
  if (existing) {
    holdPlaybackSession();
    void ctx.resume();
    return { ...existing, resumed: ctx.resume().then(() => undefined) };
  }
  return armAudioContext(ctx);
}

/**
 * Call synchronously inside a tap, before any await.
 * A looping silent buffer keeps iPad Safari from suspending the context
 * while the round clock request is in flight.
 */
export function armAudioContext(ctx: AudioContext): ArmedContext {
  holdPlaybackSession();
  const resumed = ctx.resume().then(() => undefined);
  const rate = ctx.sampleRate || 44100;
  const silent = ctx.createBuffer(1, Math.max(1, Math.floor(rate)), rate);
  const node = ctx.createBufferSource();
  node.buffer = silent;
  node.loop = true;
  node.connect(ctx.destination);
  let alive = false;
  try {
    node.start(0);
    alive = true;
  } catch {
    /* Already running, or the context cannot start a node yet. */
  }
  return {
    resumed,
    release() {
      if (!alive) return;
      alive = false;
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    },
  };
}

export type LiveClip = {
  setRate: (rate: number) => void;
  /** Seconds into the buffer, sped up by the current rate. */
  position: () => number;
  stop: () => void;
};

/**
 * Start a decoded clip. `start(0)` is required: Safari drops a start time of
 * `currentTime` once the context resumes. Do not set loopEnd — WebKit treats
 * loopEnd === duration as an empty loop and stops after the first pass.
 */
export function startClip(
  ctx: AudioContext,
  buffer: AudioBuffer,
  opts: {
    offset?: number;
    rate?: number;
    loop?: boolean;
    onEnded?: () => void;
  }
): LiveClip {
  const duration = buffer.duration;
  const initial = Math.max(0.25, opts.rate ?? 1);
  let rate = initial;
  let markedAt = ctx.currentTime;
  let markedPos =
    duration > 0
      ? ((opts.offset ?? 0) % duration + duration) % duration
      : 0;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = opts.loop === true;
  source.playbackRate.value = rate;
  source.connect(ctx.destination);
  source.onended = () => {
    if (source.loop) return;
    opts.onEnded?.();
  };
  source.start(0, markedPos);

  return {
    setRate(next: number) {
      const now = ctx.currentTime;
      markedPos += (now - markedAt) * rate;
      markedAt = now;
      rate = Math.max(0.25, next);
      source.playbackRate.value = rate;
    },
    position() {
      const pos = markedPos + (ctx.currentTime - markedAt) * rate;
      if (duration <= 0) return 0;
      return source.loop ? ((pos % duration) + duration) % duration : pos;
    },
    stop() {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
    },
  };
}
