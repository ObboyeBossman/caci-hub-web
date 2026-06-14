import { S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3'

let r2Instance: S3Client | null = null

/**
 * Returns a singleton instance of the AWS S3Client configured for Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (!r2Instance) {
    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials missing in environment variables')
    }

    r2Instance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })
  }

  return r2Instance
}
