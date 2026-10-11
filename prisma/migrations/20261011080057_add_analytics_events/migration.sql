-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "path" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_productId_idx" ON "AnalyticsEvent"("productId");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
