import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkOtp } from '@/lib/twilio'
import { signAccessToken } from '@/lib/jwt'
import { createRefreshToken } from '@/lib/refresh-tokens'

const E164_RE = /^\+[1-9]\d{7,14}$/

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const phone = body?.phone
  const code = body?.code
  if (typeof phone !== 'string' || !E164_RE.test(phone) || typeof code !== 'string') {
    return NextResponse.json({ error: 'phone and code are required' }, { status: 400 })
  }

  console.time('[VERIFY] total')

  console.time('[VERIFY] twilio checkOtp')
  const ok = await checkOtp(phone, code)
  console.timeEnd('[VERIFY] twilio checkOtp')
  if (!ok) {
    console.timeEnd('[VERIFY] total')
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  console.time('[VERIFY] db upsert user')
  const user = await prisma.user.upsert({
    where: { phone },
    update: { phoneVerifiedAt: new Date() },
    create: { phone, phoneVerifiedAt: new Date() },
  })
  console.timeEnd('[VERIFY] db upsert user')

  console.time('[VERIFY] sign jwt')
  const accessToken = await signAccessToken({ id: user.id, username: user.username, name: user.name })
  console.timeEnd('[VERIFY] sign jwt')

  console.time('[VERIFY] db create refresh token')
  const refreshToken = await createRefreshToken(user.id)
  console.timeEnd('[VERIFY] db create refresh token')

  console.timeEnd('[VERIFY] total')

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, name: user.name, phone: user.phone },
  })
}
