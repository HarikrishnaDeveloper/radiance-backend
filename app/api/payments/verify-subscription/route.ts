import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { verifySubscriptionPaymentSignature } from '@/lib/razorpay'

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const razorpayPaymentId = body?.razorpay_payment_id
  const razorpaySubscriptionId = body?.razorpay_subscription_id
  const razorpaySignature = body?.razorpay_signature

  if (
    typeof razorpayPaymentId !== 'string' ||
    typeof razorpaySubscriptionId !== 'string' ||
    typeof razorpaySignature !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 })
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (!subscription || subscription.razorpaySubscriptionId !== razorpaySubscriptionId) {
    return NextResponse.json({ error: 'Subscription not found for this user' }, { status: 404 })
  }

  const valid = verifySubscriptionPaymentSignature({
    razorpayPaymentId,
    razorpaySubscriptionId,
    razorpaySignature,
  })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // The webhook is the durable source of truth for renewals/cancellations,
  // but we flip access on immediately here too — waiting for the webhook
  // round trip would leave a user who just paid staring at a paywall.
  await prisma.$transaction([
    prisma.subscription.update({ where: { userId: user.id }, data: { status: 'ACTIVE' } }),
    prisma.user.update({ where: { id: user.id }, data: { isPremium: true } }),
  ])

  return NextResponse.json({ ok: true, isPremium: true })
}
