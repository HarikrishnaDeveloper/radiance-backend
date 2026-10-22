-- CreateEnum
CREATE TYPE "StreakFreezePurchaseStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "StreakFreezeSource" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freezesRefilledFor" TEXT,
ADD COLUMN     "paidStreakFreezes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StreakFreezePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountPaise" INTEGER NOT NULL,
    "status" "StreakFreezePurchaseStatus" NOT NULL DEFAULT 'CREATED',
    "forRestore" BOOLEAN NOT NULL DEFAULT false,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "StreakFreezePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakFreezeUse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "source" "StreakFreezeSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakFreezeUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreakFreezePurchase_razorpayOrderId_key" ON "StreakFreezePurchase"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "StreakFreezePurchase_razorpayPaymentId_key" ON "StreakFreezePurchase"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "StreakFreezePurchase_userId_idx" ON "StreakFreezePurchase"("userId");

-- CreateIndex
CREATE INDEX "StreakFreezePurchase_createdAt_idx" ON "StreakFreezePurchase"("createdAt");

-- CreateIndex
CREATE INDEX "StreakFreezeUse_userId_idx" ON "StreakFreezeUse"("userId");

-- CreateIndex
CREATE INDEX "StreakFreezeUse_createdAt_idx" ON "StreakFreezeUse"("createdAt");

-- AddForeignKey
ALTER TABLE "StreakFreezePurchase" ADD CONSTRAINT "StreakFreezePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakFreezeUse" ADD CONSTRAINT "StreakFreezeUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing users keep this month's free freezes as they are; the monthly
-- refill starts with them from next month.
UPDATE "User" SET "freezesRefilledFor" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
