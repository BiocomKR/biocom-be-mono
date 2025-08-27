-- ===================================================
-- 쇼핑몰 도메인 테이블 마이그레이션
-- 작성일: 2025-01-15
-- 작성자: Claude Code (형님 지도하에)
-- ===================================================

-- ===== 카테고리 관련 =====

-- 상품 카테고리 테이블
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "path" VARCHAR(500),
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- ===== 상품 관련 =====

-- 상품 마스터 테이블
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "product_type" VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
    "set_items" JSONB,
    "product_info" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- 상품 옵션 테이블
CREATE TABLE "product_options" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "option_name" VARCHAR(100) NOT NULL,
    "option_value" VARCHAR(100),
    "price" DECIMAL(10,0) NOT NULL,
    "max_order_qty" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

-- 상품 이미지 테이블
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "image_type" VARCHAR(20) NOT NULL DEFAULT 'SUB',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "alt_text" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- ===== 장바구니 관련 =====

-- 장바구니 테이블
CREATE TABLE "carts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- 장바구니 아이템 테이블
CREATE TABLE "cart_items" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_option_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "stock_checked_at" TIMESTAMP(3),
    "stock_available" BOOLEAN NOT NULL DEFAULT true,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- ===== 주문 관련 =====

-- 주문 테이블
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
    "inventory_status" VARCHAR(30) NOT NULL DEFAULT 'NOT_PROCESSED',
    "total_product_price" DECIMAL(10,0) NOT NULL,
    "total_discount" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "point_used" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,0) NOT NULL,
    "recipient_name" VARCHAR(100) NOT NULL,
    "recipient_phone" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "address_detail" VARCHAR(255),
    "delivery_message" TEXT,
    "ordered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- 주문 상품 테이블
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_option_id" INTEGER NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "option_name" VARCHAR(100),
    "product_price" DECIMAL(10,0) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,0) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- 주문 상태 변경 로그
CREATE TABLE "order_state_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "from_status" VARCHAR(50),
    "to_status" VARCHAR(50) NOT NULL,
    "changed_by" INTEGER,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_state_logs_pkey" PRIMARY KEY ("id")
);

-- ===== 결제 관련 =====

-- 결제 정보 테이블
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "pg_provider" VARCHAR(20) NOT NULL DEFAULT 'TOSS',
    "pg_transaction_id" VARCHAR(100),
    "payment_method" VARCHAR(30) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'READY',
    "amount" DECIMAL(10,0) NOT NULL,
    "point_amount" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "payment_details" JSONB,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "fail_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- 환불 정보 테이블
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "refund_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    "refund_amount" DECIMAL(10,0) NOT NULL,
    "point_refund" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "toss_cancel_id" VARCHAR(100),
    "toss_response" JSONB,
    "reason" VARCHAR(200) NOT NULL,
    "reason_detail" TEXT,
    "return_tracking_number" VARCHAR(100),
    "return_received_at" TIMESTAMP(3),
    "admin_id" INTEGER,
    "admin_memo" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- 환불 정책 테이블
CREATE TABLE "refund_policies" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "return_period_days" INTEGER NOT NULL DEFAULT 7,
    "auto_confirm_days" INTEGER NOT NULL DEFAULT 7,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_policies_pkey" PRIMARY KEY ("id")
);

-- ===== 배송 관련 =====

-- 배송 정보 테이블
CREATE TABLE "shippings" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "courier_code" VARCHAR(20),
    "courier_name" VARCHAR(50),
    "tracking_number" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'PREPARING',
    "shipping_fee" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "shipping_policy_id" INTEGER,
    "delivery_message" TEXT,
    "admin_memo" TEXT,
    "ready_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "shippings_pkey" PRIMARY KEY ("id")
);

-- 배송 추적 테이블
CREATE TABLE "shipping_tracks" (
    "id" SERIAL NOT NULL,
    "shipping_id" INTEGER NOT NULL,
    "location" VARCHAR(200),
    "status" VARCHAR(100),
    "description" TEXT,
    "tracked_at" TIMESTAMP(3) NOT NULL,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_tracks_pkey" PRIMARY KEY ("id")
);

-- 배송비 정책 테이블
CREATE TABLE "shipping_policies" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "base_fee" DECIMAL(10,0) NOT NULL DEFAULT 3000,
    "free_shipping_amount" DECIMAL(10,0),
    "jeju_extra_fee" DECIMAL(10,0) NOT NULL DEFAULT 3000,
    "island_extra_fee" DECIMAL(10,0) NOT NULL DEFAULT 5000,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_policies_pkey" PRIMARY KEY ("id")
);

-- ===== 재고 관리 (외부 API) =====

-- 재고 캐시 테이블
CREATE TABLE "inventory_cache" (
    "sku" VARCHAR(100) NOT NULL,
    "available_qty" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cache_pkey" PRIMARY KEY ("sku")
);

-- 재고 API 로그 테이블
CREATE TABLE "inventory_api_logs" (
    "id" SERIAL NOT NULL,
    "api_method" VARCHAR(30) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "request_data" JSONB,
    "response_data" JSONB,
    "response_status" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_api_logs_pkey" PRIMARY KEY ("id")
);

-- 재고 동기화 큐 테이블
CREATE TABLE "inventory_sync_queue" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "inventory_sync_queue_pkey" PRIMARY KEY ("id")
);

-- ===== 리뷰/문의 =====

