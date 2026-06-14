// src/modules/communication/tabs/AudioBroadcastTab.ts
// Pastor-only audio recording and broadcast tab.
// Permission-gated at shell level (permission = 'communications.audio.broadcast').

import type { WorkspaceTab } from '../workspace/CommunicationWorkspaceShell'
import { getActiveAssemblyId } from '@core/auth'
import { showToast } from '../widgets/communicationWidgets'
import { checkCanBroadcastAudio } from '../hooks'
import { AudioRecorder } from '../utils/audio/recorder'
import { validateAudioUpload } from '../utils/audio/validation'
import { uploadAudio } from '../utils/audio/upload'
import { CommunicationService } from '../services/communication.service'
import { emit } from '@core/events'

// ─── CSS ─────────────────────────────────────────────────────────────────────

const AUDIO_CSS = /* css */`
.abt-wrap {
  max-width: 600px; margin: 0 auto;
  display: flex; flex-direction: column; gap: var(--space-lg);
}
.abt-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-xl);
  text-align: center;
}
.abt-record-btn {
  width: 80px; height: 80px; border-radius: 50%; border: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; font-size: 32px;
  transition: all 0.22s cubic-bezier(0.16,1,0.3,1); margin-bottom: var(--space-md);
}
.abt-record-btn.idle {
  background: var(--caci-red); color: #fff;
  box-shadow: 0 4px 20px rgba(198,0,38,0.35);
}
.abt-record-btn.idle:hover {
  transform: scale(1.06); box-shadow: 0 8px 28px rgba(198,0,38,0.45);
}
.abt-record-btn.recording {
  background: rgba(198,0,38,0.08); color: var(--caci-red);
  border: 2px solid rgba(198,0,38,0.3);
  animation: abtPulse 1.4s ease-in-out infinite;
}
@keyframes abtPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(198,0,38,0.35); }
  50%     { box-shadow: 0 0 0 18px rgba(198,0,38,0); }
}
.abt-timer {
  font-size: 38px; font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  margin-bottom: 4px;
}
.abt-timer-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-muted); margin-bottom: var(--space-lg);
}
.abt-timer-label.recording { color: var(--caci-red); }
.abt-waveform {
  display: flex; align-items: center; gap: 2px; height: 60px;
  justify-content: center; margin-bottom: var(--space-lg);
}
.abt-bar {
  flex: 1; max-width: 4px; min-width: 2px; border-radius: 2px;
  transition: height 0.08s ease;
}
.abt-hint {
  font-size: 12px; color: var(--text-muted); margin-top: 4px;
}
/* Form card */
.abt-form-card {
  background: var(--bg-card); border: 1px solid var(--border-default);
  border-radius: var(--radius-lg); padding: var(--space-lg);
  display: flex; flex-direction: column; gap: var(--space-md);
}
.abt-actions {
  display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;
  margin-top: var(--space-sm);
}
/* Permission denied */
.abt-denied {
  background: rgba(198,0,38,0.04); border: 1px solid rgba(198,0,38,0.15);
  border-radius: var(--radius-lg); padding: var(--space-2xl);
  text-align: center; max-width: 480px; margin: 0 auto;
}
`

let _abtCSSInjected = false
function _injectCSS(): void {
  if (_abtCSSInjected) return; _abtCSSInjected = true
  const s = document.createElement('style'); s.id = 'abt-tab-css'; s.textContent = AUDIO_CSS
  document.head.appendChild(s)
}

type RecordingState = 'idle' | 'recording' | 'preview' | 'sending'

// ─── Tab ─────────────────────────────────────────────────────────────────────

export class AudioBroadcastTab implements WorkspaceTab {
  readonly id = 'audio'
  readonly label = 'Audio Broadcast'
  readonly icon = 'mic-fill'
  readonly permission = 'communications.audio.broadcast'

  private _container: HTMLElement | null = null
  private _state: RecordingState = 'idle'
  private _recorder: AudioRecorder | null = null
  private _recordedBlob: Blob | null = null
  private _durationSecs: number = 0
  private _waveformData: number[] = []
  private _timerSecs: number = 0
  private _timerIntvl: ReturnType<typeof setInterval> | null = null
  private _animFrame: number = 0
  private _destroyed = false

