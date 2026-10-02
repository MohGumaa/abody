-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('DIGITAL_PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "type" "ProductType" NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT,
    "digitalFile" TEXT,
    "status" "ProductStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
