import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/razorpay'
import type { SubscriptionStatus } from '@prisma/client'
import { AUTOPAY_ON_STATUSES, ENDED_STATUSES as ENDED_STATUS_LIST, recordPayment, unixToDate } from '@/lib/billing'

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
const ACTIVE_STATUSES = new Set<SubscriptionStatus>(AUTOPAY_ON_STATUSES)
const ENDED_STATUSES = new Set<SubscriptionStatus>(ENDED_STATUS_LIST)

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

  const autopayOn = ACTIVE_STATUSES.has(status)
  const ended = ENDED_STATUSES.has(status)

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status,
        currentStart: unixToDate(entity.current_start) ?? subscription.currentStart,
        currentEnd: unixToDate(entity.current_end) ?? subscription.currentEnd,
        // No further charges once autopay has ended.
        chargeAt: ended ? null : (unixToDate(entity.charge_at) ?? subscription.chargeAt),
        paidCount: typeof entity.paid_count === 'number' ? entity.paid_count : subscription.paidCount,
        activatedAt: subscription.activatedAt ?? (status === 'ACTIVE' ? new Date() : null),
        cancelledAt: ended ? (subscription.cancelledAt ?? unixToDate(entity.ended_at) ?? new Date()) : null,
      },
    })
    await tx.user.update({
      where: { id: subscription.userId },
      data: { isPremium: autopayOn },
    })

    // subscription.charged (first payment and every autopay renewal) carries
    // the payment that was just captured alongside the subscription.
    const payment = payload?.payload?.payment?.entity
    if (payload?.event === 'subscription.charged' && typeof payment?.id === 'string') {
      await recordPayment(
        {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          razorpayPaymentId: payment.id,
          amountPaise: Number(payment.amount) || 0,
          currency: typeof payment.currency === 'string' ? payment.currency : 'INR',
          method: typeof payment.method === 'string' ? payment.method : null,
          paidAt: unixToDate(payment.created_at) ?? new Date(),
        },
        tx
      )
    }
  })

  return NextResponse.json({ ok: true })
}
