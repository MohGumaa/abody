-- CreateTable
CREATE TABLE "SiteContent" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "heroEyebrow" TEXT,
    "heroEyebrowAr" TEXT,
    "heroTitle" TEXT,
    "heroTitleAr" TEXT,
    "heroLead" TEXT,
    "heroLeadAr" TEXT,
    "ctaTitle" TEXT,
    "ctaTitleAr" TEXT,
    "ctaBody" TEXT,
    "ctaBodyAr" TEXT,
    "ctaAction" TEXT,
    "ctaActionAr" TEXT,
    "showCategories" BOOLEAN NOT NULL DEFAULT true,
    "showFeatured" BOOLEAN NOT NULL DEFAULT true,
    "showServices" BOOLEAN NOT NULL DEFAULT true,
    "showValues" BOOLEAN NOT NULL DEFAULT true,
    "showHowItWorks" BOOLEAN NOT NULL DEFAULT true,
    "showCta" BOOLEAN NOT NULL DEFAULT true,
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "announcementText" TEXT,
    "announcementTextAr" TEXT,
    "announcementLink" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);
