import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { stages: { orderBy: { stageNumber: 'asc' } } },
  })
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  return NextResponse.json(category)
}

export async function PATCH(request: NextRequest, ctx: Context) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { id } = await ctx.params
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    const clash = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: categoryId } },
    })
    if (clash) return NextResponse.json({ error: `A category named "${clash.name}" already exists` }, { status: 409 })
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: {
      name,
      foodWorldName: body.foodWorldName !== undefined ? String(body.foodWorldName).trim() || null : undefined,
      icon: body.icon !== undefined ? String(body.icon).trim() || null : undefined,
      color: body.color !== undefined ? String(body.color).trim() || null : undefined,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    },
  })

  return NextResponse.json(updated)
}
