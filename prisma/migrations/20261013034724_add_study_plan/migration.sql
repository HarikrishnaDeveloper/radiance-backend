-- CreateEnum
CREATE TYPE "StudyGoalType" AS ENUM ('STAGES', 'QUESTIONS', 'DAILY_CHALLENGE', 'FULL_TEST');

-- CreateTable
CREATE TABLE "StudyPlanGoal" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StudyGoalType" NOT NULL,
    "target" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "StudyGoalType" NOT NULL,
    "target" INTEGER NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanGoal_userId_type_key" ON "StudyPlanGoal"("userId", "type");

-- CreateIndex
CREATE INDEX "DailyTask_userId_date_idx" ON "DailyTask"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_userId_date_type_key" ON "DailyTask"("userId", "date", "type");

-- AddForeignKey
ALTER TABLE "StudyPlanGoal" ADD CONSTRAINT "StudyPlanGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
