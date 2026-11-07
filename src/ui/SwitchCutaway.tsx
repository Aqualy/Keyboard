import { useEffect, useRef, useState } from 'react'
import { playKey } from '../audio/engine'
import { mechanismOf, MECHANISM_TEXT, type Mechanism } from '../data/mechanisms'
import { SWITCHES, byId } from '../data/options'
import { prefersReducedMotion } from '../motion'
import { KEY_STATE_EVENT, type KeyState } from '../scene/keyTap'
import { useConfig } from '../state/config'

/** Where along the press the key registers, as a share of full travel. */
const ACTUATION = 0.45
/** Slower than a real press, so each stage can be followed. */
const PRESS_SECONDS = 0.28

const INK = 'var(--ink)'
const PAPER = 'var(--card)'
const SHADE = 'var(--pill)'

/** A spring as a zigzag between two heights. */
function zigzag(x: number, width: number, top: number, bottom: number, turns: number) {
  const step = (bottom - top) / (turns * 2)
  let path = `M${x} ${top}`
  for (let i = 1; i <= turns * 2; i += 1) {
    path += ` L${x + (i % 2 ? width : 0)} ${top + i * step}`
  }
  return path
}

/** The MX design: housing, stem, spring and a contact leaf. Tactile and clicky add their part. */
function MxSwitch({ p, kind, stem }: { p: number; kind: Mechanism; stem: string }) {
  const travel = p * 16
  const closed = p >= ACTUATION
  // A tactile stem's bump pushes the leaf out on its way past.
  const bump = kind === 'tactile' ? Math.max(0, 1 - Math.abs(p - 0.3) / 0.15) : 0
  const leafX = closed ? 92 : 87 + bump * 4
  // The click jacket rides down with the stem, then snaps past the leaf.
  const jacket = kind === 'clicky' ? (p < ACTUATION ? travel : 26) : 0
  return (
    <>
      <path d={zigzag(44, 32, 62 + travel, 97, 6)} fill="none" stroke={INK} strokeWidth="1.4" />
      {/* Bottom housing, cut through the middle */}
      <path
        d="M14 70 H20 V97 H100 V70 H106 V104 H14 Z M56 97 V84 H64 V97 Z"
        fill={SHADE}
        stroke={INK}
        strokeWidth="1.2"
      />
      <rect x="40" y="104" width="4" height="10" fill={INK} />
      <rect x="76" y="104" width="4" height="8" fill={INK} />
      {/* Contact: a fixed plate and the leaf that springs against it */}
      <path d="M95 97 V74" stroke={INK} strokeWidth="2" />
      <path
        d={`M90 97 L${leafX} 68`}
        stroke={closed ? 'var(--blue)' : INK}
        strokeWidth="1.6"
        fill="none"
      />
      <g transform={`translate(0 ${travel})`}>
        <path
          d="M54 10 H66 V50 H82 V58 H84 V77 L80 80 V60 H38 V50 H54 Z"
          fill={stem}
          stroke={INK}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {kind === 'tactile' && <path d="M84 64 Q90 68 84 74" fill={stem} stroke={INK} />}
      </g>
      {kind === 'clicky' && (
        <rect
          x="30"
          y={58 + jacket}
          width="8"
          height="10"
          fill={PAPER}
          stroke={INK}
          strokeWidth="1.2"
        />
      )}
      {/* Top housing */}
      <path
        d="M10 70 L18 44 H52 V50 H24 L20 70 Z M110 70 L102 44 H68 V50 H96 L100 70 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {kind === 'clicky' && closed && p < 0.75 && (
        <path d="M22 80 L14 84 M22 88 L13 90" stroke={INK} strokeWidth="1.2" />
      )}
    </>
  )
}

/** Topre: a slider pressing a rubber dome over a conical spring. */
function DomeSwitch({ p, stem }: { p: number; stem: string }) {
  const travel = p * 16
  // The dome holds until it buckles, then folds quickly.
  const fold = p < 0.35 ? p * 0.6 : 0.21 + (p - 0.35) * 1.2
  const top = 62 + travel
  const side = 30 + fold * 40
  const closed = p >= ACTUATION
  return (
    <>
      <path
        d="M14 70 H20 V97 H100 V70 H106 V104 H14 Z"
        fill={SHADE}
        stroke={INK}
        strokeWidth="1.2"
      />
      <path d="M40 97 H80" stroke={closed ? 'var(--blue)' : INK} strokeWidth="2" />
      <path
        d={`M26 97 C${side} ${85 - fold * 10}, ${44} ${top}, 60 ${top} C${76} ${top}, ${120 - side} ${85 - fold * 10}, 94 97`}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d={zigzag(52, 16, top + 4, 94, 4)} fill="none" stroke={INK} strokeWidth="1" />
      <g transform={`translate(0 ${travel})`}>
        <path d="M50 10 H70 V48 H82 V58 H38 V48 H50 Z" fill={stem} stroke={INK} strokeWidth="1.2" />
      </g>
      <path
        d="M10 70 L18 44 H48 V50 H24 L20 70 Z M110 70 L102 44 H72 V50 H96 L100 70 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="1.2"
      />
    </>
  )
}

