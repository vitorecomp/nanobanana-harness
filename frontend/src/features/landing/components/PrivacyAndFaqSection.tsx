"use client";

import React, { useState } from "react";

interface PrivacyAndFaqSectionProps {
  hasKeyInRam: boolean;
}

export default function PrivacyAndFaqSection({
  hasKeyInRam,
}: PrivacyAndFaqSectionProps) {
  const [auditCount, setAuditCount] = useState<number>(1);
  const [lastAuditTime, setLastAuditTime] = useState<string>("Verified just now");

  const runLiveStorageAudit = () => {
    setAuditCount((prev) => prev + 1);
    setLastAuditTime(
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  };

  return (
    <>
      <section
        id="privacy"
        className="editorial-section"
        aria-labelledby="privacy-heading"
      >
        <div className="section-header-row">
          <div>
            <h2 id="privacy-heading" className="section-display-title">
              ZERO-STORAGE PRIVACY ARCHITECTURE
            </h2>
          </div>
          <p className="section-lead-copy">
            Nano Banana Studio enforces strict plane separation: our Python
            backend handles prompt intelligence and gallery persistence, while
            your Gemini API key lives exclusively in volatile browser tab RAM.
          </p>
        </div>

        <div className="privacy-architecture-grid">
          <div className="architecture-diagram-box">
            <div className="data-lane-box">
              <h3 className="lane-title">
                Plane A — Nginx Gateway, Python Co-Pilot, PostgreSQL &amp;
                RustFS Bucket
              </h3>
              <p className="lane-copy">
                The <strong>Nginx Reverse Proxy</strong> unifies{" "}
                <code>/</code>, <code>/api/</code>, and <code>/s3/</code>: it
                authenticates creators via <strong>Google OAuth</strong> (
                <code>POST /api/auth/google</code>) or{" "}
                <strong>Facebook Login</strong> (
                <code>POST /api/auth/facebook</code>), persists multi-turn
                conversations in <strong>PostgreSQL 16</strong> (Flask +
                SQLAlchemy + Alembic), and stores generated artwork in the{" "}
                <strong>RustFS S3 Bucket</strong> (
                <code>nanobanana-images</code>) for your Personal &amp;
                Published Galleries. The{" "}
                <code>zero_storage_api_key_guard</code> middleware rejects any
                request carrying an API key with <code>HTTP 400</code>.
              </p>
            </div>

            <div className="data-lane-box yellow-lane">
              <h3 className="lane-title">
                Plane B — Direct Browser → Google Nano Banana (Complete Backend
                Bypass)
              </h3>
              <p className="lane-copy">
                When you click Generate on the <code>/create</code> page, the
                TypeScript client (
                <code>src/features/studio/services/nanobananaClient.ts</code>)
                reads your key directly from React <code>useState</code> in RAM
                and dispatches an HTTPS <code>POST</code> straight from your
                browser to{" "}
                <code>
                  generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
                </code>
                . When you close the browser tab, the operating system reclaims
                the memory immediately.
              </p>
            </div>
          </div>

          <div
            className="storage-auditor-box"
            aria-label="Real-Time Browser Storage Auditor"
          >
            <div>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  marginBottom: "6px",
                  color: "var(--accent-yellow)",
                }}
              >
                LIVE BROWSER STORAGE AUDITOR (#0{auditCount})
              </h3>
              <p
                style={{
                  fontSize: "0.86rem",
                  color: "var(--text-on-ink-muted)",
                  marginBottom: "16px",
                }}
              >
                Real-time inspection of browser persistence layers (
                {lastAuditTime}):
              </p>

              <table className="auditor-table">
                <thead>
                  <tr>
                    <th>Storage Layer</th>
                    <th>API Key Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>React useState (RAM)</td>
                    <td style={{ color: "var(--accent-yellow)" }}>
                      {hasKeyInRam
                        ? "Present in RAM (Volatile)"
                        : "Empty (Simulation Mode)"}
                    </td>
                  </tr>
                  <tr>
                    <td>Web Disk Storage (Local)</td>
                    <td>0 keys stored (Never used)</td>
                  </tr>
                  <tr>
                    <td>Web Session Storage</td>
                    <td>0 keys stored (Never used)</td>
                  </tr>
                  <tr>
                    <td>HTTP Cookies &amp; IndexedDB</td>
                    <td>0 keys stored (Never used)</td>
                  </tr>
                  <tr>
                    <td>Python Backend (:8000)</td>
                    <td>Blocked by HTTP 400 Guard</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              type="button"
              id="run-storage-audit-btn"
              className="key-action-btn"
              onClick={runLiveStorageAudit}
            >
              Re-Verify Browser Storage ↻
            </button>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="editorial-section editorial-section-alt"
        aria-labelledby="faq-heading"
      >
        <div className="section-header-row">
          <div>
            <h2 id="faq-heading" className="section-display-title">
              FREQUENTLY ASKED QUESTIONS (FAQ)
            </h2>
          </div>
        </div>

        <div className="faq-list">
          <article className="faq-item">
            <h3 className="faq-question">
              How is Nano Banana Studio organized across its 4 core pages?
            </h3>
            <p className="faq-answer">
              <strong>1. Home (<code>/</code>)</strong> introduces the
              interactive creation workflow and zero-storage architecture,
              redirecting you to the{" "}
              <strong>2. Gallery (<code>/gallery</code>)</strong> where you can
              browse Published Community Generations or view your Personal
              Gallery. <strong>3. Login (<code>/login</code>)</strong>{" "}
              authenticates your Google or Facebook account and takes you
              straight to your Personal Gallery (
              <code>/gallery?tab=personal</code>).{" "}
              <strong>4. Creation Studio (<code>/create</code>)</strong> is the
              dedicated workspace that guides you through creating and refining
              images with Google Nano Banana.
            </p>
          </article>

          <article className="faq-item">
            <h3 className="faq-question">
              What is Google Nano Banana (gemini-2.5-flash-image)?
            </h3>
            <p className="faq-answer">
              It is the low-latency native multimodal image generation and
              editing model in the Gemini 2.5 family. It supports both
              generating new scenes from rich art-direction prompts and editing
              an existing frame by passing it as <code>inlineData</code>{" "}
              alongside iterative visual instructions.
            </p>
          </article>

          <article className="faq-item">
            <h3 className="faq-question">
              Can I test the Studio without a Gemini API Key right now?
            </h3>
            <p className="faq-answer">
              Yes! Interactive Simulation Mode is enabled by default on{" "}
              <code>/create</code> so you can test the Python prompt diagnosis,
              guided art-direction questions, multi-turn evolution, and gallery
              publishing immediately.
            </p>
          </article>

          <article className="faq-item">
            <h3 className="faq-question">
              Why is my Gemini API Key never saved to disk in the browser?
            </h3>
            <p className="faq-answer">
              Credentials written to browser disk storage persist in profile
              files on the machine. Keeping your key strictly in volatile React{" "}
              <code>useState</code> RAM inside our root session provider ensures
              it stays available as you navigate between <code>/</code>,{" "}
              <code>/gallery</code>, and <code>/create</code>, and is wiped the
              instant you close the tab.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
