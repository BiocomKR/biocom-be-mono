-- CreateTable: 건강 타입 동물별 추천 영양제 관계 테이블
-- 각 동물 타입별로 맞춤 영양제 정보를 관리 (최대 3개)
CREATE TABLE "health_type_animal_products" (
    "id" SERIAL NOT NULL,
    "health_type_animal_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "health_type_animal_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_type_animal_products_health_type_animal_id_idx" ON "health_type_animal_products"("health_type_animal_id");

CREATE INDEX "health_type_animal_products_product_id_idx" ON "health_type_animal_products"("product_id");

CREATE INDEX "health_type_animal_products_is_active_idx" ON "health_type_animal_products"("is_active");

CREATE UNIQUE INDEX "health_type_animal_products_health_type_animal_id_display_order_key" ON "health_type_animal_products"("health_type_animal_id", "display_order");

CREATE UNIQUE INDEX "health_type_animal_products_health_type_animal_id_product_id_key" ON "health_type_animal_products"("health_type_animal_id", "product_id");

-- AddForeignKey
ALTER TABLE "health_type_animal_products" ADD CONSTRAINT "health_type_animal_products_health_type_animal_id_fkey" FOREIGN KEY ("health_type_animal_id") REFERENCES "health_type_animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "health_type_animal_products" ADD CONSTRAINT "health_type_animal_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
