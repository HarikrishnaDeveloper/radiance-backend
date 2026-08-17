import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const draftId = Number(id)
  if (!Number.isInteger(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const updated = await prisma.draftQuestion.update({
    where: { id: draftId },
    data: {
      text: typeof body.text === 'string' ? body.text.trim() : undefined,
      optionA: body.optionA !== undefined ? String(body.optionA).trim() || null : undefined,
      optionB: body.optionB !== undefined ? String(body.optionB).trim() || null : undefined,
      optionC: body.optionC !== undefined ? String(body.optionC).trim() || null : undefined,
      optionD: body.optionD !== undefined ? String(body.optionD).trim() || null : undefined,
      correctAnswer:
        body.correctAnswer !== undefined ? String(body.correctAnswer).trim().toUpperCase() || null : undefined,
      categoryId: body.categoryId !== undefined ? (body.categoryId === null ? null : Number(body.categoryId)) : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
    },
  })

  return NextResponse.json(updated)
}
