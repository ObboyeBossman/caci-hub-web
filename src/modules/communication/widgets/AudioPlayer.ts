// src/modules/communication/widgets/AudioPlayer.ts
// Web Component: <audio-player>
// Attributes:
//   attachment-id       – UUID of the communication_attachments row
//   duration-seconds    – total duration (used for initial display before metadata loads)
//   waveform-data       – JSON-encoded number[] of normalised amplitude values (0-1)
//
// The component fetches a short-lived signed URL from Supabase storage via the
// communication_attachments table (storage_bucket + storage_path columns), then
// renders an inline waveform player without depending on any external libraries.

import { supabase } from '@core/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Styles (injected once) ────────────────────────────────────────────────────

const STYLE_ID = 'audio-player-css'

function _injectCSS(): void {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = /* css */`
audio-player {
  display: block;
  --ap-height: 52px;
  --ap-bar-gap: 2px;
  --ap-radius: 12px;
  --ap-accent: var(--caci-red, #c60026);
  --ap-track: var(--border-default, rgba(255,255,255,0.12));
  --ap-bg: var(--bg-page, #0f1117);
}
.ap-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--ap-bg);
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  border-radius: var(--ap-radius);
  padding: 10px 14px;
  min-height: var(--ap-height);
  box-sizing: border-box;
  user-select: none;
}
.ap-btn {
  flex-shrink: 0;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: var(--ap-accent);
  color: #fff;
  font-size: 14px;
  transition: transform 0.15s, opacity 0.15s;
  padding: 0;
  line-height: 1;
}
.ap-btn:hover { opacity: 0.85; transform: scale(1.05); }
.ap-btn:active { transform: scale(0.95); }
.ap-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.ap-waveform {
  flex: 1;
  height: 36px;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}
.ap-waveform canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.ap-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted, rgba(255,255,255,0.4));
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
  font-family: var(--font-sans, system-ui);
}
.ap-loading {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.4));
  font-family: var(--font-sans, system-ui);
  padding: 12px 14px;
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  border-radius: var(--ap-radius);
  background: var(--ap-bg);
}
.ap-loading-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ap-accent);
  animation: apPulse 1.2s ease-in-out infinite;
}
.ap-loading-dot:nth-child(2) { animation-delay: 0.2s; }
.ap-loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes apPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
.ap-error {
  font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.4));
  font-family: var(--font-sans, system-ui);
  padding: 10px 14px;
  border: 1px solid var(--border-default, rgba(255,255,255,0.1));
  border-radius: var(--ap-radius);
  background: var(--ap-bg);
  display: flex; align-items: center; gap: 6px;
}
`
  document.head.appendChild(s)
}

// ── Web Component ─────────────────────────────────────────────────────────────

class AudioPlayerElement extends HTMLElement {
  private _audio: HTMLAudioElement | null = null
  private _canvas: HTMLCanvasElement | null = null
  private _waveform: number[] = []
  private _raf: number = 0
  private _duration: number = 0

  static get observedAttributes() {
    return ['attachment-id', 'duration-seconds', 'waveform-data']
  }

