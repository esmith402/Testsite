import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const HUMAN_SPRITE = [
  0b0000011111100000,
  0b0000111111110000,
  0b0000011001100000,
  0b0000111111110000,
  0b0000011111100000,
  0b0000001111000000,
  0b0001111111111000,
  0b0011001111001100,
  0b0011001111001100,
  0b0011001111001100,
  0b0011001111001100,
  0b0000001111000000,
  0b0000011001100000,
  0b0000011001100000,
  0b0000011001100000,
  0b0000111001110000,
]

const MCP_SPRITE = [
  0b11111111,
  0b11011011,
  0b11111111,
  0b11011011,
  0b11111111,
  0b11111111,
  0b11111111,
  0b10100101,
]

function Sprite({ rows, color, size = 6, bits = 8 }) {
  return (
    <div className="sprite" style={{ '--size': `${size}px`, '--bits': bits }}>
      {rows.map((row, r) =>
        Array.from({ length: bits }, (_, c) => (
          <div
            key={`${r}-${c}`}
            className={`px ${(row >> (bits - 1 - c)) & 1 ? 'on' : ''}`}
            style={{ '--color': color }}
          />
        ))
      )}
    </div>
  )
}

function Shards({ color }) {
  const shards = Array.from({ length: 100 }, () => ({
    x: (Math.random() - 0.5) * 44,
    y: 55 + Math.random() * 18,
    r: (Math.random() - 0.5) * 360,
    s: 1 + Math.random() * 3,
    delay: Math.random() * 350,
  }))
  return (
    <div className="shards" aria-hidden="true">
      {shards.map((s, i) => (
        <div key={i} className="shard" style={{
          '--tx': `${s.x}px`, '--ty': `${s.y}px`, '--tr': `${s.r}deg`,
          width: `${s.s}px`, height: `${s.s}px`, background: color,
          animationDelay: `${s.delay}ms`,
        }} />
      ))}
    </div>
  )
}

function Character({ name, label, color, isHero, isMCP, heroRef, onVillainHover, derezzing, shaking, hideDisk }) {
  const [hovered, setHovered] = useState(false)
  const wrapRef = useRef(null)
  const isVillain = !isHero && !isMCP

  const setRefs = (el) => {
    wrapRef.current = el
    if (isHero && heroRef) heroRef.current = el
  }

  return (
    <div className="char-wrap" ref={setRefs}>
      <div
        className={`char ${isHero && hovered ? 'tipped' : ''} ${isVillain && derezzing ? 'derezzing' : ''} ${isMCP && shaking ? 'shaking' : ''} ${isHero ? 'is-hero' : ''} ${isMCP ? 'is-mcp' : ''}`}
        onMouseEnter={() => { setHovered(true); (isVillain || isMCP) && onVillainHover?.(name, wrapRef.current, isMCP) }}
        onMouseLeave={() => setHovered(false)}
        title={name}
      >
        <div className="char-body">
          <Sprite rows={isMCP ? MCP_SPRITE : HUMAN_SPRITE} color={color} size={isMCP ? 18 : 5} bits={isMCP ? 8 : 16} />
          {!isMCP && !hideDisk && <div className="tron-disk" style={{ '--disk-color': isHero ? '#00f0ff' : '#ff0000' }} aria-hidden="true" />}
          {isVillain && derezzing && <Shards key={Date.now()} color={color} />}
        </div>
      </div>
      <span className="char-label" style={{ color }}>{label}</span>
      {isHero && <span className="badge hero-badge">HERO</span>}
      {isMCP && <span className="badge mcp-badge">MCP</span>}
    </div>
  )
}

// Reflect 'to' across the arena wall opposite to its side, return bounce point
function calcBounce(from, to, wallsRect) {
  const pad    = 6
  const leftWall  = wallsRect.left  + pad
  const rightWall = wallsRect.right - pad
  const midX      = wallsRect.left  + wallsRect.width / 2
  const wallX     = to.x < midX ? rightWall : leftWall
  const toR       = { x: 2 * wallX - to.x, y: to.y }
  const dx        = toR.x - from.x
  if (Math.abs(dx) < 1) return { x: wallX, y: (from.y + to.y) / 2 }
  const t = (wallX - from.x) / dx
  return {
    x: wallX,
    y: Math.max(wallsRect.top + pad, Math.min(wallsRect.bottom - pad, from.y + t * (to.y - from.y))),
  }
}

const HERO     = { name: 'Aldrich 109',             label: 'ALDRICH 109',    color: '#00f0ff', isHero: true }
const MCP_CHAR = { name: 'MCP — The Administration', label: 'ADMINISTRATION', color: '#ff0000', isMCP: true }
const VILLAINS = [
  { name: 'Aldrich 007', label: 'ALDRICH 007', color: '#ff0066' },
  { name: 'Aldrich 008', label: 'ALDRICH 008', color: '#ff3300' },
  { name: 'Aldrich 009', label: 'ALDRICH 009', color: '#ff6600' },
  { name: 'Aldrich 010', label: 'ALDRICH 010', color: '#cc00ff' },
  { name: 'Aldrich 011', label: 'ALDRICH 011', color: '#ff0099' },
  { name: 'Aldrich 107', label: 'ALDRICH 107', color: '#ff4400' },
  { name: 'Aldrich 108', label: 'ALDRICH 108', color: '#cc0055' },
  { name: 'Aldrich 110', label: 'ALDRICH 110', color: '#880099' },
  { name: 'Aldrich 111', label: 'ALDRICH 111', color: '#ff2200' },
]