  async render(container: HTMLElement): Promise<void> {
    _injectCSS()
    this._container = container
    this._destroyed = false
    this._state = 'idle'

    // Check permission server-side (belt-and-suspenders)
    container.innerHTML = `<div style="padding:40px;text-align:center;"><span class="cw-spinner"></span></div>`

    const allowed = await checkCanBroadcastAudio()
    if (this._destroyed) return

    if (!allowed) {
      container.innerHTML = `
        <div class="abt-denied">
          <i class="bi bi-mic-mute" style="font-size:3rem;color:var(--caci-red);display:block;margin-bottom:var(--space-md);"></i>
          <h3 style="font-size:18px;font-weight:700;color:var(--text-primary);margin:0 0 8px;">Permission Required</h3>
          <p style="font-size:13px;color:var(--text-secondary);margin:0;">
            The <strong>Audio Broadcast</strong> permission is required to record and broadcast audio messages.
            Contact your administrator to request access.
          </p>
        </div>`
      return
    }

    this._renderIdle()
  }

  // ── State renderers ────────────────────────────────────────────────────────

  private _renderIdle(): void {
    if (!this._container) return
    this._state = 'idle'
    this._container.innerHTML = `
      <div class="abt-wrap">
        <div class="abt-card">
          <button class="abt-record-btn idle" id="abt-start">
            <i class="bi bi-mic-fill"></i>
          </button>
          <div class="abt-timer">0:00</div>
          <div class="abt-timer-label">Ready to Record</div>
          <div class="abt-waveform" id="abt-wave">
            ${Array.from({ length: 40 }, (_, i) => {
      const h = 15 + Math.sin(i * 0.7) * 10
      return `<div class="abt-bar" style="height:${h}%;background:var(--border-default);"></div>`
    }).join('')}
          </div>
          <div class="abt-hint">Tap to start recording · Max 10 minutes · Mono 16kHz</div>
        </div>
        <div class="abt-form-card" style="opacity:0.4;pointer-events:none;">
          <p style="font-size:13px;color:var(--text-muted);text-align:center;margin:0;">
            Record a message to configure broadcast options.
          </p>
        </div>
      </div>`
    this._container.querySelector('#abt-start')?.addEventListener('click', () => this._startRecording())
  }

  private _renderRecording(): void {
    if (!this._container) return
    this._state = 'recording'
    this._container.innerHTML = `
      <div class="abt-wrap">
        <div class="abt-card">
          <button class="abt-record-btn recording" id="abt-stop">
            <i class="bi bi-stop-fill"></i>
          </button>
          <div class="abt-timer" id="abt-timer">0:00</div>
          <div class="abt-timer-label recording">● Recording</div>
          <div class="abt-waveform" id="abt-wave">
            ${Array.from({ length: 40 }, () =>
      `<div class="abt-bar" style="height:20%;background:var(--caci-red);opacity:0.7;"></div>`).join('')}
          </div>
          <div class="abt-actions">
            <button class="cw-tbtn cw-tbtn-danger" id="abt-cancel">
              <i class="bi bi-x-lg"></i>&nbsp;Cancel
            </button>
          </div>
        </div>
      </div>`
    this._container.querySelector('#abt-stop')?.addEventListener('click', () => this._stopRecording())
    this._container.querySelector('#abt-cancel')?.addEventListener('click', () => this._cancelRecording())
    this._animateWaveform()
  }

