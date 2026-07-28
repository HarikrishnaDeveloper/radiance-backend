import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { signAccessToken } from '@/lib/jwt'
import { hashPassword } from '@/lib/password'

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const name = body?.name
  const email = body?.email
  const state = body?.state
  const dateOfBirth = body?.dateOfBirth
  const password = body?.password

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (email !== undefined && email !== null && typeof email !== 'string') {
    return NextResponse.json({ error: 'email must be a string' }, { status: 400 })
  }
  if (state !== undefined && state !== null && typeof state !== 'string') {
    return NextResponse.json({ error: 'state must be a string' }, { status: 400 })
  }
  if (password !== undefined && password !== null && (typeof password !== 'string' || password.length < 6)) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 })
  }
  let parsedDob: Date | undefined
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '') {
    if (typeof dateOfBirth !== 'string') {
      return NextResponse.json({ error: 'dateOfBirth must be a string' }, { status: 400 })
    }
    parsedDob = new Date(dateOfBirth)
    if (Number.isNaN(parsedDob.getTime())) {
      return NextResponse.json({ error: 'dateOfBirth is invalid' }, { status: 400 })
    }
  }

  const existing = await prisma.user.findUnique({ where: { id: user.id } })
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const data: Prisma.UserUpdateInput = {
    name: name.trim(),
    ...(email !== undefined ? { email: email?.trim() || null } : {}),
    ...(state !== undefined ? { state: state?.trim() || null } : {}),
    ...(parsedDob !== undefined ? { dateOfBirth: parsedDob } : {}),
  }

  if (typeof password === 'string') {
    data.passwordHash = await hashPassword(password)
    if (!existing.username && existing.phone) {
      data.username = existing.phone
    }
  }

  let updated
  try {
    updated = await prisma.user.update({ where: { id: user.id }, data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
    }
    throw e
  }

  const accessToken = await signAccessToken({ id: updated.id, username: updated.username, name: updated.name })

  return NextResponse.json({
    accessToken,
    user: {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      state: updated.state,
    },
  })
}
