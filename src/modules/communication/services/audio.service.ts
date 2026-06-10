import type { Attachment, AudioBroadcastPayload } from '../schemas'

export class AudioService {
  /**
   * Register an audio attachment after successful upload
   */
  static async registerAttachment(payload: AudioBroadcastPayload): Promise<string> {
    const response = await fetch('/api/communications/attachments/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.message ?? 'Failed to register attachment')
    }

    const { attachmentId } = await response.json()
    return attachmentId
  }

  /**
   * Get attachment details
   */
  static async getAttachment(attachmentId: string): Promise<Attachment> {
    const response = await fetch(
      `/api/communications/attachments/${attachmentId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch attachment')
    }

    return response.json()
  }

  /**
   * Delete an attachment (soft delete)
   */
  static async deleteAttachment(attachmentId: string): Promise<void> {
    const response = await fetch(
      `/api/communications/attachments/${attachmentId}`,
      {
        method: 'DELETE'
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete attachment')
    }
  }
}
