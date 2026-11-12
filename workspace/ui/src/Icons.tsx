import type { SVGProps } from "react";
import palm from "./assets/congo-palm.png";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 20, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
  ...props,
});

/** The Congo palm, drawn in the current text color (a mask over the shipped mark). */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="congo-mark"
      aria-hidden="true"
      style={{ width: size, height: size, WebkitMaskImage: `url(${palm})`, maskImage: `url(${palm})` }}
    />
  );
}

export function MenuIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4 7H20M4 12H20M4 17H20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ComposeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 11.15V8.85c0-1.1.02-1.91.13-2.55.13-.65.34-1.1.7-1.5.69-.8 1.35-1.07 2.24-1.25.62-.12 1.43-.13 2.38-.13h.3a.75.75 0 0 1 0 1.5H8.85c-.99 0-1.69 0-2.24.05-.54.04-.86.12-1.11.25-.52.26-.94.68-1.2 1.2-.13.25-.21.57-.26 1.11C4 8.06 4 8.76 4 8.85v2.3c0 .99 0 1.69.04 2.24.04.54.13.86.26 1.11.26.52.68.94 1.2 1.2.25.13.57.21 1.11.26.54.04 1.24.04 2.24.04h2.3c.99 0 1.69 0 2.24-.04.54-.05.86-.13 1.11-.26.52-.26.94-.68 1.2-1.2.13-.25.21-.57.26-1.11.04-.55.04-1.24.04-2.24v-.4a.75.75 0 0 1 1.5 0v.4c0 .97 0 1.74-.05 2.36-.05.63-.16 1.17-.41 1.67-.41.8-1.06 1.44-1.86 1.86-.5.25-1.04.36-1.67.41-.62.05-1.39.05-2.36.05H8.85c-.97 0-1.74 0-2.36-.05-.63-.05-1.17-.16-1.67-.41-.8-.42-1.45-1.06-1.86-1.86-.25-.5-.36-1.04-.41-1.67C2.5 12.86 2.5 12.09 2.5 11.15Z" fill="currentColor" />
      <path d="M13.22 3.22a2.5 2.5 0 0 1 3.56 3.56l-5.37 5.37c-.7.7-1.66 1.1-2.65 1.1H7.5a.75.75 0 0 1-.75-.75v-1.26c0-.99.4-1.95 1.1-2.65l5.37-5.37Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CommunityIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.43 6.41c.73-.13 1.37.57 1.12 1.3l-1.22 3.67c-.15.45-.5.8-.95.95l-3.67 1.22c-.78.26-1.52-.48-1.26-1.26l1.22-3.67c.15-.45.5-.8.95-.95l3.67-1.22.14-.04Z" fill="currentColor" />
      <path d="M10 18.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const LibraryIcon = CommunityIcon;

export function LiveAppIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.25" y="3.25" width="15.5" height="11" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 6.9v3.7c0 .38.41.62.74.43l3.2-1.85a.5.5 0 0 0 0-.86l-3.2-1.85a.5.5 0 0 0-.74.43Z" fill="currentColor" />
      <path d="M6.5 17.25h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16.5 10h-13v4.25c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V10Zm1.5 4.25A2.75 2.75 0 0 1 15.25 17H4.75A2.75 2.75 0 0 1 2 14.25v-9A2.75 2.75 0 0 1 4.75 2.5h2.92c.73 0 1.43.29 1.94.81l1.12 1.12c.05.05.11.07.18.07h4.34A2.75 2.75 0 0 1 18 7.25v7ZM3.5 8.5h13V7.25c0-.69-.56-1.25-1.25-1.25h-4.34c-.46 0-.9-.18-1.23-.51L8.56 4.37a.25.25 0 0 0-.18-.07H4.75c-.69 0-1.25.56-1.25 1.25V8.5Z" fill="currentColor" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15.08 17.39c.83.53 1.92-.07 1.92-1.05V4.75A2.25 2.25 0 0 0 14.75 2.5h-9.5A2.25 2.25 0 0 0 3 4.75v11.59c0 .98 1.09 1.58 1.92 1.05l4.4-2.82c.42-.27.94-.27 1.35 0l4.41 2.82Z" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M10 2.15c-4.32 0-7.85 3.53-7.85 7.85S5.68 17.85 10 17.85c.78 0 1.4-.63 1.4-1.4 0-.36-.14-.7-.36-.94-.24-.25-.36-.55-.36-.93 0-.75.6-1.36 1.36-1.36h1.56A4.55 4.55 0 0 0 18.15 8.7c0-3.62-3.66-6.55-8.15-6.55Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="6.25" cy="9.15" r="1" fill="currentColor" />
      <circle cx="8.25" cy="5.85" r="1" fill="currentColor" />
      <circle cx="12.15" cy="5.75" r="1" fill="currentColor" />
      <circle cx="14.15" cy="8.9" r="1" fill="currentColor" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 16V4m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5.5 7.75 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EllipsisIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="5" cy="10" r="1.25" fill="currentColor" />
      <circle cx="10" cy="10" r="1.25" fill="currentColor" />
      <circle cx="15" cy="10" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M11.11 17.07c4.32-2.09 7.2-5.4 7.2-9.57a4.38 4.38 0 0 0-4.56-5c-1.5 0-2.58.72-3.41 1.61a.88.88 0 0 1-1.37 0A4.48 4.48 0 0 0 6.25 2.5 4.55 4.55 0 0 0 1.75 7.5c0 4.16 2.82 7.47 7.14 9.57.7.34 1.52.34 2.22 0Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3v9m0 0 3.2-3.2M10 12 6.8 8.8M4 15.5h12" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.72 3.22a1.95 1.95 0 0 1 2.76 2.76l-8.96 8.96a1.5 1.5 0 0 1-.71.4l-2.75.82.82-2.75c.06-.26.2-.5.4-.71l8.44-8.48Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="m12.5 4.5 3 3" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8.1 11.9 11.9 8.1M7.5 6.3l1.1-1.1a3.4 3.4 0 0 1 4.8 4.8l-1.1 1.1M12.5 13.7l-1.1 1.1a3.4 3.4 0 0 1-4.8-4.8l1.1-1.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 10.5 3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.5c.45 4.2 2.9 6.55 7.5 7.5-4.6.95-7.05 3.3-7.5 7.5-.45-4.2-2.9-6.55-7.5-7.5C7.1 9.05 9.55 6.7 10 2.5Z" fill="currentColor" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="6.75" stroke="currentColor" strokeWidth="1.35" />
      <path d="M10 9.25v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.75" y="3.5" width="14.5" height="13" rx="3" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7 3.75v12.5" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m12 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8.75" cy="8.75" r="5.25" stroke="currentColor" strokeWidth="1.35" />
      <path d="m12.7 12.7 3.55 3.55" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4.5 15.5h11" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.75" y="2.75" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="11.75" y="2.75" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2.75" y="11.75" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="11.75" y="11.75" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6h11M8 3.5h4M6.5 6l.65 10h5.7l.65-10M8.75 8.5v4.75M11.25 8.5v4.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m13.2 3.6 3.2 3.2M4 16l1-4L14 3a1.9 1.9 0 0 1 2.7 2.7L7.8 15 4 16Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 3h12v10l-4 4H4V3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12 17v-4h4M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Filter: three bars narrowing. */
export function FilterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 5.5h13M6 10h8M8.5 14.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Sort: one arrow up, one down. */
export function SortIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path
        d="M6.5 15.5v-11m0 0L3.75 7.25M6.5 4.5l2.75 2.75M13.5 4.5v11m0 0l-2.75-2.75m2.75 2.75l2.75-2.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
