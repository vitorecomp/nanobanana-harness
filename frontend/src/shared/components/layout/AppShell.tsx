"use client";

import React, { ReactNode, Suspense } from "react";
import Navbar from "./Navbar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="ref-desktop-shell">
      <Suspense fallback={<div style={{ height: "70px" }} />}>
        <Navbar />
      </Suspense>

      <main id="top" className="ref-canvas-surface">
        {children}
      </main>
    </div>
  );
}
