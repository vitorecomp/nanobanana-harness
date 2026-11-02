"use client";

import React, { ReactNode, Suspense } from "react";
import Link from "next/link";
import Navbar from "./Navbar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="monitor-shell">
      <Suspense fallback={<div style={{ height: "72px" }} />}>
        <Navbar />
      </Suspense>

      <main id="top">{children}</main>

      <footer className="editorial-footer">
        <div>
          <strong>nanobanana✦ studio</strong> — Interactive Image Creation with
          Google Gemini (<code>gemini-2.5-flash-image</code>) • PostgreSQL &amp;
          RustFS Bucket
        </div>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "inherit", fontWeight: 700 }}>
            Home
          </Link>
          <Link href="/gallery" style={{ color: "inherit", fontWeight: 700 }}>
            Published Gallery
          </Link>
          <Link
            href="/gallery?tab=personal"
            style={{ color: "inherit", fontWeight: 700 }}
          >
            Personal Gallery
          </Link>
          <Link href="/create" style={{ color: "inherit", fontWeight: 700 }}>
            Creation Studio
          </Link>
          <Link href="/login" style={{ color: "inherit", fontWeight: 700 }}>
            Sign In
          </Link>
          <span>
            • Zero-Storage API Key: Strictly in{" "}
            <code>React useState (RAM)</code>
          </span>
        </div>
      </footer>
    </div>
  );
}