  private _renderPreview(): void {
    if (!this._container) return
    this._state = 'preview'

    const maxAmp = Math.max(...this._waveformData, 1)
    this._container.innerHTML = `
      <div class="abt-wrap">
        <!-- Playback preview -->
        <div class="abt-card">
          <div style="display:flex;align-items:center;gap:var(--space-lg);margin-bottom:var(--space-lg);justify-content:center;">
            <button class="abt-record-btn idle" id="abt-play"
              style="width:56px;height:56px;font-size:22px;margin:0;">
              <i class="bi bi-play-fill" id="abt-play-icon"></i>
            </button>
            <div style="text-align:left;">
              <div style="font-size:22px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums;">
                ${this._fmtDuration(this._durationSecs)}
              </div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;">Duration</div>
            </div>
          </div>
          <div class="abt-waveform">
            ${this._waveformData.map(a => {
      const h = Math.max(10, (a / maxAmp) * 100)
      return `<div class="abt-bar" style="height:${h}%;background:var(--caci-blue);"></div>`
    }).join('')}
          </div>
        </div>

        <!-- Broadcast config -->
        <div class="abt-form-card">
          <div class="cw-form-group">
            <label class="cw-form-label">Broadcast Title *</label>
            <input type="text" class="cw-form-inp" id="abt-title"
              placeholder="e.g. Sunday Message from Pastor" maxlength="120" autocomplete="off">
            <span class="cw-form-error" id="abt-title-err">Title is required</span>
          </div>
          <div class="cw-form-group">
            <label class="cw-form-label">Audience</label>
            <select class="cw-form-inp" id="abt-audience" style="cursor:pointer;">
              <option value="assembly">Entire Assembly</option>
              <option value="group">Specific Group</option>
            </select>
          </div>
          <div class="abt-actions">
            <button class="cw-tbtn" id="abt-rerecord">
              <i class="bi bi-arrow-counterclockwise"></i>&nbsp;Re-record
            </button>
            <button class="cw-tbtn cw-tbtn-primary" id="abt-broadcast" style="min-width:140px;">
              <i class="bi bi-broadcast"></i>&nbsp;Broadcast
            </button>
          </div>
        </div>
      </div>`

    // Play/pause preview
    let audioEl: HTMLAudioElement | null = null
    let playing = false
    this._container.querySelector('#abt-play')?.addEventListener('click', () => {
      if (!this._recordedBlob) return
      if (!audioEl) {
        audioEl = new Audio(URL.createObjectURL(this._recordedBlob))
        audioEl.onended = () => {
          playing = false
          const icon = this._container?.querySelector<HTMLElement>('#abt-play-icon')
          if (icon) icon.className = 'bi bi-play-fill'
        }
      }
      if (playing) {
        audioEl.pause(); playing = false
        const icon = this._container?.querySelector<HTMLElement>('#abt-play-icon')
        if (icon) icon.className = 'bi bi-play-fill'
      } else {
        audioEl.play(); playing = true
        const icon = this._container?.querySelector<HTMLElement>('#abt-play-icon')
        if (icon) icon.className = 'bi bi-pause-fill'
      }
    })

    this._container.querySelector('#abt-rerecord')?.addEventListener('click', () => {
      audioEl?.pause(); audioEl = null
      this._recordedBlob = null
      this._durationSecs = 0
      this._waveformData = []
      this._renderIdle()
    })

    this._container.querySelector('#abt-broadcast')?.addEventListener('click', () => {
      this._sendBroadcast()
    })
  }

  private _renderSending(): void {
    if (!this._container) return
    this._state = 'sending'
    this._container.innerHTML = `
      <div class="abt-wrap">
        <div class="abt-card">
          <div style="margin-bottom:var(--space-lg);">
            <span class="cw-spinner" style="width:48px;height:48px;border-width:4px;"></span>
          </div>
          <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Broadcasting…</div>
          <div style="font-size:13px;color:var(--text-secondary);">Uploading and sending to recipients. Please wait.</div>
        </div>
      </div>`
  }

  // ── Recording logic ────────────────────────────────────────────────────────

  private async _startRecording(): Promise<void> {
    this._recorder = new AudioRecorder()
    this._timerSecs = 0
    try {
      await this._recorder.start()
    } catch (err: any) {
      showToast('Could not access microphone: ' + (err?.message ?? 'Permission denied'), 'danger')
      this._recorder = null
      return
    }

    if (this._destroyed) { this._recorder?.stop().catch(() => { }); return }

    this._renderRecording()

    this._timerIntvl = setInterval(() => {
      this._timerSecs++
      const el = this._container?.querySelector<HTMLElement>('#abt-timer')
      if (el) el.textContent = this._fmtDuration(this._timerSecs)

      // Auto-stop at 10 minutes
      if (this._timerSecs >= 600) this._stopRecording()
    }, 1000)
  }

