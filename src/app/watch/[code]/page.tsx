"use client";

import { Suspense, useEffect, useState } from "react";
import { HostScreen } from "@/components/HostScreen";

export default function WatchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [code, setCode] = useState("");
  useEffect(() => {
    void params.then((p) => setCode(p.code.toUpperCase()));
  }, [params]);

  if (!code) return <main className="p-10 text-muted">Loading…</main>;

  return (
    <Suspense fallback={<main className="p-10 text-muted">Loading watch…</main>}>
      <HostScreen key={code} code={code} variant="watch" />
    </Suspense>
  );
}
