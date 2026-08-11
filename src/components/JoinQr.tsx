"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  /** Absolute or path URL players should open */
  url: string;
  size?: number;
  className?: string;
};

export function JoinQr({ url, size = 240, className = "" }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1020", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className={`animate-pulse rounded-xl bg-chalk/90 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`QR code to join: ${url}`}
      width={size}
      height={size}
      className={`rounded-xl bg-white p-2 ${className}`}
    />
  );
}
