-- 쿠폰 고도화 마이그레이션
-- scopeType, categoryCode 추가 및 productId nullable 변경
-- CouponProduct 다대다 관계 테이블 추가

-- 1. coupon_products 테이블 생성
CREATE TABLE IF NOT EXISTS `coupon_products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `coupon_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_products_coupon_id_product_id_key` (`coupon_id`, `product_id`),
  INDEX `coupon_products_coupon_id_idx` (`coupon_id`),
  INDEX `coupon_products_product_id_idx` (`product_id`),
  CONSTRAINT `coupon_products_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `coupon_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. coupons 테이블에 scope_type, category_code 컬럼 추가
ALTER TABLE `coupons`
ADD COLUMN IF NOT EXISTS `scope_type` VARCHAR(20) NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN IF NOT EXISTS `category_code` VARCHAR(50) NULL;

-- 3. 기존 쿠폰 데이터 마이그레이션
-- 기존 쿠폰은 모두 scopeType='PRODUCT'로 유지 (productId 있는 경우)
-- productId가 있는 쿠폰은 coupon_products 테이블에도 관계 추가

-- 기존 productId가 있는 쿠폰들을 coupon_products에 복사
INSERT INTO `coupon_products` (`coupon_id`, `product_id`, `created_at`)
SELECT `id`, `product_id`, NOW()
FROM `coupons`
WHERE `product_id` IS NOT NULL
ON DUPLICATE KEY UPDATE `product_id` = `product_id`;

-- 4. product_id를 nullable로 변경
ALTER TABLE `coupons`
MODIFY COLUMN `product_id` INT NULL;

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS `coupons_scope_type_is_active_idx` ON `coupons` (`scope_type`, `is_active`);
CREATE INDEX IF NOT EXISTS `coupons_category_code_is_active_idx` ON `coupons` (`category_code`, `is_active`);
CREATE INDEX IF NOT EXISTS `coupons_product_id_is_active_idx` ON `coupons` (`product_id`, `is_active`);