  connectedCallback() {
    _injectCSS()
    this._render()
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf)
    this._audio?.pause()
    this._audio = null
  }

  private _render() {
    const attachmentId = this.getAttribute('attachment-id') ?? ''
    this._duration = parseFloat(this.getAttribute('duration-seconds') ?? '0')

    try {
      const raw = this.getAttribute('waveform-data') ?? '[]'
      this._waveform = JSON.parse(raw)
    } catch {
      this._waveform = []
    }

    if (!attachmentId) {
      this.innerHTML = `<div class="ap-error"><i class="bi bi-exclamation-circle"></i> No attachment ID</div>`
      return
    }

    this._renderLoading()
    this._loadAudio(attachmentId)
  }

  private _renderLoading() {
    this.innerHTML = `
      <div class="ap-loading">
        <div class="ap-loading-dot"></div>
        <div class="ap-loading-dot"></div>
        <div class="ap-loading-dot"></div>
        <span>Loading audio…</span>
      </div>
    `
  }

  private async _loadAudio(attachmentId: string) {
    try {
      // Fetch the storage_bucket and storage_path for this attachment
      const { data: att, error } = await (supabase as any)
        .from('communication_attachments')
        .select('storage_bucket, storage_path, duration_seconds, waveform_data')
        .eq('id', attachmentId)
        .maybeSingle()

      if (error) throw error
      if (!att?.storage_path) throw new Error('Attachment record not found')

      // Use actual duration/waveform if available from DB
      if (att.duration_seconds) this._duration = att.duration_seconds
      if (att.waveform_data?.length) this._waveform = att.waveform_data

      const bucket: string = att.storage_bucket ?? 'audio-broadcasts'

      // Create a 1-hour signed URL
      const { data: signed, error: signErr } = await (supabase as any)
        .storage
        .from(bucket)
        .createSignedUrl(att.storage_path, 3600)

      if (signErr) throw signErr

      this._renderPlayer(signed.signedUrl)
    } catch (err) {
      console.error('[AudioPlayer] load error:', err)
      this.innerHTML = `
        <div class="ap-error">
          <i class="bi bi-exclamation-circle"></i>
          Audio unavailable
        </div>
      `
    }
  }

  private _renderPlayer(src: string) {
    // Build DOM
    this.innerHTML = `
      <div class="ap-wrap">
        <button class="ap-btn" id="ap-play-btn" aria-label="Play">
          <i class="bi bi-play-fill"></i>
        </button>
        <div class="ap-waveform" id="ap-waveform">
          <canvas id="ap-canvas"></canvas>
        </div>
        <span class="ap-time" id="ap-time">${_fmtTime(this._duration)}</span>
      </div>
    `

    this._canvas = this.querySelector<HTMLCanvasElement>('#ap-canvas')!
    const btn = this.querySelector<HTMLButtonElement>('#ap-play-btn')!
    const timeEl = this.querySelector<HTMLSpanElement>('#ap-time')!
    const waveformEl = this.querySelector<HTMLElement>('#ap-waveform')!

    // Create Audio
    this._audio = new Audio(src)
    this._audio.preload = 'metadata'

    // Initial waveform draw
    this._drawWaveform(0)

    // Resize observer to redraw on layout changes
    const ro = new ResizeObserver(() => {
      const progress = this._audio
        ? this._audio.currentTime / (this._audio.duration || this._duration || 1)
        : 0
      this._drawWaveform(Math.min(Math.max(progress, 0), 1))
    })
    ro.observe(waveformEl)

    // Play / Pause
    btn.addEventListener('click', () => {
      if (!this._audio) return
      if (this._audio.paused) {
        this._audio.play().catch(() => {})
      } else {
        this._audio.pause()
      }
    })

    this._audio.addEventListener('play', () => {
      btn.innerHTML = '<i class="bi bi-pause-fill"></i>'
      this._startRAF(timeEl)
    })

    this._audio.addEventListener('pause', () => {
      btn.innerHTML = '<i class="bi bi-play-fill"></i>'
      cancelAnimationFrame(this._raf)
    })

    this._audio.addEventListener('ended', () => {
      btn.innerHTML = '<i class="bi bi-play-fill"></i>'
      cancelAnimationFrame(this._raf)
      timeEl.textContent = _fmtTime(this._duration || this._audio?.duration || 0)
      this._drawWaveform(0)
    })

    this._audio.addEventListener('loadedmetadata', () => {
      if (this._audio?.duration) {
        this._duration = this._audio.duration
        timeEl.textContent = _fmtTime(this._duration)
      }
    })

    // Scrub on click
    waveformEl.addEventListener('click', (e: MouseEvent) => {
      if (!this._audio) return
      const rect = waveformEl.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      const dur = this._audio.duration || this._duration
      if (isFinite(dur) && dur > 0) {
        this._audio.currentTime = pct * dur
        this._drawWaveform(pct)
        timeEl.textContent = _fmtTime(this._audio.currentTime)
      }
    })
  }

  private _startRAF(timeEl: HTMLSpanElement) {
    const tick = () => {
      if (!this._audio) return
      const dur = this._audio.duration || this._duration || 1
      const pct = this._audio.currentTime / dur
      this._drawWaveform(Math.min(Math.max(pct, 0), 1))
      timeEl.textContent = _fmtTime(this._audio.currentTime)
      if (!this._audio.paused && !this._audio.ended) {
        this._raf = requestAnimationFrame(tick)
      }
    }
    cancelAnimationFrame(this._raf)
    this._raf = requestAnimationFrame(tick)
  }

  private _drawWaveform(progress: number) {
    const canvas = this._canvas
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const dpr = window.devicePixelRatio || 1
    const W = parent.clientWidth
    const H = parent.clientHeight

    if (W === 0 || H === 0) return

    canvas.width  = W * dpr
    canvas.height = H * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const bars = this._waveform.length > 0 ? this._waveform : _defaultWaveform(60)
    const count = bars.length
    const gap = 2
    const barW = Math.max(1, (W - gap * (count - 1)) / count)
    const cx = W * progress // progress x cutoff

    for (let i = 0; i < count; i++) {
      const x = i * (barW + gap)
      const barH = Math.max(3, bars[i] * H * 0.9)
      const y = (H - barH) / 2

      ctx.fillStyle = (x + barW) <= cx
        ? `var(--ap-accent, #c60026)`   // played
        : `var(--ap-track, rgba(255,255,255,0.15))`  // unplayed

      // Round rect
      const r = Math.min(barW / 2, 2)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + barH - r)
      ctx.quadraticCurveTo(x + barW, y + barH, x + barW - r, y + barH)
      ctx.lineTo(x + r, y + barH)
      ctx.quadraticCurveTo(x, y + barH, x, y + barH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
    }
  }
}

