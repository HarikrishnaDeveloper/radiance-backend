import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { promotePaper } from '@/lib/promote-paper'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const paperId = Number(id)
  if (!Number.isInteger(paperId)) {
    return NextResponse.json({ error: 'Invalid paper id' }, { status: 400 })
  }

  const paper = await prisma.paper.findUnique({ where: { id: paperId } })
  if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

  const { promoted, total, skipped } = await promotePaper(prisma, paper)
  return NextResponse.json({ promoted, total, skipped })
}
