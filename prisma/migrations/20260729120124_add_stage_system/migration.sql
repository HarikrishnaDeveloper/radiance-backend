-- CreateEnum
CREATE TYPE "StageProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "color" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "foodWorldName" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Stage" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "foodWorldName" TEXT,
    "questionCount" INTEGER NOT NULL,
    "rewardStars" INTEGER NOT NULL DEFAULT 3,
    "unlockOrder" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageQuestion" (
    "id" SERIAL NOT NULL,
    "stageId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "StageQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStageProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "stageId" INTEGER NOT NULL,
    "completedQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "starsEarned" INTEGER NOT NULL DEFAULT 0,
    "status" "StageProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserStageProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedOption" INTEGER,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "timeTaken" INTEGER,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserQuestionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stage_categoryId_stageNumber_key" ON "Stage"("categoryId", "stageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StageQuestion_stageId_questionId_key" ON "StageQuestion"("stageId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStageProgress_userId_stageId_key" ON "UserStageProgress"("userId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestionProgress_userId_questionId_key" ON "UserQuestionProgress"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageQuestion" ADD CONSTRAINT "StageQuestion_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageQuestion" ADD CONSTRAINT "StageQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStageProgress" ADD CONSTRAINT "UserStageProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStageProgress" ADD CONSTRAINT "UserStageProgress_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionProgress" ADD CONSTRAINT "UserQuestionProgress_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
