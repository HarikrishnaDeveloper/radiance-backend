-- AlterTable
ALTER TABLE "User" ADD COLUMN "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "targetExam" TEXT NOT NULL DEFAULT 'UPSC_CSE',
    "preparationLevel" TEXT NOT NULL,
    "targetAttempt" TEXT,
    "preparationFocus" TEXT NOT NULL DEFAULT 'BOTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing users who already have a name are considered profileCompleted, and receive a default UserProfile
UPDATE "User" SET "profileCompleted" = true WHERE "name" IS NOT NULL AND TRIM("name") <> '';

INSERT INTO "UserProfile" ("id", "userId", "fullName", "targetExam", "preparationLevel", "preparationFocus", "createdAt", "updatedAt")
SELECT CONCAT('c', SUBSTRING(MD5(RANDOM()::TEXT), 1, 24)), "id", "name", 'UPSC_CSE', 'BEGINNER', 'BOTH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "name" IS NOT NULL AND TRIM("name") <> ''
ON CONFLICT ("userId") DO NOTHING;
