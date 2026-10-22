-- AlterTable
ALTER TABLE "DraftQuestion" ADD COLUMN     "optionAImage" TEXT,
ADD COLUMN     "optionBImage" TEXT,
ADD COLUMN     "optionCImage" TEXT,
ADD COLUMN     "optionDImage" TEXT;

-- AlterTable
ALTER TABLE "Option" ADD COLUMN     "imageUrl" TEXT;
