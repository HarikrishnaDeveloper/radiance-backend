import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/razorpay'
import type { SubscriptionStatus } from '@prisma/client'

// Razorpay subscription.* statuses, lowercased, mapped onto our enum.
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  created: 'CREATED',
  authenticated: 'AUTHENTICATED',
  active: 'ACTIVE',
  pending: 'PENDING',
  halted: 'HALTED',
  cancelled: 'CANCELLED',
  completed: 'COMPLETED',
  expired: 'EXPIRED',
}

// Statuses that mean "customer currently has paid access". Everything else
// (halted, cancelled, completed, expired, pending-too-long) revokes it —
// this is the actual monthly-renewal enforcement: no cron job needed,
// Razorpay tells us the moment a charge fails or a plan lapses.
const ACTIVE_STATUSES = new Set<SubscriptionStatus>(['ACTIVE', 'AUTHENTICATED'])

function toDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000) : null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const entity = payload?.payload?.subscription?.entity
  if (!entity?.id || typeof entity.status !== 'string') {
    // Not a subscription.* event (e.g. payment.* only) — nothing for us to do.
    return NextResponse.json({ ok: true })
  }

  const status = STATUS_MAP[entity.status] ?? 'PENDING'
  const subscription = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: entity.id },
  })
  if (!subscription) {
    // Unknown subscription (e.g. created outside this app) — acknowledge and ignore.
    return NextResponse.json({ ok: true })
  }

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        currentStart: toDate(entity.current_start) ?? subscription.currentStart,
        currentEnd: toDate(entity.current_end) ?? subscription.currentEnd,
      },
    }),
    prisma.user.update({
      where: { id: subscription.userId },
      data: { isPremium: ACTIVE_STATUSES.has(status) },
    }),
  ])

  return NextResponse.json({ ok: true })
}
