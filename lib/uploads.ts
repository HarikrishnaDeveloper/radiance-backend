import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Images uploaded from radiance-admin (question and option pictures). They
// live on disk outside public/ — Next.js only serves public/ files that
// existed at build time — and are served by app/uploads/[name]/route.ts.
// In Docker, mount a volume at UPLOAD_DIR or uploads vanish on redeploy.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))

// Stored on questions/options as a path on this server, like the existing
// /images/... question pictures; clients prefix it with the API's base URL.
export const UPLOAD_URL_PREFIX = '/uploads/'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const CONTENT_TYPES = Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]))

export class UploadError extends Error {}

export async function saveImageUpload(file: File): Promise<string> {
  const ext = EXTENSIONS[file.type]
  if (!ext) throw new UploadError('Only PNG, JPEG, WebP or GIF images can be uploaded')
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('Image must be 5 MB or smaller')

  const name = `${randomUUID()}.${ext}`
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()))
  return UPLOAD_URL_PREFIX + name
}

// Names are always <uuid>.<ext> as written above, so anything else (including
// path traversal attempts) is simply not found.
const NAME_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/

export async function readImageUpload(name: string): Promise<{ data: Buffer; contentType: string } | null> {
  const match = NAME_PATTERN.exec(name)
  if (!match) return null
  try {
    return { data: await readFile(path.join(UPLOAD_DIR, name)), contentType: CONTENT_TYPES[match[1]] }
  } catch {
    return null
  }
}
