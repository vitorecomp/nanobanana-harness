import type { Metadata } from "next";
import "./globals.css";
import { StudioSessionProvider } from "@/core/context/StudioSessionContext";
import { AppShell } from "@/shared";

export const metadata: Metadata = {
  title: "Nano Banana Studio — Interactive Image Creation with Google Gemini",
  description:
    "Interactive art direction and multi-turn image creation system powered by Google Nano Banana (gemini-2.5-flash-image), Python Co-Pilot, PostgreSQL, RustFS Bucket, and Zero-Storage RAM architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <StudioSessionProvider>
          <AppShell>{children}</AppShell>
        </StudioSessionProvider>
      </body>
    </html>
  );
}
