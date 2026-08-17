import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const stageId = Number(id)
  if (!Number.isInteger(stageId)) {
    return NextResponse.json({ error: 'Invalid stage id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const updated = await prisma.stage.update({
    where: { id: stageId },
    data: {
      title: typeof body.title === 'string' ? body.title.trim() : undefined,
      rewardStars: body.rewardStars !== undefined ? Number(body.rewardStars) : undefined,
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : undefined,
    },
  })

  return NextResponse.json(updated)
}
