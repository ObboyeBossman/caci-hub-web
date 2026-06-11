import type { PageModule } from '../../../types/module.types'
import { getActiveAssemblyId } from '@core/auth'
import { navigate } from '@core/router'
import { renderSkeleton } from '@shared/utils/pageHelpers'
import { Toast } from '@shared/components/Toast'
import { AudioRecorder, uploadAudio } from '../utils/audio'
import { AudioService, CommunicationService } from '../services'

const CSS = /* css */`
.ab-page { padding: var(--space-xl) var(--space-2xl); max-width: 640px; margin: 0 auto; font-family: var(--font-sans); }
@media (max-width: 640px) { .ab-page { padding: var(--space-lg) var(--space-md); } }
.ab-header { margin-bottom: var(--space-xl); }
.ab-header h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
.ab-header p { font-size: var(--text-base); color: var(--text-secondary); margin-top: 4px; }
.ab-card { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-xl); margin-bottom: var(--space-lg); text-align: center; }
.ab-record-btn { width: 80px; height: 80px; border-radius: 50%; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; transition: all 0.2s; margin-bottom: var(--space-md); }
.ab-record-btn.idle { background: var(--caci-red); color: #fff; }
.ab-record-btn.idle:hover { transform: scale(1.05); box-shadow: 0 8px 24px rgba(198,0,38,0.3); }
.ab-record-btn.recording { background: var(--bg-hover); color: var(--caci-red); animation: abPulse 1.2s ease-in-out infinite; }
@keyframes abPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(198,0,38,0.4); } 50% { box-shadow: 0 0 0 16px rgba(198,0,38,0); } }
.ab-timer { font-size: 28px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
.ab-timer-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--space-lg); }
.ab-waveform { display: flex; align-items: center; gap: 2px; height: 60px; justify-content: center; margin-bottom: var(--space-lg); }
.ab-waveform-bar { flex: 1; border-radius: 2px; max-width: 4px; }
.ab-preview { background: var(--bg-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: var(--space-lg); }
.ab-preview-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-sm); }
.ab-actions { display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap; }
.ab-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0 16px; height: 36px; border-radius: var(--radius-md); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-default); background: var(--bg-page); color: var(--text-secondary); font-family: var(--font-sans); transition: all 0.18s; white-space: nowrap; }
.ab-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
.ab-btn-primary { background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-light)); border-color: transparent; color: #fff; font-weight: 600; box-shadow: 0 2px 10px rgba(0,75,160,0.3); }
.ab-btn-primary:hover { color: #fff; box-shadow: 0 6px 20px rgba(0,75,160,0.4); }
.ab-btn-danger { background: var(--caci-red); border-color: transparent; color: #fff; font-weight: 600; }
.ab-btn-danger:hover { color: #fff; background: #a5001e; }
.ab-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ab-field { margin-bottom: var(--space-md); text-align: left; }
.ab-field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 5px; }
.ab-field input, .ab-field select { width: 100%; background: var(--bg-page); border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 13px; font-family: var(--font-sans); color: var(--text-primary); outline: none; box-sizing: border-box; }
.ab-field input:focus, .ab-field select:focus { border-color: var(--caci-blue); box-shadow: 0 0 0 3px var(--focus-ring); }
`

