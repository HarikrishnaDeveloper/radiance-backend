import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { DEFAULT_FREEZE_SETTINGS, getFreezeSettings, type FreezeSettings } from '@/lib/streak-freeze'

// Allowed range for each rule, so a typo can't give away 1000 freezes or
// charge ₹5000.
const LIMITS: Record<keyof FreezeSettings, { min: number; max: number; label: string }> = {
  freePerMonth: { min: 0, max: 10, label: 'Free freezes per month' },
  pricePaise: { min: 100, max: 10000, label: 'Price' },
  maxPaid: { min: 0, max: 50, label: 'Most bought freezes a student can hold' },
}

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied
  return NextResponse.json(await getFreezeSettings(prisma))
}

// Updates any of { freePerMonth, pricePaise, maxPaid }. A new free allowance
// reaches each student at their next monthly refill; price and limit apply
// straight away.
export async function PATCH(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const data: Partial<FreezeSettings> = {}
  for (const key of Object.keys(LIMITS) as (keyof FreezeSettings)[]) {
    if (body[key] === undefined) continue
    const value = Number(body[key])
    const { min, max, label } = LIMITS[key]
    if (!Number.isInteger(value) || value < min || value > max) {
      const range = key === 'pricePaise' ? `₹${min / 100} and ₹${max / 100}` : `${min} and ${max}`
      return NextResponse.json({ error: `${label} must be a whole number between ${range}` }, { status: 400 })
    }
    data[key] = value
  }

  const saved = await prisma.streakFreezeSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { ...DEFAULT_FREEZE_SETTINGS, ...data, id: 1 },
  })
  return NextResponse.json({ freePerMonth: saved.freePerMonth, pricePaise: saved.pricePaise, maxPaid: saved.maxPaid })
}
