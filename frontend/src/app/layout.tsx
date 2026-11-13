import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { StudioSessionProvider } from "@/core/context/StudioSessionContext";
import { AppShell } from "@/shared";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Nano Banana Studio — Interactive Image Creation & Goal Harness",
  description:
    "Local-first desktop and web art-direction workstation powered by Google Nano Banana (gemini-2.5-flash-image), Goal-Driven Agent Harness, Tauri v2, SQLite, Native OS Filesystem storage, and Zero-Storage RAM key security.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("nanobanana_theme_mode");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}`,
          }}
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