-- 상품 리뷰 테이블
CREATE TABLE "product_reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_option_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "content" TEXT NOT NULL,
    "review_type" VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    "media_urls" JSONB,
    "is_best" BOOLEAN NOT NULL DEFAULT false,
    "best_selected_at" TIMESTAMP(3),
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "hidden_reason" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- 상품 문의 테이블
CREATE TABLE "product_questions" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "question_type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "has_answer" BOOLEAN NOT NULL DEFAULT false,
    "answered_by" INTEGER,
    "answered_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- ===== 부가 기능 =====

-- 찜하기 테이블
CREATE TABLE "wishlist" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- 최근 본 상품 테이블
CREATE TABLE "recently_viewed" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- ===== 인덱스 생성 =====

-- Categories
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- Products
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_sku_idx" ON "products"("sku");
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- ProductOptions
CREATE UNIQUE INDEX "product_options_sku_key" ON "product_options"("sku");
CREATE UNIQUE INDEX "product_options_product_id_option_name_key" ON "product_options"("product_id", "option_name");
CREATE INDEX "product_options_sku_idx" ON "product_options"("sku");

-- ProductImages
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

-- Carts
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CartItems
CREATE UNIQUE INDEX "cart_items_cart_id_product_option_id_key" ON "cart_items"("cart_id", "product_option_id");
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- Orders
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");
CREATE INDEX "orders_inventory_status_idx" ON "orders"("inventory_status");
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");
CREATE INDEX "orders_ordered_at_idx" ON "orders"("ordered_at");

-- OrderItems
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- OrderStateLogs
CREATE INDEX "order_state_logs_order_id_created_at_idx" ON "order_state_logs"("order_id", "created_at");

-- Payments
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");
CREATE UNIQUE INDEX "payments_pg_transaction_id_key" ON "payments"("pg_transaction_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_pg_transaction_id_idx" ON "payments"("pg_transaction_id");

-- Refunds
CREATE UNIQUE INDEX "refunds_order_id_key" ON "refunds"("order_id");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_requested_at_idx" ON "refunds"("requested_at");

-- Shippings
CREATE UNIQUE INDEX "shippings_order_id_key" ON "shippings"("order_id");
CREATE INDEX "shippings_tracking_number_idx" ON "shippings"("tracking_number");
CREATE INDEX "shippings_status_idx" ON "shippings"("status");

-- ShippingTracks
CREATE INDEX "shipping_tracks_shipping_id_tracked_at_idx" ON "shipping_tracks"("shipping_id", "tracked_at");

-- ShippingPolicies
CREATE INDEX "shipping_policies_is_active_is_default_idx" ON "shipping_policies"("is_active", "is_default");
CREATE INDEX "shipping_policies_valid_from_valid_until_idx" ON "shipping_policies"("valid_from", "valid_until");

-- InventoryCache
CREATE INDEX "inventory_cache_last_updated_idx" ON "inventory_cache"("last_updated");

-- InventoryApiLogs
CREATE INDEX "inventory_api_logs_sku_created_at_idx" ON "inventory_api_logs"("sku", "created_at");
CREATE INDEX "inventory_api_logs_response_status_idx" ON "inventory_api_logs"("response_status");

-- InventorySyncQueue
CREATE INDEX "inventory_sync_queue_status_idx" ON "inventory_sync_queue"("status");
CREATE INDEX "inventory_sync_queue_created_at_idx" ON "inventory_sync_queue"("created_at");

-- ProductReviews
CREATE UNIQUE INDEX "product_reviews_order_item_id_key" ON "product_reviews"("order_item_id");
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");
CREATE INDEX "product_reviews_user_id_idx" ON "product_reviews"("user_id");
CREATE INDEX "product_reviews_rating_idx" ON "product_reviews"("rating");
CREATE INDEX "product_reviews_is_best_idx" ON "product_reviews"("is_best");

-- ProductQuestions
CREATE INDEX "product_questions_product_id_status_idx" ON "product_questions"("product_id", "status");
CREATE INDEX "product_questions_parent_id_idx" ON "product_questions"("parent_id");
CREATE INDEX "product_questions_has_answer_idx" ON "product_questions"("has_answer");

-- Wishlist
CREATE UNIQUE INDEX "wishlist_user_id_product_id_key" ON "wishlist"("user_id", "product_id");
CREATE INDEX "wishlist_user_id_idx" ON "wishlist"("user_id");

-- RecentlyViewed
CREATE UNIQUE INDEX "recently_viewed_user_id_product_id_key" ON "recently_viewed"("user_id", "product_id");
CREATE INDEX "recently_viewed_user_id_viewed_at_idx" ON "recently_viewed"("user_id", "viewed_at");

-- ===== 외래키 제약 조건 =====

-- Categories
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Products
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductOptions
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductImages
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carts
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CartItems
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orders
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderItems
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderStateLogs
ALTER TABLE "order_state_logs" ADD CONSTRAINT "order_state_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payments
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Refunds
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shippings
ALTER TABLE "shippings" ADD CONSTRAINT "shippings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shippings" ADD CONSTRAINT "shippings_shipping_policy_id_fkey" FOREIGN KEY ("shipping_policy_id") REFERENCES "shipping_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ShippingTracks
ALTER TABLE "shipping_tracks" ADD CONSTRAINT "shipping_tracks_shipping_id_fkey" FOREIGN KEY ("shipping_id") REFERENCES "shippings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductReviews
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_option_id_fkey" FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductQuestions
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Wishlist
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecentlyViewed
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================================================
-- 마이그레이션 완료
-- ===================================================