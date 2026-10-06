import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

// Decorative line icons from the mockups. They take the current text color;
// the element around them carries the accessible name.
function Icon({
  className = "h-5 w-5",
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L20.5 7H6" />
    </Icon>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 12h12" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6v12M6 12h12" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V4m0 16h16M8 16v-4m4 4V8m4 8v-6" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.5 3.5 5.2" />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.8 5.4 3.8 8.5s-1.3 5.9-3.8 8.5c-2.5-2.6-3.8-5.4-3.8-8.5s1.3-5.9 3.8-8.5z" />
    </Icon>
  );
}

// Directional: mirror with rtl:-scale-x-100 where it is used.
export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

// Directional: mirror with rtl:-scale-x-100 where it is used.
export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14m0 0-5-5m5 5-5 5" />
    </Icon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10" />
    </Icon>
  );
}

// Directional: mirror with rtl:-scale-x-100 where it is used.
export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Icon>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10v4h3l8 4V6l-8 4zM18 9.5a3.5 3.5 0 0 1 0 5M8 14.5V19h3" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 5.4-1.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </Icon>
  );
}
