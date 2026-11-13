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

export function IconUploadImage({
  size = 16,
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
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <circle cx="5.5" cy="6" r="1.15" fill="currentColor" />
      <path
        d="M2.4 11.6L5.9 8.4L8.6 10.9L10.7 9L13.6 11.8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPromptText({
  size = 16,
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
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M5 6.25H11M5 9.75H8.8"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconRefresh({
  size = 13,
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
        d="M13.25 8A5.25 5.25 0 1 1 11.7 4.28L13.25 5.75M13.25 2.75V5.75H10.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCheck({
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
        d="M2.25 6.25L4.85 8.85L9.75 3.35"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrophy({
  size = 13,
  strokeWidth = 1.8,
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
        d="M5 2.5H11V6.5C11 8.16 9.66 9.5 8 9.5C6.34 9.5 5 8.16 5 6.5V2.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M5 3.75H3.25C2.84 3.75 2.5 4.09 2.5 4.5V5.25C2.5 6.49 3.51 7.5 4.75 7.5H5.15M11 3.75H12.75C13.16 3.75 13.5 4.09 13.5 4.5V5.25C13.5 6.49 12.49 7.5 11.25 7.5H10.85M8 9.5V13M5.5 13.25H10.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSettingsGear({
  size = 14,
  strokeWidth = 1.8,
  className,
}: AtelierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="3.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconKey({
  size = 13,
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
      <circle
        cx="5.5"
        cy="8"
        r="3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        d="M8.5 8H13.75M11.5 8V10.25M13.5 8V9.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconBolt({
  size = 12,
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
        d="M8.75 2L3.75 8.75H8L7.25 14L12.25 7.25H8L8.75 2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconEditPencil({
  size = 13,
  strokeWidth = 2.1,
  className,
}: AtelierIconProps) {
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
        d="M12 20.5H21"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 4a2.121 2.121 0 0 1 3 3L7 19.5l-4 1 1-4L16.5 4z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
