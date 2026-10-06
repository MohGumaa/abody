-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('NEW', 'WAITING_FOR_INFORMATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'NEW',
    "requirements" JSONB NOT NULL,
    "adminNotes" TEXT,
    "startDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_orderItemId_key" ON "Service"("orderItemId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
