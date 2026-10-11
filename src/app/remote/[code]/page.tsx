"use client";

import { Suspense, useEffect, useState } from "react";
import { HostRemote } from "@/components/HostRemote";

export default function RemotePage({
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
    <Suspense fallback={<main className="p-10 text-muted">Loading controls…</main>}>
      <HostRemote key={code} code={code} />
    </Suspense>
  );
}
