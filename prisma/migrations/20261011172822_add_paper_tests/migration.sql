-- CreateEnum
CREATE TYPE "TestMode" AS ENUM ('EXAM', 'PRACTICE');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "questionNo" INTEGER;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "maxScore" DOUBLE PRECISION,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "sectionCategoryId" INTEGER,
ADD COLUMN     "testMode" "TestMode" NOT NULL DEFAULT 'PRACTICE';

-- CreateIndex
CREATE INDEX "Question_questionPaperId_questionNo_idx" ON "Question"("questionPaperId", "questionNo");

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_sectionCategoryId_fkey" FOREIGN KEY ("sectionCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