  private async _stopRecording(): Promise<void> {
    this._clearTimer()
    if (!this._recorder) return
    try {
      const result = await this._recorder.stop()
      this._recorder = null
      this._recordedBlob = result.blob
      this._durationSecs = result.durationSeconds
      this._waveformData = result.waveformData

      if (this._destroyed) return

      const validation = validateAudioUpload(this._recordedBlob, this._durationSecs)
      if (!validation.valid) {
        showToast(validation.reason, 'warning')
        this._renderIdle()
        return
      }
      this._renderPreview()
    } catch (err: any) {
      showToast('Failed to stop recording: ' + (err?.message ?? ''), 'danger')
      this._recorder = null
      this._renderIdle()
    }
  }

  private _cancelRecording(): void {
    this._clearTimer()
    cancelAnimationFrame(this._animFrame)
    if (this._recorder) { this._recorder.stop().catch(() => { }); this._recorder = null }
    this._renderIdle()
  }

  private async _sendBroadcast(): Promise<void> {
    const title = this._container?.querySelector<HTMLInputElement>('#abt-title')?.value.trim()
    const audience = this._container?.querySelector<HTMLSelectElement>('#abt-audience')?.value ?? 'assembly'

    if (!title) {
      this._container?.querySelector('#abt-title-err')?.classList.add('show')
      this._container?.querySelector<HTMLInputElement>('#abt-title')?.focus()
      return
    }
    if (!this._recordedBlob) { showToast('No recording found', 'danger'); return }

    const assemblyId = getActiveAssemblyId()
    if (!assemblyId) { showToast('No assembly selected', 'danger'); return }

    this._renderSending()

    try {
      // 1. Create campaign as draft first to get an ID for the attachment
      const campaign = await CommunicationService.createCampaign({
        assembly_id:      assemblyId,
        title,
        channel:          'audio' as any,
        audience_type:    audience as any,
        audience_ids:     [],
        trigger_type:     'manual',
        status:           'draft',
        total_recipients: 0,
      } as any)

      // 2. Upload audio and link the attachment to the campaign
      const result = await uploadAudio({
        blob: this._recordedBlob,
        durationSeconds: this._durationSecs,
        mimeType: this._recordedBlob.type || 'audio/webm;codecs=opus',
        waveformData: this._waveformData,
        assemblyId,
        campaignId: campaign.id,
        isPublicBroadcast: true,
      })

      if (!result.success) {
        // Clean up the orphan draft campaign if upload fails
        await CommunicationService.deleteCampaign(campaign.id).catch(() => {})
        throw new Error(result.error)
      }

      // 3. Mark campaign as sent
      await CommunicationService.updateCampaign(campaign.id, { status: 'sent' })

      if (this._destroyed) return
      showToast('Audio broadcast sent successfully!', 'success')
      emit('communication:campaign_mutated')

      // Reset to idle
      this._recordedBlob = null
      this._durationSecs = 0
      this._waveformData = []
      this._renderIdle()

    } catch (err: any) {
      showToast(err?.message ?? 'Broadcast failed. Please try again.', 'danger')
      if (!this._destroyed) this._renderPreview()
    }
  }

  // ── Waveform animation during recording ──────────────────────────────────

  private _animateWaveform(): void {
    const animate = () => {
      if (this._state !== 'recording' || this._destroyed) return
      const bars = this._container?.querySelectorAll<HTMLElement>('#abt-wave .abt-bar')
      if (bars) {
        const t = Date.now() / 200
        bars.forEach((bar, i) => {
          const h = 15 + Math.sin(t + i * 0.4) * 35 + Math.random() * 20
          bar.style.height = `${Math.max(8, Math.min(100, h))}%`
        })
      }
      this._animFrame = requestAnimationFrame(animate)
    }
    this._animFrame = requestAnimationFrame(animate)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _clearTimer(): void {
    if (this._timerIntvl) { clearInterval(this._timerIntvl); this._timerIntvl = null }
  }

  private _fmtDuration(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  destroy(): void {
    this._destroyed = true
    this._clearTimer()
    cancelAnimationFrame(this._animFrame)
    if (this._recorder) { this._recorder.stop().catch(() => { }); this._recorder = null }
    this._container = null
  }
}