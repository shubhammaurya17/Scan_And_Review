-- AlterTable: Add question type fields to QuestionTemplate
ALTER TABLE "QuestionTemplate" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'STAR_RATING';
ALTER TABLE "QuestionTemplate" ADD COLUMN "options" TEXT;
ALTER TABLE "QuestionTemplate" ADD COLUMN "placeholder" TEXT;

-- AlterTable: Add question type fields to BusinessQuestion
ALTER TABLE "BusinessQuestion" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'STAR_RATING';
ALTER TABLE "BusinessQuestion" ADD COLUMN "options" TEXT;
ALTER TABLE "BusinessQuestion" ADD COLUMN "placeholder" TEXT;

-- AlterTable: Make CustomerResponse.rating optional and add answer field
ALTER TABLE "CustomerResponse" ALTER COLUMN "rating" DROP NOT NULL;
ALTER TABLE "CustomerResponse" ADD COLUMN "answer" TEXT;
