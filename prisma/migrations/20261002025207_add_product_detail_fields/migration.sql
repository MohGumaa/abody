-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requirements" TEXT;
