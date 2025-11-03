-- AlterTable
ALTER TABLE "ai_personas" 
ADD COLUMN "intro_title" VARCHAR(200),
ADD COLUMN "intro_content" TEXT,
ADD COLUMN "hashtags" TEXT,
ADD COLUMN "feature_title" VARCHAR(200),
ADD COLUMN "feature_content" TEXT,
ADD COLUMN "speech_title" VARCHAR(200),
ADD COLUMN "speech_content" TEXT,
ADD COLUMN "speech_image_url" VARCHAR(500),
ADD COLUMN "intimacy_title" VARCHAR(200),
ADD COLUMN "intimacy_content" TEXT,
ADD COLUMN "intimacy_image_url" VARCHAR(500);
