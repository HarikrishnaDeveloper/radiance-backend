import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { cancelRazorpaySubscription } from '@/lib/razorpay'

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (!subscription || subscription.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
  }

  await cancelRazorpaySubscription(subscription.razorpaySubscriptionId)

  // Access is revoked here rather than waiting for the cancellation webhook —
  // same "don't make the user wait on us" reasoning as verify-subscription.
  // Razorpay's own webhook will confirm this shortly after with the same status.
  await prisma.$transaction([
    prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } }),
    prisma.user.update({ where: { id: user.id }, data: { isPremium: false } }),
  ])

  return NextResponse.json({ ok: true })
}
