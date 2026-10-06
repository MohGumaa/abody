import type { ReactNode } from "react";
import Image from "next/image";

// Simplified card brand marks for the footer. Each badge keeps a white card
// face so the brand colors read the same in both languages and themes.
function CardBadge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li>
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 38 24"
        className="h-6 w-auto"
      >
        <rect
          x="0.5"
          y="0.5"
          width="37"
          height="23"
          rx="3.5"
          fill="#fff"
          stroke="#d9dce1"
        />
        {children}
      </svg>
    </li>
  );
}

export function PaymentCards({ label }: { label: string }) {
  return (
    <ul aria-label={label} className="flex items-center gap-1.5">
      <CardBadge label="Visa">
        <text
          x="19"
          y="16"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="11"
          fontStyle="italic"
          fontWeight="800"
          fill="#1a1f71"
        >
          VISA
        </text>
      </CardBadge>
      <CardBadge label="Mastercard">
        <circle cx="15" cy="12" r="6.5" fill="#eb001b" />
        <circle cx="23" cy="12" r="6.5" fill="#f79e1b" />
        <path d="M19 6.9a6.5 6.5 0 0 1 0 10.2 6.5 6.5 0 0 1 0-10.2z" fill="#ff5f00" />
      </CardBadge>
      <CardBadge label="American Express">
        <rect x="3" y="3" width="32" height="18" rx="2" fill="#006fcf" />
        <text
          x="19"
          y="15.5"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="8.5"
          fontWeight="800"
          fill="#fff"
        >
          AMEX
        </text>
      </CardBadge>
      <li>
        <Image src="/apple-pay.svg" alt="Apple Pay" width={58} height={40} className="h-6 w-auto" />
      </li>
      <li>
        <Image src="/google-pay.svg" alt="Google Pay" width={70} height={48} className="h-6 w-auto" />
      </li>
    </ul>
  );
}
