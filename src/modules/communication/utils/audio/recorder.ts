export type RecordingResult = {
  blob: Blob
  durationSeconds: number
  mimeType: string
  waveformData: number[]
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []
  private analyser: AnalyserNode | null = null
  private waveformSamples: number[] = []
  private startTime = 0

  static bestMimeType(): string {
    const candidates = [
      'audio/ogg;codecs=opus',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg'
    ]
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)

    this.chunks = []
    this.waveformSamples = []
    this.startTime = Date.now()

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: AudioRecorder.bestMimeType(),
      audioBitsPerSecond: 32000
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    const sampleInterval = setInterval(() => {
      if (!this.analyser) return
      const data = new Uint8Array(this.analyser.frequencyBinCount)
      this.analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      this.waveformSamples.push(Math.round(avg))
    }, 100)

    this.mediaRecorder.onstop = () => clearInterval(sampleInterval)
    this.mediaRecorder.start(100)
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Not recording'))

      this.mediaRecorder.onstop = () => {
        const mimeType = AudioRecorder.bestMimeType()
        const blob = new Blob(this.chunks, { type: mimeType })
        const durationSeconds = Math.round((Date.now() - this.startTime) / 1000)
        const waveformData = downsample(this.waveformSamples, 100)

        this.mediaRecorder?.stream.getTracks().forEach(t => t.stop())

        resolve({ blob, durationSeconds, mimeType, waveformData })
      }
      this.mediaRecorder.stop()
    })
  }
}

function downsample(samples: number[], target: number): number[] {
  if (samples.length <= target) return samples
  const ratio = samples.length / target
  return Array.from({ length: target }, (_, i) => {
    const start = Math.floor(i * ratio)
    const end = Math.floor((i + 1) * ratio)
    const slice = samples.slice(start, end)
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length)
  })
}
