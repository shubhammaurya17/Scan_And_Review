-- CreateTable: InsightTemplate (category-level default chips)
CREATE TABLE "InsightTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessInsight (per-business chips)
CREATE TABLE "BusinessInsight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SelectedInsight (customer selections per session)
CREATE TABLE "SelectedInsight" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelectedInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelectedInsight_sessionId_insightId_key" ON "SelectedInsight"("sessionId", "insightId");

-- AddForeignKey
ALTER TABLE "InsightTemplate" ADD CONSTRAINT "InsightTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessInsight" ADD CONSTRAINT "BusinessInsight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectedInsight" ADD CONSTRAINT "SelectedInsight_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectedInsight" ADD CONSTRAINT "SelectedInsight_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "BusinessInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
