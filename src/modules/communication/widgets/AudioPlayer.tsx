import { useRef, useState, useEffect } from 'react'
import { useAudioAttachment } from '../hooks/useAudioAttachment'

type Props = {
  attachmentId: string
  durationSeconds: number
  waveformData: number[]
  senderName: string
}

export function AudioPlayer({
  attachmentId,
  durationSeconds,
  waveformData,
  senderName
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const { url, loading, error } = useAudioAttachment(attachmentId)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setProgress(audio.currentTime / audio.duration)
    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [url])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !url) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }

  function formatDuration(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const BAR_COUNT = 40
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const idx = Math.floor((i * waveformData.length) / BAR_COUNT)
    return waveformData[idx] ?? 0
  })
  const maxAmplitude = Math.max(...bars, 1)

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <button
        onClick={togglePlay}
        disabled={loading || !url}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full disabled:bg-gray-300"
      >
        {loading ? '...' : playing ? '⏸' : '▶'}
      </button>

      <div className="flex-grow flex items-center gap-1 h-8">
        {bars.map((amplitude, i) => {
          const heightPct = Math.max(0.15, amplitude / maxAmplitude)
          const isPlayed = i / BAR_COUNT < progress

          return (
            <div
              key={i}
              className={`flex-grow ${isPlayed ? 'bg-blue-500' : 'bg-gray-300'}`}
              style={{ height: `${heightPct * 100}%` }}
            />
          )
        })}
      </div>

      <div className="text-xs text-gray-600 flex-shrink-0 w-12 text-right">
        {formatDuration(durationSeconds)}
      </div>

      {url && <audio ref={audioRef} src={url} crossOrigin="anonymous" />}
    </div>
  )
}
