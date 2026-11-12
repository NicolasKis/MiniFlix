import type { ReactNode } from 'react'

export function Logo() {
  return (
    <svg width="72" height="40" viewBox="0 0 72 40" fill="none" aria-hidden="true">
      <path d="M18 26 C27 26 26 9 37 9 H56" stroke="#F5A524" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 26 C47 26 46 36 53 36 H60" stroke="#5A5D66" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 26 H69" stroke="#E23636" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="57" cy="9" r="3.5" fill="#F5A524" />
      <path d="M63 33 L67 39 M67 33 L63 39" stroke="#5A5D66" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="26" r="4.5" fill="#F2EFEA" />
      <circle cx="40" cy="26" r="4.5" fill="#F2EFEA" />
    </svg>
  )
}

export function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function Chevron({ down }: { down: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: down ? 'rotate(180deg)' : undefined }}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  )
}

const Tile = ({ label, w = 24, fill, children }: { label: string; w?: number; fill: string; children: ReactNode }) => (
  <svg width={w * 0.84} height={20} viewBox={`0 0 ${w} 24`} role="img" aria-label={label}>
    <title>{label}</title>
    <rect width={w} height="24" rx="6" fill={fill} />
    {children}
  </svg>
)

const letters = (x: number, text: string, color: string, size = 17) => (
  <text x={x} y="17.6" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize={size} fill={color}>{text}</text>
)

// Small original badges in each service's colours, readable at 20 px.
export function Service({ name }: { name: string }) {
  switch (name) {
    case 'Disney+':
      return (
        <Tile label="On Disney+" w={36} fill="#4FC3F7">
          {letters(16, 'D', '#06213A', 18)}
          <path d="M25 8.5v7M21.5 12h7" stroke="#06213A" strokeWidth="2.6" strokeLinecap="round" />
        </Tile>
      )
    case 'Netflix':
      return <Tile label="On Netflix" fill="#E50914">{letters(12, 'N', '#FFFFFF')}</Tile>
    case 'HBO Max':
      return <Tile label="On HBO Max" w={40} fill="#5B2EE5">{letters(20, 'max', '#FFFFFF', 15)}</Tile>
    case 'Jellyfin':
      return (
        <Tile label="On your Jellyfin" fill="#A58BF0">
          <path d="M12 5.2 L18.6 17.4 Q19 18.2 18.1 18.2 H5.9 Q5 18.2 5.4 17.4 Z" fill="#1E1438" />
          <path d="M12 11 L14.6 15.6 H9.4 Z" fill="#A58BF0" />
        </Tile>
      )
    default:
      return <Tile label="Rent or buy only" fill="#3A3D45">{letters(12, '€', '#F5A524', 15)}</Tile>
  }
}

export function CreditsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h10M7 14h6" />
    </svg>
  )
}
