import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const ExplodeIcon = () => (
  <Icon>
    <path d="M4 7.5 12 4l8 3.5-8 3.5z" />
    <path d="m4 12.5 8 3.5 8-3.5" />
    <path d="m4 17 8 3.5 8-3.5" />
  </Icon>
)

export const ResetIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4.5v4.2h4.2" />
  </Icon>
)

export const SoundOnIcon = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
    <path d="M18 6.5a7.8 7.8 0 0 1 0 11" />
  </Icon>
)

export const SoundOffIcon = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Icon>
)

export const ArrowIcon = () => (
  <Icon>
    <path d="M5 12h14" />
    <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
  </Icon>
)

export const OrbitIcon = () => (
  <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true">
    <ellipse cx="17" cy="8" rx="15" ry="5.5" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="m11 11.5-3 2.4 3.4 1.8"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