function _injectCSS(): void {
  if (document.getElementById('ab-css')) return
  const s = document.createElement('style')
  s.id = 'ab-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

let _container: HTMLElement | null = null
let _recorder: AudioRecorder | null = null
let _recording = false
let _recordedBlob: Blob | null = null
let _durationSeconds = 0
let _waveformData: number[] = []
let _timerInterval: ReturnType<typeof setInterval> | null = null
let _destroyed = false

const AudioBroadcast: PageModule = {
  async render(container) {
    _container = container
    _destroyed = false
    renderSkeleton(container, 'form')
    _injectCSS()
    _renderIdle()
    _bindEvents()
  },

  destroy() {
    _destroyed = true
    if (_timerInterval) clearInterval(_timerInterval)
    _recorder = null
    _container = null
  },
}

export default AudioBroadcast

function _renderIdle(): void {
  if (!_container) return
  _container.innerHTML = `
<div class="ab-page">
  <div class="ab-header">
    <h2>Audio Broadcast</h2>
    <p>Record an audio message to broadcast to your assembly.</p>
  </div>
  <div class="ab-card">
    <button class="ab-record-btn idle" id="ab-recordBtn"><i class="bi bi-mic-fill"></i></button>
    <div style="font-size:13px;color:var(--text-secondary);">Tap to start recording</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Max 10 minutes</div>
  </div>
</div>`
}

function _renderRecording(): void {
  if (!_container) return
  _container.innerHTML = `
<div class="ab-page">
  <div class="ab-header">
    <h2>Audio Broadcast</h2>
    <p>Recording in progress…</p>
  </div>
  <div class="ab-card">
    <button class="ab-record-btn recording" id="ab-stopBtn"><i class="bi bi-stop-fill"></i></button>
    <div class="ab-timer" id="ab-timer">0:00</div>
    <div class="ab-timer-label">Recording</div>
    <div class="ab-waveform" id="ab-waveform">${'<div class="ab-waveform-bar" style="background:var(--caci-red);height:30%;"></div>'.repeat(40)}</div>
    <div class="ab-actions">
      <button class="ab-btn ab-btn-danger" id="ab-cancelBtn"><i class="bi bi-x-lg"></i> Cancel</button>
    </div>
  </div>
</div>`
}

function _renderPreview(): void {
  if (!_container) return
  const maxAmp = Math.max(..._waveformData, 1)
  _container.innerHTML = `
<div class="ab-page">
  <div class="ab-header">
    <h2>Audio Broadcast</h2>
    <p>Review your recording before broadcasting.</p>
  </div>
  <div class="ab-preview">
    <div class="ab-preview-title">Recording Preview</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--space-md);">
      <button class="ab-record-btn idle" id="ab-playBtn" style="width:44px;height:44px;font-size:20px;margin:0;">
        <i class="bi bi-play-fill"></i>
      </button>
      <div>
        <div style="font-size:16px;font-weight:600;color:var(--text-primary);">${_fmtDuration(_durationSeconds)}</div>
        <div style="font-size:11px;color:var(--text-muted);">Duration</div>
      </div>
    </div>
    <div class="ab-waveform" style="height:40px;">${_waveformData.map(a => {
      const h = Math.max(8, (a / maxAmp) * 100)
      return `<div class="ab-waveform-bar" style="background:var(--caci-blue);height:${h}%;"></div>`
    }).join('')}</div>
  </div>

  <div class="ab-card" style="text-align:left;">
    <div class="ab-field">
      <label for="ab-title">Broadcast Title *</label>
      <input type="text" id="ab-title" maxlength="120" placeholder="e.g. Sunday Message" autocomplete="off">
    </div>
    <div class="ab-field">
      <label for="ab-audience">Audience</label>
      <select id="ab-audience">
        <option value="assembly">Entire Assembly</option>
        <option value="group">Specific Group</option>
      </select>
    </div>
  </div>

  <div class="ab-actions">
    <button class="ab-btn" id="ab-rerecordBtn"><i class="bi bi-arrow-counterclockwise"></i> Re-record</button>
    <button class="ab-btn ab-btn-primary" id="ab-sendBtn"><i class="bi bi-send-fill"></i> Broadcast</button>
  </div>
</div>`
}

function _startRecording(): void {
  _recorder = new AudioRecorder()
  _recorder.start().then(() => {
    if (_destroyed) return
    _recording = true
    _renderRecording()
    let secs = 0
    _timerInterval = setInterval(() => {
      secs++
      const el = _container?.querySelector('#ab-timer')
      if (el) el.textContent = _fmtDuration(secs)
    }, 1000)
    _container?.querySelector('#ab-stopBtn')?.addEventListener('click', _stopRecording)
    _container?.querySelector('#ab-cancelBtn')?.addEventListener('click', _cancelRecording)
  }).catch(err => {
    Toast.error('Could not start recording: ' + err.message)
  })
}

async function _stopRecording(): Promise<void> {
  if (!_recorder) return
  if (_timerInterval) clearInterval(_timerInterval)
  try {
    const result = await _recorder.stop()
    if (_destroyed) return
    _recordedBlob = result.blob
    _durationSeconds = result.durationSeconds
    _waveformData = result.waveformData
    _recorder = null
    _recording = false
    _renderPreview()
    _container?.querySelector('#ab-playBtn')?.addEventListener('click', _playRecording)
    _container?.querySelector('#ab-rerecordBtn')?.addEventListener('click', _reset)
    _container?.querySelector('#ab-sendBtn')?.addEventListener('click', _sendBroadcast)
  } catch (err: any) {
    Toast.error('Failed to stop recording: ' + err.message)
  }
}

function _cancelRecording(): void {
  if (_timerInterval) clearInterval(_timerInterval)
  if (_recorder) {
    _recorder.stop().catch(() => {})
    _recorder = null
  }
  _recording = false
  _renderIdle()
}

function _playRecording(): void {
  if (!_recordedBlob) return
  const url = URL.createObjectURL(_recordedBlob)
  const audio = new Audio(url)
  audio.play()
  audio.onended = () => URL.revokeObjectURL(url)
}

async function _sendBroadcast(): Promise<void> {
  if (!_recordedBlob) return
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) { Toast.error('No assembly selected'); return }

  const titleInput = _container?.querySelector<HTMLInputElement>('#ab-title')
  const title = titleInput?.value.trim()
  if (!title) { Toast.error('Please enter a broadcast title'); titleInput?.focus(); return }

  const sendBtn = _container?.querySelector<HTMLButtonElement>('#ab-sendBtn')
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Uploading…' }

  try {
    const uploadResult = await uploadAudio({
      blob: _recordedBlob,
      durationSeconds: _durationSeconds,
      mimeType: _recordedBlob.type || 'audio/webm;codecs=opus',
      waveformData: _waveformData,
      assemblyId,
      isPublicBroadcast: true,
    })

    if (!uploadResult.success) {
      Toast.error(uploadResult.error)
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="bi bi-send-fill"></i> Broadcast' }
      return
    }

    await CommunicationService.createCampaign({
      assembly_id: assemblyId,
      title,
      body: null,
      channel: 'audio',
      audience_type: 'assembly',
      status: 'sent',
      total_recipients: 0,
      created_by: '',
    })

    Toast.success('Audio broadcast sent!')
    _reset()
    navigate('/communications/campaigns')
  } catch (err: any) {
    Toast.fromError(err)
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="bi bi-send-fill"></i> Broadcast' }
  }
}

function _reset(): void {
  _recordedBlob = null
  _durationSeconds = 0
  _waveformData = []
  _recorder = null
  _recording = false
  _renderIdle()
}

function _bindEvents(): void {
  if (!_container) return
  _container.querySelector('#ab-recordBtn')?.addEventListener('click', _startRecording)
}

function _fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
