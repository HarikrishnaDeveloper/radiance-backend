import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { AUTOPAY_ON_STATUSES, PAYMENT_ISSUE_STATUSES, cancelSubscriptionNow } from '@/lib/billing'

type Context = { params: Promise<{ id: string }> }

const CANCELLABLE = new Set<string>([...AUTOPAY_ON_STATUSES, ...PAYMENT_ISSUE_STATUSES])

// Admin-initiated stop of a user's autopay (support requests, refunds, abuse).
export async function POST(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const subscription = await prisma.subscription.findUnique({ where: { id } })
  if (!subscription) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  if (!CANCELLABLE.has(subscription.status)) {
    return NextResponse.json({ error: `Subscription is ${subscription.status}, autopay is already off` }, { status: 409 })
  }

  await cancelSubscriptionNow(subscription)
  return NextResponse.json({ ok: true })
}
