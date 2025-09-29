-- CreateTable
CREATE TABLE "user_custom_supplements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "dosage" VARCHAR(50),
    "memo" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "user_custom_supplements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_custom_supplements_user_id_idx" ON "user_custom_supplements"("user_id");

-- CreateIndex
CREATE INDEX "user_custom_supplements_user_id_is_active_idx" ON "user_custom_supplements"("user_id", "is_active");

-- AddForeignKey
ALTER TABLE "user_custom_supplements" ADD CONSTRAINT "user_custom_supplements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;