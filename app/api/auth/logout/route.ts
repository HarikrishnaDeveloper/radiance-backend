import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteSessionForToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  await deleteSessionForToken(request)
  return NextResponse.json({ ok: true })
}
