"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ProfileEditModal } from "@/features/auth";
import { useStudioSession } from "@/core/context/StudioSessionContext";

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, setUser, logout } = useStudioSession();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const currentTab = searchParams?.get("tab");
  const isHome = pathname === "/";
  const isGalleryPublic =
    pathname === "/gallery" && currentTab !== "personal";
  const isGalleryPersonal =
    pathname === "/gallery" && currentTab === "personal";
  const isCreate = pathname === "/create";
  const isLogin = pathname === "/login";

  return (
    <>
      <header className="top-header-bar">
        {/* Top-Left Brand Mark ("nanobanana✦") */}
        <div className="brand-logo-wrap">
          <Link
            href="/"
            id="brand-logo-home-link"
            className="brand-logo-link"
          >
            <span>nanobanana</span>
            <span className="brand-mark-badge" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 1L12.6 7.4L19 10L12.6 12.6L10 19L7.4 12.6L1 10L7.4 7.4L10 1Z"
                  fill="#0B0B0B"
                />
              </svg>
            </span>
          </Link>
        </div>

        {/* Top-Center Straight-Angled (65°) Notched Black Navigation Bar */}
        <nav
          className="notched-nav-container"
          aria-label="Nano Banana Studio Primary Navigation"
        >
          <ul className="notched-nav-list">
            <li>
              <Link
                href="/"
                id="nav-link-home"
                className="notched-nav-btn"
                aria-current={isHome ? "page" : undefined}
                style={{ textDecoration: "none" }}
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/gallery"
                id="nav-link-gallery"
                className="notched-nav-btn"
                aria-current={isGalleryPublic ? "page" : undefined}
                style={{ textDecoration: "none" }}
              >
                Published Gallery
              </Link>
            </li>
            <li>
              <Link
                href="/gallery?tab=personal"
                id="nav-link-personal-gallery"
                className="notched-nav-btn"
                aria-current={isGalleryPersonal ? "page" : undefined}
                style={{ textDecoration: "none" }}
              >
                My Gallery
              </Link>
            </li>
            <li>
              <Link
                href="/create"
                id="nav-link-create"
                className="notched-nav-btn"
                aria-current={isCreate ? "page" : undefined}
                style={{ textDecoration: "none" }}
              >
                Create Studio
              </Link>
            </li>
            <li>
              {isAuthenticated && user ? (
                <button
                  type="button"
                  id="nav-btn-profile"
                  className="notched-nav-btn"
                  onClick={() => setIsProfileModalOpen(true)}
                  title="Edit Creator Profile"
                  style={{
                    gap: "8px",
                    padding: "4px 12px 4px 6px",
                  }}
                >
                  <img
                    src={user.picture}
                    alt={user.name}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      border: "1.5px solid var(--accent-yellow)",
                      objectFit: "cover",
                      flexShrink: 0,
                      backgroundColor: "var(--bg-surface)",
                    }}
                  />
                  <span>{user.name}</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  id="nav-link-login"
                  className="notched-nav-btn"
                  aria-current={isLogin ? "page" : undefined}
                  style={{ textDecoration: "none" }}
                >
                  Login
                </Link>
              )}
            </li>
          </ul>
        </nav>

        {/* Right Grid Spacer to keep the Notched Navbar centered */}
        <div className="header-cta-wrap" aria-hidden="true" />
      </header>

      {isAuthenticated && user && (
        <ProfileEditModal
          isOpen={isProfileModalOpen}
          user={user}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={(updatedUser) => setUser(updatedUser)}
          onLogout={() => logout()}
        />
      )}
    </>
  );
}
