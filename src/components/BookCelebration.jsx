import React, { useEffect, useRef } from 'react'

const CONFETTI_COLORS = [
  '#1d6b5a','#f0a500','#9b59b6','#e74c3c','#3498db',
  '#f7d94c','#2ecc71','#ff7043','#00bcd4','#ff4081',
]

export default function BookCelebration({ bookName, onClose }) {
  const canvasRef = useRef(null)

  /* Inject keyframes once */
  useEffect(() => {
    const id = 'pb-celebration-kf'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = `
        @keyframes pb-overlay-in { from { opacity:0 } to { opacity:1 } }
        @keyframes pb-modal-in   { from { opacity:0; transform:scale(0.6) translateY(30px) }
                                   to   { opacity:1; transform:scale(1)   translateY(0)    } }
      `
      document.head.appendChild(s)
    }
  }, [])

  /* Confetti canvas */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const W = canvas.width, H = canvas.height
    const origins = [
      { x: W * 0.35, y: H * 0.45 },
      { x: W * 0.65, y: H * 0.45 },
    ]

    const particles = []
    origins.forEach(o => {
      for (let i = 0; i < 80; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6
        const speed = Math.random() * 14 + 5
        particles.push({
          x: o.x, y: o.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          w: Math.random() * 10 + 5,
          h: Math.random() * 5 + 3,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.25,
          alpha: 1,
          shape: Math.random() < 0.6 ? 'rect' : 'circle',
        })
      }
    })

    let raf
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of particles) {
        p.vy  += 0.35
        p.vx  *= 0.99
        p.x   += p.vx
        p.y   += p.vy
        p.rotation += p.rotSpeed
        p.alpha    -= 0.0055
        if (p.alpha <= 0) continue
        alive = true
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  /* Auto-dismiss after 6 s */
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:9998,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.5)',
        animation:'pb-overlay-in 0.3s ease',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }}
      />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:'relative', zIndex:10000,
          background:'var(--surface)',
          borderRadius:24,
          padding:'40px 36px 32px',
          maxWidth:320, width:'90%',
          textAlign:'center',
          boxShadow:'0 24px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.08)',
          animation:'pb-modal-in 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{
          width:80, height:80, borderRadius:'50%',
          background:'linear-gradient(135deg,#f0a500 0%,#fde97a 100%)',
          boxShadow:'0 0 0 8px rgba(240,165,0,0.18), 0 8px 24px rgba(240,165,0,0.35)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:38, margin:'0 auto 20px',
        }}>🏆</div>

        <div style={{
          fontSize:11, fontWeight:700, letterSpacing:'0.12em',
          textTransform:'uppercase', color:'var(--teal)',
          marginBottom:6,
        }}>Book Complete!</div>

        <h2 style={{
          fontSize:26, fontFamily:"'Cormorant Garamond',serif",
          fontWeight:700, color:'var(--ink)', margin:'0 0 10px',
          lineHeight:1.2,
        }}>{bookName}</h2>

        <p style={{
          fontSize:13, color:'var(--ink-muted)', lineHeight:1.65,
          margin:'0 0 26px',
        }}>
          You've read every chapter of <strong style={{ color:'var(--ink)' }}>{bookName}</strong>.
          Keep pressing on in God's Word! 🙌
        </p>

        <div style={{
          background:'var(--teal-light)', borderRadius:10,
          padding:'10px 14px', marginBottom:24,
          fontSize:12, fontStyle:'italic', color:'var(--teal)',
          lineHeight:1.55,
        }}>
          "Your word is a lamp to my feet and a light to my path."
          <span style={{ display:'block', marginTop:4, fontStyle:'normal', fontWeight:600, fontSize:11 }}>
            — Psalm 119:105
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background:'var(--teal)', color:'white',
            border:'none', borderRadius:99,
            padding:'11px 32px',
            fontSize:14, fontWeight:700,
            cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif",
            boxShadow:'0 4px 16px rgba(29,107,90,0.35)',
            width:'100%',
          }}
        >
          Praise the Lord! 🎉
        </button>
      </div>
    </div>
  )
}
