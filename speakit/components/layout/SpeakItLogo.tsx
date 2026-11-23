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
        className="shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]"
      >
        <defs>
          <linearGradient id="sit-neon" x1="4" y1="6" x2="40" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="55%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
          <linearGradient id="sit-glass" x1="6" y1="4" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.22)" />
            <stop offset="50%" stopColor="rgba(15, 23, 42, 0.85)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0.25)" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="11"
          fill="url(#sit-glass)"
          stroke="url(#sit-neon)"
          strokeWidth="1.6"
        />
        <path
          d="M9 4.5H35"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M22 9.5C14.8 9.5 9.5 14.5 9.5 21C9.5 24 10.7 26.7 12.7 28.7L10.8 34.5L16.8 32.1C18.4 32.6 20.2 32.8 22 32.8C29.2 32.8 34.5 27.8 34.5 21.1C34.5 14.5 29.2 9.5 22 9.5Z"
          fill="rgba(15, 23, 42, 0.72)"
          stroke="url(#sit-neon)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M34 15.5H37.5M34.5 21H38.5M33.5 26.5H37"
          stroke="#C084FC"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="38" cy="15.5" r="1.2" fill="#E879F9" />
        <circle cx="38.8" cy="21" r="1.2" fill="#A855F7" />
        <circle cx="37.4" cy="26.5" r="1.2" fill="#818CF8" />
        <path
          d="M9.5 17H6.2M9.5 22.5H5.8"
          stroke="#22D3EE"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="6" cy="17" r="1.2" fill="#67E8F9" />
        <circle cx="5.6" cy="22.5" r="1.2" fill="#22D3EE" />
        <circle
          cx="22"
          cy="21.2"
          r="7.8"
          fill="rgba(8, 15, 35, 0.9)"
          stroke="url(#sit-neon)"
          strokeWidth="1.2"
        />
        <text
          x="22"
          y="24.8"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="10.8"
          fontWeight="800"
          fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
          letterSpacing="-0.4"
        >
          IT
        </text>
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
          Speak
          <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
            IT
          </span>
        </span>
      )}
    </span>
  );
}
