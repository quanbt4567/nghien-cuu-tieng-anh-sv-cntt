interface SpeakItLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
}

export function SpeakItLogo({ showWordmark = true, size = "md" }: SpeakItLogoProps) {
  const iconSize = size === "sm" ? 28 : 36;

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="10"
          fill="#1D4ED8"
        />
        <path
          d="M22 9.5C14.8 9.5 9.5 14.5 9.5 21C9.5 24 10.7 26.7 12.7 28.7L10.8 34.5L16.8 32.1C18.4 32.6 20.2 32.8 22 32.8C29.2 32.8 34.5 27.8 34.5 21.1C34.5 14.5 29.2 9.5 22 9.5Z"
          fill="#FFFFFF"
        />
        <path
          d="M34 15.5H37.5M34.5 21H38.5M33.5 26.5H37"
          stroke="#BFDBFE"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="38" cy="15.5" r="1.2" fill="#FFFFFF" />
        <circle cx="38.8" cy="21" r="1.2" fill="#FFFFFF" />
        <circle cx="37.4" cy="26.5" r="1.2" fill="#FFFFFF" />
        <path
          d="M9.5 17H6.2M9.5 22.5H5.8"
          stroke="#BFDBFE"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="6" cy="17" r="1.2" fill="#FFFFFF" />
        <circle cx="5.6" cy="22.5" r="1.2" fill="#FFFFFF" />
        <text
          x="22"
          y="25.2"
          textAnchor="middle"
          fill="#0F172A"
          fontSize="12"
          fontWeight="800"
          fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
          letterSpacing="-0.4"
        >
          IT
        </text>
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
          Speak<span className="text-blue-700 dark:text-blue-400">IT</span>
        </span>
      )}
    </span>
  );
}
