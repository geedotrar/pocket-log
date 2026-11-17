import React from 'react';

export default function BrandLogo({ className = 'h-8 w-8 text-[#5B7966] dark:text-[#A7D7B5]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background folded top edge */}
      <path
        d="M26 26C26 21.5817 29.5817 18 34 18H62C66.4183 18 70 21.5817 70 26V30"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Main Wallet Body */}
      <rect
        x="18"
        y="26"
        width="56"
        height="56"
        rx="12"
        stroke="currentColor"
        strokeWidth="6"
      />
      {/* Folded Spine Line */}
      <line
        x1="28"
        y1="26"
        x2="28"
        y2="82"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Horizontal Card Slot Accent */}
      <line
        x1="36"
        y1="40"
        x2="66"
        y2="40"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Clasp Tab */}
      <path
        d="M62 44H73C78.5228 44 83 48.4772 83 54C83 59.5228 78.5228 64 73 64H62"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Clasp Circular Snap Button */}
      <circle
        cx="72"
        cy="54"
        r="3.5"
        fill="currentColor"
      />
    </svg>
  );
}
