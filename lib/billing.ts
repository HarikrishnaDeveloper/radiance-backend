import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cancelRazorpaySubscription } from '@/lib/razorpay'

// Statuses where the Razorpay mandate is live and autopay will keep charging.
export const AUTOPAY_ON_STATUSES = ['ACTIVE', 'AUTHENTICATED'] as const
// Razorpay is retrying a failed renewal (PENDING) or has given up (HALTED).
export const PAYMENT_ISSUE_STATUSES = ['PENDING', 'HALTED'] as const
// Autopay is off for good — the user must subscribe again to regain access.
export const ENDED_STATUSES = ['CANCELLED', 'COMPLETED', 'EXPIRED'] as const

export function unixToDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === 'number' && unixSeconds > 0 ? new Date(unixSeconds * 1000) : null
}

// Idempotent on razorpayPaymentId: verify-subscription and the
// subscription.charged webhook both report the first charge, and Razorpay
// retries webhooks, so the same payment can arrive more than once.
export async function recordPayment(
  data: {
    userId: string
    subscriptionId: string
    razorpayPaymentId: string
    amountPaise: number
    currency?: string
    method?: string | null
    paidAt?: Date
  },
  tx: Prisma.TransactionClient = prisma
) {
  return tx.payment.upsert({
    where: { razorpayPaymentId: data.razorpayPaymentId },
    update: {
      amountPaise: data.amountPaise,
      ...(data.method ? { method: data.method } : {}),
    },
    create: {
      userId: data.userId,
      subscriptionId: data.subscriptionId,
      razorpayPaymentId: data.razorpayPaymentId,
      amountPaise: data.amountPaise,
      currency: data.currency ?? 'INR',
      method: data.method ?? null,
      paidAt: data.paidAt ?? new Date(),
    },
  })
}

// Stops autopay in Razorpay and revokes access immediately. Shared by the
// user's own cancel route and the admin cancel action.
export async function cancelSubscriptionNow(subscription: { id: string; userId: string; razorpaySubscriptionId: string }) {
  await cancelRazorpaySubscription(subscription.razorpaySubscriptionId)
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), chargeAt: null },
    }),
    prisma.user.update({ where: { id: subscription.userId }, data: { isPremium: false } }),
  ])
}
