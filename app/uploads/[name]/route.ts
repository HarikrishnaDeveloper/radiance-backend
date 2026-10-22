import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readImageUpload } from '@/lib/uploads'

type Context = { params: Promise<{ name: string }> }

// Public: serves images uploaded through /api/admin/uploads to the app.
// Each upload gets a fresh name, so a file never changes and can be cached forever.
export async function GET(_request: NextRequest, ctx: Context) {
  const { name } = await ctx.params
  const file = await readImageUpload(name)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
