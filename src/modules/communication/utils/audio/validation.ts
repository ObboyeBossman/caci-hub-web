const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_DURATION_SEC = 600
const MIN_DURATION_SEC = 2

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateAudioUpload(
  blob: Blob,
  durationSeconds: number
): ValidationResult {
  if (blob.size > MAX_FILE_BYTES) {
    return {
      valid: false,
      reason: `Recording is too large (${(blob.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`
    }
  }
  if (durationSeconds > MAX_DURATION_SEC) {
    return {
      valid: false,
      reason: `Recording is too long (${Math.round(durationSeconds / 60)} min). Maximum is 10 minutes.`
    }
  }
  if (durationSeconds < MIN_DURATION_SEC) {
    return {
      valid: false,
      reason: `Recording is too short (${durationSeconds}s). Minimum is 2 seconds.`
    }
  }
  return { valid: true }
}
