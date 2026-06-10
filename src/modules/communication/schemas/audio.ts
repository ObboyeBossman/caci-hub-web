// Audio recording and broadcast types
export interface AudioBroadcast {
  attachmentId: string
  durationSeconds: number
  waveformData: number[]
  mimeType: string
  checksum: string
  fileSizeBytes: number
  campaignId?: string
  recipientList?: string[]
}

export interface AudioBroadcastPayload {
  assembly_id: string
  campaign_id?: string | null
  thread_message_id?: string | null
  storage_bucket: string
  storage_path: string
  mime_type: string
  file_size_bytes: number
  checksum: string
  duration_seconds: number
  waveform_data: number[]
  is_sensitive: boolean
  is_public_broadcast: boolean
}

// Audio constraints
export const AUDIO_CONSTRAINTS = {
  MAX_FILE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_DURATION_SEC: 600, // 10 minutes
  MIN_DURATION_SEC: 2,
  SAMPLE_RATE: 16000,
  BITRATE: 32000,
  CHANNELS: 1
} as const

// MIME type support
export const SUPPORTED_AUDIO_MIMES = [
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg'
] as const

export type SupportedAudioMime = (typeof SUPPORTED_AUDIO_MIMES)[number]
