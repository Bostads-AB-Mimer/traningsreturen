/** Träningsreturen's mark: a running figure on Mimer pink. Same artwork as the favicon. */
export function RunnerMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="16" fill="#E6246E" />
      <circle cx="43" cy="13" r="6" fill="#fff" />
      <g fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M39 22 30 37" />
        <path d="M38 24 26 25" />
        <path d="M38 24 46 31" />
        <path d="M30 37 41 43 38 55" />
        <path d="M30 37 21 46 13 44" />
      </g>
    </svg>
  )
}
