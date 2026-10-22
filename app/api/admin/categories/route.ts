import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const categories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { _count: { select: { questions: true, stages: true } } },
  })

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      foodWorldName: c.foodWorldName,
      icon: c.icon,
      color: c.color,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      questionCount: c._count.questions,
      stageCount: c._count.stages,
    }))
  )
}

// Creates a category. Only the name is required; the stage-mode presentation
// fields can be filled in later from the category's admin page.
export async function POST(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })

  const existing = await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  if (existing) return NextResponse.json({ error: `A category named "${existing.name}" already exists` }, { status: 409 })

  // New categories go to the end of the list unless an order is given.
  const last = await prisma.category.aggregate({ _max: { displayOrder: true } })
  const category = await prisma.category.create({
    data: {
      name,
      foodWorldName: String(body.foodWorldName ?? '').trim() || null,
      displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : (last._max.displayOrder ?? 0) + 1,
    },
  })
  return NextResponse.json(category, { status: 201 })
}
