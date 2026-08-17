import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const subscriptions = await prisma.subscription.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { user: { select: { id: true, name: true, phone: true, username: true } } },
  })

  return NextResponse.json(
    subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
      currentStart: sub.currentStart,
      currentEnd: sub.currentEnd,
      updatedAt: sub.updatedAt,
      user: sub.user,
    }))
  )
}
