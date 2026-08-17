import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createRazorpaySubscription, getPlanId, MONTHLY_PLAN_AMOUNT_PAISE } from '@/lib/razorpay'

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } })
  if (existing && (existing.status === 'ACTIVE' || existing.status === 'AUTHENTICATED')) {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
  }

  const planId = getPlanId()
  const razorpaySub = await createRazorpaySubscription(planId)

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { razorpaySubscriptionId: razorpaySub.id, razorpayPlanId: planId, status: 'CREATED' },
    create: { userId: user.id, razorpaySubscriptionId: razorpaySub.id, razorpayPlanId: planId, status: 'CREATED' },
  })

  return NextResponse.json({
    subscriptionId: razorpaySub.id,
    keyId: process.env.RAZORPAY_KEY_ID,
    amount: MONTHLY_PLAN_AMOUNT_PAISE,
    currency: 'INR',
  })
}
