import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { canCompleteWithoutPayment, getFreezeSettings, purchaseBlockedReason, refillMonthlyFreezes } from '@/lib/streak-freeze'

// Starts buying one streak freeze at the admin-set price (₹5 by default).
// Creates the order; the app then pays and calls .../purchase/[id]/confirm.
// Body: { forRestore?: boolean } — true when bought from the "restore your
// streak" offer.
//
// When Razorpay is connected: create a Razorpay order here for
// settings.pricePaise, store its id on the purchase, and return it with the key.
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => ({}))
  const settings = await getFreezeSettings(prisma)
  await refillMonthlyFreezes(prisma, user.id, settings.freePerMonth)

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isTestUser: true, streakFreezesAvailable: true, paidStreakFreezes: true },
  })
  if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const blocked = purchaseBlockedReason(me, settings)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })

  const purchase = await prisma.streakFreezePurchase.create({
    data: { userId: user.id, quantity: 1, amountPaise: settings.pricePaise, forRestore: body?.forRestore === true },
  })

  return NextResponse.json({
    purchaseId: purchase.id,
    amountPaise: purchase.amountPaise,
    currency: 'INR',
    paymentsEnabled: canCompleteWithoutPayment(me),
  })
}
