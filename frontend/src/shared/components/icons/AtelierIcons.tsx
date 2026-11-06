import React from "react";

export interface AtelierIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function IconPlus({
  size = 12,
  strokeWidth = 2.2,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 2.25V9.75M2.25 6H9.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMinus({
  size = 12,
  strokeWidth = 2.1,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.5 6H9.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconClose({
  size = 12,
  strokeWidth = 1.9,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 3L9 9M9 3L3 9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconDoubleChevron({
  direction,
  size = 13,
  strokeWidth = 1.9,
  className,
}: AtelierIconProps & { direction: "left" | "right" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {direction === "left" ? (
        <path
          d="M7.5 4.25L3.75 8L7.5 11.75M12.25 4.25L8.5 8L12.25 11.75"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M3.75 4.25L7.5 8L3.75 11.75M8.5 4.25L12.25 8L8.5 11.75"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function IconChevron({
  direction,
  size = 12,
  strokeWidth = 2,
  className,
}: AtelierIconProps & { direction: "left" | "right" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {direction === "left" ? (
        <path
          d="M7.5 2.75L4.25 6L7.5 9.25"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M4.5 2.75L7.75 6L4.5 9.25"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function IconExpand({
  size = 14,
  strokeWidth = 1.85,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 2.5H13.5V6M6 13.5H2.5V10M13.5 2.5L9.25 6.75M2.5 13.5L6.75 9.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDownload({
  size = 14,
  strokeWidth = 1.85,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 2.5V10.5M5 7.75L8 10.75L11 7.75M3 13.25H13"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconAutoGrid({
  size = 13,
  strokeWidth = 1.75,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2.5"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="9"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="2.5"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <rect
        x="9"
        y="9"
        width="4.5"
        height="4.5"
        rx="1"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

export function IconGripDots({ size = 12, className }: AtelierIconProps) {
  const w = Math.round((size * 10) / 14);
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 10 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="3" cy="3" r="1.2" fill="currentColor" />
      <circle cx="7" cy="3" r="1.2" fill="currentColor" />
      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" />
      <circle cx="3" cy="11" r="1.2" fill="currentColor" />
      <circle cx="7" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconAtelierStar({ size = 16, className }: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 3L14.35 9.65L21 12L14.35 14.35L12 21L9.65 14.35L3 12L9.65 9.65L12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconPlay({ size = 11, className }: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.75 2.1L9.75 6L2.75 9.9V2.1Z" fill="currentColor" />
    </svg>
  );
}

export function IconDna({
  size = 14,
  strokeWidth = 1.7,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g transform="rotate(45 8 8)">
        <path
          d="M5.5 2C5.5 4.5 10.5 5.5 10.5 8C10.5 10.5 5.5 11.5 5.5 14M10.5 2C10.5 4.5 5.5 5.5 5.5 8C5.5 10.5 10.5 11.5 10.5 14M6.2 2.75H9.8M6.1 8H9.9M6.2 13.25H9.8"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function IconTrash({
  size = 14,
  strokeWidth = 1.75,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.75 4.25H13.25M6.25 4.25V2.75C6.25 2.34 6.59 2 7 2H9C9.41 2 9.75 2.34 9.75 2.75V4.25M4 4.25L4.65 12.85C4.71 13.5 5.25 14 5.9 14H10.1C10.75 14 11.29 13.5 11.35 12.85L12 4.25M6.75 7V11.25M9.25 7V11.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
