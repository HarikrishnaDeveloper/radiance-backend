-- CreateTable
CREATE TABLE "StreakFreezeSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "freePerMonth" INTEGER NOT NULL DEFAULT 2,
    "pricePaise" INTEGER NOT NULL DEFAULT 500,
    "maxPaid" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakFreezeSettings_pkey" PRIMARY KEY ("id")
);

-- The one settings row, starting from the original rules: 2 free a month, ₹5 each, hold up to 5.
INSERT INTO "StreakFreezeSettings" ("id", "freePerMonth", "pricePaise", "maxPaid", "updatedAt") VALUES (1, 2, 500, 5, CURRENT_TIMESTAMP);