/** Buckling spring: a tall spring that bows, buckles and tips a hammer onto the contact. */
function BucklingSwitch({ p, stem }: { p: number; stem: string }) {
  const travel = p * 14
  const buckled = p >= ACTUATION
  const bow = buckled ? 16 : p * 10
  const top = 40 + travel
  const turns = 9
  let path = `M60 ${top}`
  for (let i = 1; i <= turns * 2; i += 1) {
    const t = i / (turns * 2)
    const y = top + (92 - top) * t
    const x = 60 + Math.sin(t * Math.PI) * bow + (i % 2 ? 7 : -7)
    path += ` L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  // The hammer rests tipped up; the buckle drops its far end onto the contact.
  const hammer = buckled ? 5 : -10 + p * 6
  return (
    <>
      <path d="M14 104 H106" stroke={INK} strokeWidth="1.2" />
      <path d="M30 100 H96" stroke={buckled ? 'var(--blue)' : INK} strokeWidth="2.5" />
      <g transform={`rotate(${hammer} 40 94)`}>
        <rect x="40" y="91" width="40" height="5" rx="2" fill={SHADE} stroke={INK} />
      </g>
      <path d={path} fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M24 26 V104 M96 26 V104" stroke={INK} strokeWidth="1.2" />
      <g transform={`translate(0 ${travel})`}>
        <path d="M44 10 H76 V36 H44 Z" fill={stem} stroke={INK} strokeWidth="1.2" />
      </g>
      {buckled && p < 0.75 && (
        <path d="M100 86 L108 82 M100 94 L109 93" stroke={INK} strokeWidth="1.2" />
      )}
    </>
  )
}

/** Follows the keyboard: any key held down, or the drawing itself, presses the switch. */
function usePressDepth() {
  const [p, setP] = useState(0)
  const target = useRef(0)
  const held = useRef(new Set<string>())

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const step = prefersReducedMotion() ? 1 : (now - last) / 1000 / PRESS_SECONDS
      last = now
      setP((current) => {
        const goal = target.current
        if (current === goal) return current
        return goal > current ? Math.min(goal, current + step) : Math.max(goal, current - step)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const onKey = (event: Event) => {
      const { code, down } = (event as CustomEvent<KeyState>).detail
      if (down) held.current.add(code)
      else held.current.delete(code)
      target.current = held.current.size > 0 ? 1 : 0
    }
    window.addEventListener(KEY_STATE_EVENT, onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener(KEY_STATE_EVENT, onKey)
    }
  }, [])

  const press = (down: boolean) => {
    if (down) held.current.add('cutaway')
    else if (!held.current.delete('cutaway')) return
    target.current = held.current.size > 0 ? 1 : 0
    playKey('KeyG', down ? 'press' : 'release')
  }
  return { p, press }
}

/** A cut-open switch that presses along with the keyboard, so each type's insides make sense. */
export function SwitchCutaway({ className }: { className: string }) {
  const option = useConfig((state) => byId(SWITCHES, state.config.switch))
  const mechanism = mechanismOf(option.id)
  const { p, press } = usePressDepth()

  return (
    <figure className={`cutaway ${className}`}>
      <figcaption className="label">Inside the switch</figcaption>
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Cutaway of a ${option.name} switch. ${MECHANISM_TEXT[mechanism]}`}
        data-mechanism={mechanism}
        data-pressed={p >= ACTUATION}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          press(true)
        }}
        onPointerUp={() => press(false)}
        onPointerCancel={() => press(false)}
      >
        {mechanism === 'dome' ? (
          <DomeSwitch p={p} stem={option.stemHex} />
        ) : mechanism === 'buckling' ? (
          <BucklingSwitch p={p} stem={option.stemHex} />
        ) : (
          <MxSwitch p={p} kind={mechanism} stem={option.stemHex} />
        )}
      </svg>
      <p>{MECHANISM_TEXT[mechanism]}</p>
    </figure>
  )
}