// CSS custom property colors don't work in canvas fillStyle, so we resolve them
// from the DOM after paint. Patch drawWaveform to resolve computed colors:
function _resolveColor(varName: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName.replace(/var\((.+?)\)/, '$1').split(',')[0].trim()).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

// Monkey-patch the prototype to resolve CSS vars on each draw
const _origDraw = AudioPlayerElement.prototype['_drawWaveform' as keyof AudioPlayerElement] as Function
Object.defineProperty(AudioPlayerElement.prototype, '_drawWaveform', {
  value: function(this: AudioPlayerElement, progress: number) {
    const canvas = (this as any)._canvas as HTMLCanvasElement | null
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const dpr = window.devicePixelRatio || 1
    const W = parent.clientWidth
    const H = parent.clientHeight

    if (W === 0 || H === 0) return

    canvas.width  = W * dpr
    canvas.height = H * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)

    const bars: number[] = (this as any)._waveform?.length > 0
      ? (this as any)._waveform
      : _defaultWaveform(60)
    const count = bars.length
    const gap = 2
    const barW = Math.max(1, (W - gap * (count - 1)) / count)
    const cx = W * progress

    const playedColor  = _resolveColor('--caci-red', '#c60026')
    const unplayedColor = _resolveColor('--border-default', 'rgba(255,255,255,0.15)')

    for (let i = 0; i < count; i++) {
      const x = i * (barW + gap)
      const barH = Math.max(3, bars[i] * H * 0.88)
      const y = (H - barH) / 2

      ctx.fillStyle = (x + barW) <= cx ? playedColor : unplayedColor

      const r = Math.min(barW / 2, 2)
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + barH - r)
      ctx.quadraticCurveTo(x + barW, y + barH, x + barW - r, y + barH)
      ctx.lineTo(x + r, y + barH)
      ctx.quadraticCurveTo(x, y + barH, x, y + barH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
    }
  }
})

function _defaultWaveform(bars: number): number[] {
  // Generate a natural-looking pseudo-random waveform when none is provided
  const out: number[] = []
  let v = 0.5
  for (let i = 0; i < bars; i++) {
    v += (Math.random() - 0.5) * 0.3
    v = Math.min(0.95, Math.max(0.15, v))
    out.push(v)
  }
  return out
}

// ── Register ──────────────────────────────────────────────────────────────────

if (!customElements.get('audio-player')) {
  customElements.define('audio-player', AudioPlayerElement)
}
