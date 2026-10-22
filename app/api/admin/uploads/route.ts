import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { saveImageUpload, UploadError } from '@/lib/uploads'

// Uploads one image (multipart field "file") for a question or option and
// returns the path to store on it, e.g. { url: "/uploads/<uuid>.png" }.
export async function POST(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Expected an image in the "file" field' }, { status: 400 })
  }

  try {
    return NextResponse.json({ url: await saveImageUpload(file) }, { status: 201 })
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
