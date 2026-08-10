import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { SiteBrandShell } from "@/components/SiteBrandShell";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Trivia Live",
  description: "Live trivia for up to 200 players",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <SiteBrandShell>{children}</SiteBrandShell>
      </body>
    </html>
  );
}
