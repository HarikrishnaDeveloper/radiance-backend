import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { signAccessToken } from '@/lib/jwt'
import { publicUser } from '@/lib/serializers'

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const fullName = body?.fullName ?? body?.name
  const email = body?.email
  const targetExam = body?.targetExam ?? 'UPSC_CSE'
  const preparationLevel = body?.preparationLevel
  const targetAttempt = body?.targetAttempt
  const preparationFocus = body?.preparationFocus ?? 'BOTH'
  const state = body?.state
  const referralSource = typeof body?.referralSource === 'string' ? body.referralSource.trim() || null : undefined
  const preparationDuration =
    typeof body?.preparationDuration === 'string' ? body.preparationDuration.trim() || null : undefined

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  }
  if (!preparationLevel || typeof preparationLevel !== 'string' || !preparationLevel.trim()) {
    return NextResponse.json({ error: 'Preparation level is required' }, { status: 400 })
  }
  if (!preparationFocus || typeof preparationFocus !== 'string' || !preparationFocus.trim()) {
    return NextResponse.json({ error: 'Preparation focus is required' }, { status: 400 })
  }
  if (email !== undefined && email !== null && typeof email !== 'string') {
    return NextResponse.json({ error: 'Email must be a string' }, { status: 400 })
  }

  const trimmedName = fullName.trim()
  const trimmedEmail = email ? email.trim() : null
  const trimmedTargetAttempt = targetAttempt ? String(targetAttempt).trim() : null

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update user
      const userUpdate: Prisma.UserUpdateInput = {
        name: trimmedName,
        profileCompleted: true,
      }
      if (trimmedEmail !== undefined) {
        userUpdate.email = trimmedEmail || null
      }
      if (state !== undefined && typeof state === 'string') {
        userUpdate.state = state.trim() || null
      }

      await tx.user.update({
        where: { id: user.id },
        data: userUpdate,
      })

      // 2. Upsert user profile
      const profile = await tx.userProfile.upsert({
        where: { userId: user.id },
        update: {
          fullName: trimmedName,
          targetExam: String(targetExam).trim(),
          preparationLevel: String(preparationLevel).trim(),
          targetAttempt: trimmedTargetAttempt,
          preparationFocus: String(preparationFocus).trim(),
          ...(referralSource !== undefined && { referralSource }),
          ...(preparationDuration !== undefined && { preparationDuration }),
        },
        create: {
          userId: user.id,
          fullName: trimmedName,
          targetExam: String(targetExam).trim(),
          preparationLevel: String(preparationLevel).trim(),
          targetAttempt: trimmedTargetAttempt,
          preparationFocus: String(preparationFocus).trim(),
          referralSource: referralSource ?? null,
          preparationDuration: preparationDuration ?? null,
        },
      })

      const fullUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { profile: true },
      })
      return fullUser
    })

    const accessToken = await signAccessToken({
      id: updated.id,
      username: updated.username,
      name: updated.name,
    })

    return NextResponse.json({
      accessToken,
      user: publicUser(updated),
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
    }
    console.error('[PROFILE_UPDATE_ERROR]', e)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
