import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10">
      <header className="anim-rise flex items-center justify-between gap-4">
        <div className="display text-3xl text-amber md:text-4xl">Bar Trivia</div>
        <Link href="/admin" className="btn btn-ghost text-sm">
          Admin
        </Link>
      </header>

      <section className="anim-rise mt-16 grid flex-1 gap-10 md:mt-24 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <div>
          <h1 className="display text-5xl leading-[0.95] text-foam md:text-7xl">
            Live rounds.
            <br />
            Phones up.
            <br />
            Fastest wins.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Host creates a game, players join with a code, and the big screen
            tracks scores as answers land — correct and quick scores highest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/join" className="btn btn-primary anim-glow">
              Join a game
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Create games
            </Link>
          </div>
        </div>

        <div className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "120ms" }}>
          <div className="text-sm uppercase tracking-[0.18em] text-muted">Tonight</div>
          <ul className="mt-4 space-y-3 text-foam">
            <li className="flex justify-between border-b border-line pb-3">
              <span>Players</span>
              <span className="text-amber">up to 200</span>
            </li>
            <li className="flex justify-between border-b border-line pb-3">
              <span>Scoring</span>
              <span className="text-amber">correct + speed</span>
            </li>
            <li className="flex justify-between">
              <span>Screens</span>
              <span className="text-amber">host + phones</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
