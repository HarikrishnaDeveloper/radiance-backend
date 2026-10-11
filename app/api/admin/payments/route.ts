import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const where: Prisma.PaymentWhereInput = q
    ? {
        OR: [
          { razorpayPaymentId: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q, mode: 'insensitive' } } },
          { user: { username: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {}

  const [payments, total, sum] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, phone: true, username: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, status: 'CAPTURED' }, _sum: { amountPaise: true } }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    totalCapturedPaise: sum._sum.amountPaise ?? 0,
    payments: payments.map((p) => ({
      id: p.id,
      razorpayPaymentId: p.razorpayPaymentId,
      amountPaise: p.amountPaise,
      currency: p.currency,
      status: p.status,
      method: p.method,
      paidAt: p.paidAt,
      user: p.user,
    })),
  })
}
