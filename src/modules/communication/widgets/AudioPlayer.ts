import { fetchAudioAttachmentUrl } from '../hooks/fetchAudioAttachmentUrl'

export class AudioPlayerElement extends HTMLElement {
  private attachmentId: string = ''
  private durationSeconds: number = 0
  private waveformData: number[] = []
  private senderName: string = ''

  private url: string | null = null
  private loading: boolean = true
  private error: string | null = null
  private playing: boolean = false
  private progress: number = 0

  private audioElement: HTMLAudioElement | null = null
  private playButton: HTMLButtonElement | null = null
  private progressContainer: HTMLDivElement | null = null

  static get observedAttributes() {
    return ['attachment-id', 'duration-seconds', 'waveform-data', 'sender-name']
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'attachment-id') this.attachmentId = newValue
    if (name === 'duration-seconds') this.durationSeconds = parseInt(newValue, 10)
    if (name === 'waveform-data') {
      try {
        this.waveformData = JSON.parse(newValue)
      } catch (e) {
        this.waveformData = [] // fallback
      }
    }
    if (name === 'sender-name') this.senderName = newValue
  }

  async connectedCallback() {
    // Initial render before loading
    this.render()
    await this.initAudio()
  }

  private async initAudio() {
    try {
      this.loading = true
      this.renderPlayState()
      if (this.attachmentId) {
        this.url = await fetchAudioAttachmentUrl(this.attachmentId)
        
        if (this.url && !this.audioElement) {
          this.audioElement = document.createElement('audio')
          this.audioElement.src = this.url
          this.audioElement.crossOrigin = 'anonymous'
          this.audioElement.addEventListener('timeupdate', this.onTimeUpdate)
          this.audioElement.addEventListener('ended', this.onEnded)
          this.append(this.audioElement)
        }
      }
    } catch (err: any) {
      this.error = err.message
      this.render()
    } finally {
      this.loading = false
      this.renderPlayState()
    }
  }

  private togglePlay = () => {
    if (!this.audioElement || !this.url) return

    if (this.playing) {
      this.audioElement.pause()
      this.playing = false
    } else {
      this.audioElement.play()
      this.playing = true
    }
    this.renderPlayState()
  }

  private onTimeUpdate = () => {
    if (!this.audioElement) return
    this.progress = this.audioElement.currentTime / (this.audioElement.duration || 1)
    this.renderWaveformProgress()
  }

  private onEnded = () => {
    this.playing = false
    this.progress = 0
    this.renderPlayState()
    this.renderWaveformProgress()
  }

  private formatDuration(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  private render() {
    if (this.error) {
      this.innerHTML = `<div class="text-red-500 text-sm">${this.error}</div>`
      return
    }

    const BAR_COUNT = 40
    const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
      if (!this.waveformData || this.waveformData.length === 0) return 1
      const idx = Math.floor((i * this.waveformData.length) / BAR_COUNT)
      return this.waveformData[idx] ?? 0
    })
    const maxAmplitude = Math.max(...bars, 1)

    this.innerHTML = `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <button
          class="play-btn flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full disabled:bg-gray-300"
        >
          ...
        </button>

        <div class="waveform-container flex-grow flex items-center gap-1 h-8">
          ${bars.map((amplitude, i) => {
            const heightPct = Math.max(0.15, amplitude / maxAmplitude)
            return `<div class="bar flex-grow bg-gray-300" style="height: ${heightPct * 100}%" data-idx="${i}"></div>`
          }).join('')}
        </div>

        <div class="text-xs text-gray-600 flex-shrink-0 w-12 text-right">
          ${this.formatDuration(this.durationSeconds)}
        </div>
      </div>
    `

    this.playButton = this.querySelector('.play-btn')
    this.playButton?.addEventListener('click', this.togglePlay)
    this.progressContainer = this.querySelector('.waveform-container')

    this.renderPlayState()
    this.renderWaveformProgress()
  }

  private renderPlayState() {
    if (this.playButton) {
      if (this.loading || !this.url) {
        this.playButton.textContent = '...'
        this.playButton.disabled = true
      } else {
        this.playButton.disabled = false
        this.playButton.textContent = this.playing ? '⏸' : '▶'
      }
    }
  }

  private renderWaveformProgress() {
    if (!this.progressContainer) return
    const bars = this.progressContainer.querySelectorAll('.bar')
    const BAR_COUNT = bars.length
    bars.forEach((bar, i) => {
      const isPlayed = i / BAR_COUNT <= this.progress
      if (isPlayed) {
        bar.classList.replace('bg-gray-300', 'bg-blue-500')
      } else {
        bar.classList.replace('bg-blue-500', 'bg-gray-300')
      }
    })
  }

  disconnectedCallback() {
      if (this.playButton) {
          this.playButton.removeEventListener('click', this.togglePlay)
      }
  }
}

if (!customElements.get('audio-player')) {
  customElements.define('audio-player', AudioPlayerElement)
}
