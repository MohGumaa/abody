-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "includedAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "requirementsAr" TEXT,
ADD COLUMN     "shortDescriptionAr" TEXT;
