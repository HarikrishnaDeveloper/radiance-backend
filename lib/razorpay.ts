import { createHmac, timingSafeEqual } from 'node:crypto'
import Razorpay from 'razorpay'

// ₹30/month "unlock everything" plan. The Plan itself must exist in the
// Razorpay dashboard (or via scripts/create-razorpay-plan.ts) — its id is
// supplied through RAZORPAY_PLAN_ID rather than created on the fly, since a
// Plan is a one-time setup step, not a per-request concern.
export const MONTHLY_PLAN_AMOUNT_PAISE = 3000

let client: Razorpay | null = null

function getClient(): Razorpay {
  if (client) return client
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set')
  client = new Razorpay({ key_id, key_secret })
  return client
}

export function getPlanId(): string {
  const planId = process.env.RAZORPAY_PLAN_ID
  if (!planId) throw new Error('RAZORPAY_PLAN_ID is not set — run scripts/create-razorpay-plan.ts once and set it')
  return planId
}

export async function createRazorpaySubscription(planId: string): Promise<{ id: string }> {
  const sub = await getClient().subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    // No total_count → runs until the customer or we cancel it, matching
    // "Netflix logic" (open-ended monthly billing, not a fixed-length pass).
    total_count: 600,
  })
  return { id: sub.id }
}

export async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  await getClient().subscriptions.cancel(subscriptionId)
}

function hmacHex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// Verifies the checkout success payload for a subscription payment.
// Signature formula per Razorpay docs: hmac_sha256(payment_id + "|" + subscription_id, key_secret)
export function verifySubscriptionPaymentSignature(params: {
  razorpayPaymentId: string
  razorpaySubscriptionId: string
  razorpaySignature: string
}): boolean {
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_secret) throw new Error('RAZORPAY_KEY_SECRET is not set')
  const expected = hmacHex(`${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`, key_secret)
  return safeEqual(expected, params.razorpaySignature)
}

// Verifies the `X-Razorpay-Signature` header on incoming webhook requests.
// Must be checked against the raw request body, before JSON parsing.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set')
  const expected = hmacHex(rawBody, secret)
  return safeEqual(expected, signature)
}
