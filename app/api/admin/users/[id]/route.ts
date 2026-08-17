import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      _count: { select: { attempts: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const completedStages = await prisma.userStageProgress.count({ where: { userId: id, status: 'COMPLETED' } })

  return NextResponse.json({
    id: user.id,
    username: user.username,
    phone: user.phone,
    email: user.email,
    name: user.name,
    state: user.state,
    isTestUser: user.isTestUser,
    isPremium: user.isPremium,
    createdAt: user.createdAt,
    completedStages,
    quizAttempts: user._count.attempts,
    subscription: user.subscription
      ? {
          status: user.subscription.status,
          razorpaySubscriptionId: user.subscription.razorpaySubscriptionId,
          currentStart: user.subscription.currentStart,
          currentEnd: user.subscription.currentEnd,
        }
      : null,
  })
}

export async function PATCH(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const body = await request.json().catch(() => null)
  const data: { isTestUser?: boolean; isPremium?: boolean } = {}
  if (typeof body?.isTestUser === 'boolean') data.isTestUser = body.isTestUser
  if (typeof body?.isPremium === 'boolean') data.isPremium = body.isPremium

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({ where: { id }, data })
  return NextResponse.json({ id: updated.id, isTestUser: updated.isTestUser, isPremium: updated.isPremium })
}
