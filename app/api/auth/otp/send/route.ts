import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOtp } from '@/lib/twilio'

const E164_RE = /^\+[1-9]\d{7,14}$/
const THROTTLE_MS = 60 * 1000

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const phone = body?.phone
  if (typeof phone !== 'string' || !E164_RE.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid mobile number' }, { status: 400 })
  }

  const user = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: { phone },
  })

  if (user.lastOtpSentAt && Date.now() - user.lastOtpSentAt.getTime() < THROTTLE_MS) {
    return NextResponse.json({ error: 'Please wait a minute before requesting another code' }, { status: 429 })
  }

  try {
    await sendOtp(phone)
  } catch (err: unknown) {
    // Provider details (account limits, credentials) stay in the server log.
    console.error('[OTP SEND ERROR]:', err)
    return NextResponse.json(
      { error: 'We could not send a code to this number right now. Please try again shortly.' },
      { status: 502 }
    )
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastOtpSentAt: new Date() } })
  return NextResponse.json({ ok: true })
}
