import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getActivityDates } from '@/lib/user-activity'
import { computeStreakFromDates } from '@/lib/streak'
import { applyAutoStreakFreeze, canCompleteWithoutPayment, fulfilFreezePurchase } from '@/lib/streak-freeze'

type Context = { params: Promise<{ id: string }> }

// Completes a streak freeze purchase: adds the freeze to the student's balance
// and, if yesterday's miss broke their streak, spends it right away to
// restore the streak.
//
// When Razorpay is connected: take { razorpay_order_id, razorpay_payment_id,
// razorpay_signature } in the body, verify the signature (as
// payments/verify-subscription does), then pass the ids to fulfilFreezePurchase.
// Until then only test accounts / mock mode can complete a purchase.
export async function POST(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const purchase = await prisma.streakFreezePurchase.findUnique({ where: { id } })
  if (!purchase || purchase.userId !== user.id) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  }

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { isTestUser: true } })
  if (!me || !canCompleteWithoutPayment(me)) {
    return NextResponse.json({ error: 'Buying streak freezes is coming soon.' }, { status: 501 })
  }

  await fulfilFreezePurchase(prisma, purchase.id)

  const realDates = await getActivityDates(prisma, user.id)
  const realDateStrings = new Set(realDates.map((d) => d.toISOString().slice(0, 10)))
  const restored = await applyAutoStreakFreeze(prisma, user.id, realDateStrings)

  const after = await prisma.user.findUnique({ where: { id: user.id }, select: { frozenDates: true } })
  const streak = computeStreakFromDates([...realDates, ...(after?.frozenDates ?? [])])

  return NextResponse.json({ ok: true, restored, streak })
}
