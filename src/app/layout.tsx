import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "../fonts/bricolage-grotesque-latin.woff2",
  weight: "600 800",
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: "../fonts/figtree-latin.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
});

const condensed = localFont({
  src: "../fonts/oswald-latin.woff2",
  weight: "500 700",
  variable: "--font-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trivia Live",
  description: "Live trivia for up to 200 players",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${condensed.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
