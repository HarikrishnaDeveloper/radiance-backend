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
      questionImage: imagePath(body.questionImage),
      optionAImage: imagePath(body.optionAImage),
      optionBImage: imagePath(body.optionBImage),
      optionCImage: imagePath(body.optionCImage),
      optionDImage: imagePath(body.optionDImage),
      correctAnswer:
        body.correctAnswer !== undefined ? String(body.correctAnswer).trim().toUpperCase() || null : undefined,
      categoryId: body.categoryId !== undefined ? (body.categoryId === null ? null : Number(body.categoryId)) : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      explanation: body.explanation !== undefined ? String(body.explanation).trim() || null : undefined,
      revisionPoints: body.revisionPoints !== undefined ? String(body.revisionPoints).trim() || null : undefined,
    },
  })

  return NextResponse.json(updated)
}

// Image fields hold a path on this server (from /api/admin/uploads, or an
// existing /images/... file); "" or null clears the image.
function imagePath(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  const path = String(value ?? '').trim()
  return path.startsWith('/') ? path : null
}

// Deletes a draft question. Its live copy (if it was promoted) comes off the
// paper on the next promote — see lib/promote-paper.ts.
export async function DELETE(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const draftId = Number(id)
  if (!Number.isInteger(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  const deleted = await prisma.draftQuestion.deleteMany({ where: { id: draftId } })
  if (deleted.count === 0) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