export default function App() {
  const heroRef     = useRef(null)
  const wallsRef    = useRef(null)
  const animId      = useRef(null)
  const pendingAnim = useRef(null)
  const [diskMounted,  setDiskMounted]  = useState(false)
  const [derezTarget,  setDerezTarget]  = useState(null)
  const [shakeTarget,  setShakeTarget]  = useState(null)

  useEffect(() => () => cancelAnimationFrame(animId.current), [])

  const launchDisk = useCallback((name, villainEl, isBoss = false) => {
    if (diskMounted) return
    const heroDiskEl = heroRef.current?.querySelector('.tron-disk')
    if (!heroDiskEl || !villainEl) return

    const targetEl  = villainEl.querySelector('.char-body') || villainEl
    const wallsRect = wallsRef.current?.getBoundingClientRect()
    if (!wallsRect) return
    const fr   = heroDiskEl.getBoundingClientRect()
    const tr   = targetEl.getBoundingClientRect()
    const from = { x: fr.left + fr.width  / 2, y: fr.top  + fr.height / 2 }
    const to   = { x: tr.left + tr.width  / 2, y: tr.top  + tr.height / 2 }

    pendingAnim.current = { from, bounce: calcBounce(from, to, wallsRect), to, name, isBoss }
    setDiskMounted(true)
  }, [diskMounted])

  // Callback ref fires once when disk element mounts — drives all animation via direct DOM
  const diskCallbackRef = useCallback((el) => {
    if (!el || !pendingAnim.current) return
    const { from, bounce, to, name } = pendingAnim.current

    function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) }
    function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } }

    const SPEED = 1610 // px/s
    const T1 = dist(from, bounce) / SPEED * 1000
    const T2 = T1 + dist(bounce, to)     / SPEED * 1000
    const T3 = T2 + dist(to,     bounce) / SPEED * 1000
    const T4 = T3 + dist(bounce, from)   / SPEED * 1000

    let start = null
    let hitCalled = false

    el.style.left      = `${from.x}px`
    el.style.top       = `${from.y}px`
    el.style.transform = 'translate(-50%,-50%) rotate(0deg)'

    function tick(ts) {
      if (!start) start = ts
      const e = ts - start
      let pos

      if (e < T1) {
        pos = lerp(from, bounce, e / T1)
      } else if (e < T2) {
        pos = lerp(bounce, to, (e - T1) / (T2 - T1))
        if (!hitCalled) { hitCalled = true; pendingAnim.current?.isBoss ? setShakeTarget(name) : setDerezTarget(name) }
      } else if (e < T3) {
        pos = lerp(to, bounce, (e - T2) / (T3 - T2))
      } else if (e < T4) {
        pos = lerp(bounce, from, (e - T3) / (T4 - T3))
      } else {
        setDiskMounted(false)
        setDerezTarget(null)
        setShakeTarget(null)
        return
      }

      el.style.left      = `${pos.x}px`
      el.style.top       = `${pos.y}px`
      el.style.transform = `translate(-50%,-50%) rotate(${e * 0.5}deg)`
      animId.current = requestAnimationFrame(tick)
    }

    animId.current = requestAnimationFrame(tick)
  }, [])

  return (
    <main className="arena">
      <div className="grid-bg" aria-hidden="true" />

      {diskMounted && <div className="flying-disk" aria-hidden="true" ref={diskCallbackRef} />}

      <header className="arena-header">
        <h1 className="title">ALDRICH 109</h1>
        <p className="subtitle">Home of Section H — The Last Line of Defense</p>
      </header>

      <div className="arena-grid-wrap">
      <div className="persp-panel persp-top" aria-hidden="true" />
      <div className="arena-mid-row">
      <div className="persp-panel persp-left" aria-hidden="true" />
      <div className="arena-walls" ref={wallsRef}>
        <section className="enemy-section" aria-label="Enemies">
          <p className="section-label enemy-label">⚠ THE ENEMY ⚠</p>
          <div className="enemy-wrap">
            <div className="villain-row">
              {VILLAINS.slice(0, 5).map(v => (
                <Character key={v.name} {...v} onVillainHover={launchDisk} derezzing={derezTarget === v.name} />
              ))}
            </div>
            <div className="mcp-row">
              <Character {...MCP_CHAR} onVillainHover={launchDisk} shaking={shakeTarget === MCP_CHAR.name} />
            </div>
            <div className="villain-row">
              {VILLAINS.slice(5).map(v => (
                <Character key={v.name} {...v} onVillainHover={launchDisk} derezzing={derezTarget === v.name} />
              ))}
            </div>
          </div>
        </section>

        <section className="hero-section" aria-label="Hero">
          <p className="section-label">CHAMPION OF THE GRID</p>
          <Character {...HERO} heroRef={heroRef} hideDisk={diskMounted} />
        </section>
      </div>
      <div className="persp-panel persp-right" aria-hidden="true" />
      </div>
      <div className="persp-panel persp-bottom" aria-hidden="true" />
      </div>

      <footer className="arena-footer">SECTION H — ALDRICH 109 — HBS</footer>
    </main>
  )
}
