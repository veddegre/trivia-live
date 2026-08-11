"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { useBrandOrFallback } from "@/components/BrandProvider";

export default function HomePage() {
  const brand = useBrandOrFallback();

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-x-hidden"
      style={{ background: "#0b0e14", color: "#ffffff" }}
    >
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 md:px-10">
        <BrandMark href="/" size="md" />
        <nav className="flex items-center gap-6 md:gap-8">
          <a
            href="#how-to-play"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] hover:opacity-80"
            style={{ color: "#ffffff" }}
          >
            How to play
          </a>
          <a
            href="#features"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] hover:opacity-80"
            style={{ color: "#ffffff" }}
          >
            Features
          </a>
        </nav>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-5.5rem)] flex-col items-center justify-center px-6 pb-36 pt-6 text-center">
        <h1 className="sr-only">{brand.displayName || "Trivia Live"}</h1>
        <div className="anim-rise flex justify-center">
          <BrandMark href={null} size="hero" />
        </div>

        <p className="mt-10 text-lg font-medium leading-relaxed md:text-xl" style={{ color: "#ffffff" }}>
          {brand.tagline?.trim() ? (
            brand.tagline
          ) : (
            <>
              Live multiplayer trivia.
              <br />
              Real people. Real time.{" "}
              <span style={{ color: "#f8b43c" }}>Real fun.</span>
            </>
          )}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/join"
            className="inline-flex items-center justify-center rounded-md px-7 py-3 text-sm font-bold uppercase tracking-[0.12em] transition hover:opacity-90"
            style={{ background: "#ffffff", color: "#0b0e14" }}
          >
            Join a game
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border px-7 py-3 text-sm font-bold uppercase tracking-[0.12em] transition hover:bg-white/5"
            style={{ borderColor: "#ffffff", color: "#ffffff", background: "transparent" }}
          >
            Admin
          </Link>
        </div>
      </section>

      {/* Stage + spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[58vh] z-0 h-[42vh] min-h-[220px]"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 70% at 50% 100%, rgba(248,180,60,0.45) 0%, rgba(248,180,60,0.12) 35%, transparent 70%)",
          }}
        />
        <svg
          className="absolute bottom-0 left-1/2 h-full w-[140%] max-w-none -translate-x-1/2 opacity-70"
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax meet"
          fill="none"
        >
          <ellipse cx="600" cy="380" rx="520" ry="28" stroke="rgba(248,180,60,0.35)" strokeWidth="2" />
          <ellipse cx="600" cy="340" rx="420" ry="40" stroke="rgba(248,180,60,0.22)" strokeWidth="1.5" />
          <ellipse cx="600" cy="290" rx="300" ry="50" stroke="rgba(248,180,60,0.14)" strokeWidth="1.5" />
        </svg>
      </div>

      <section id="how-to-play" className="relative z-10 mx-auto w-full max-w-4xl px-6 py-20 md:px-10">
        <h2 className="text-center text-2xl font-bold md:text-3xl">How to play</h2>
        <ol className="mt-10 space-y-8">
          {[
            ["Create a game", "Build questions in Admin — timers, scoring, True/False or multiple choice."],
            ["Open the lobby", "Put the host screen on the TV. Players scan the QR or type the join code."],
            ["Play live", "Everyone answers on their phones. Fastest correct answers earn more points."],
            ["Crown a winner", "Reveal, standings between rounds, then the podium finish."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-5">
              <span
                className="display shrink-0 text-3xl font-extrabold"
                style={{ color: "#f8b43c" }}
              >
                {i + 1}.
              </span>
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "#9aa6c1" }}>
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 md:px-10">
        <h2 className="text-center text-2xl font-bold md:text-3xl">Built for game night</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            ["Host on any screen", "Lobby QR, live roster, and TV-ready question boards."],
            ["Phones as buzzers", "Players join in seconds — no app install."],
            ["Pace the room", "Reveal, between-round standings pause, then the next question."],
          ].map(([title, body]) => (
            <div key={title} className="text-center">
              <div className="text-amber" style={{ color: "#f8b43c" }} aria-hidden>
                ★
              </div>
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#9aa6c1" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
