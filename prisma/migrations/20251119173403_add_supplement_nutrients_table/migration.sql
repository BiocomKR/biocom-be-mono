-- DropTable
DROP TABLE IF EXISTS "product_nutrients";

-- CreateTable
CREATE TABLE "supplement_nutrients" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "nutrient_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "supplement_nutrients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplement_nutrients_product_id_idx" ON "supplement_nutrients"("product_id");

-- CreateIndex
CREATE INDEX "supplement_nutrients_nutrient_name_idx" ON "supplement_nutrients"("nutrient_name");

-- CreateIndex
CREATE UNIQUE INDEX "supplement_nutrients_product_id_nutrient_name_key" ON "supplement_nutrients"("product_id", "nutrient_name");

-- AddForeignKey
ALTER TABLE "supplement_nutrients" ADD CONSTRAINT "supplement_nutrients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
