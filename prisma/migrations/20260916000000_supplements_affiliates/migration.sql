-- CreateTable
CREATE TABLE "supplements_affiliate_profiles" (
    "id" TEXT NOT NULL,
    "portal_user_id" INTEGER,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT,
    "promo_code" TEXT NOT NULL,
    "instagram" TEXT,
    "tiktok" TEXT,
    "website" TEXT,
    "portal_role" TEXT NOT NULL DEFAULT 'affiliate',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "recurring_commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "coupon_rate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "referrer_id" TEXT,
    "referral_commission_rate" DOUBLE PRECISION,
    "bonus_threshold" DOUBLE PRECISION,
    "bonus_rate" DOUBLE PRECISION,
    "shopify_customer_id" DOUBLE PRECISION,
    "reviewed_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "welcome_coupon_code" TEXT,
    "notify_on_order" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_payout" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_referral_accepted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_affiliate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_tiktok_submissions" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_tiktok_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_tiktok_bonus_config" (
    "id" TEXT NOT NULL,
    "amounts_json" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_tiktok_bonus_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_app_portal_config" (
    "id" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_app_portal_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_bank_accounts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "last4" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_affiliate_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_orders" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "shopify_order_id" DOUBLE PRECISION,
    "shopify_customer_id" DOUBLE PRECISION,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "order_total" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "commission_rate_snapshot" DOUBLE PRECISION,
    "source_updated_at" TIMESTAMP(3),
    "match_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout_id" TEXT,
    "source_affiliate_id" TEXT,
    "items" JSONB,
    "subtotal" DOUBLE PRECISION,
    "discount_total" DOUBLE PRECISION,
    "shipping_total" DOUBLE PRECISION,
    "tax_total" DOUBLE PRECISION,
    "currency" TEXT,
    "coupon_code" TEXT,
    "items_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaderboard_cycle_key" TEXT,
    "leaderboard_rank" INTEGER,

    CONSTRAINT "supplements_affiliate_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_by_portal_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_payout_items" (
    "id" TEXT NOT NULL,
    "payout_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "supplements_affiliate_payout_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_portal_user_id" INTEGER,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target_affiliate_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_affiliate_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload_hash" TEXT,
    "result" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "supplements_affiliate_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_password_resets" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_affiliate_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "read_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_admin_notes" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "tag" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "author_email" TEXT NOT NULL,
    "author_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_inventory_items" (
    "id" TEXT NOT NULL,
    "shopify_product_id" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_inventory_purchases" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "order_id" TEXT,
    "units" INTEGER NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_inventory_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_leaderboard_cycles" (
    "cycle_key" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_leaderboard_cycles_pkey" PRIMARY KEY ("cycle_key")
);

-- CreateTable
CREATE TABLE "supplements_leaderboard_settlement_state" (
    "id" TEXT NOT NULL,
    "first_cycle_start" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_leaderboard_settlement_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_leaderboard_prize_configs" (
    "id" TEXT NOT NULL,
    "cycle_key" TEXT NOT NULL,
    "first" DOUBLE PRECISION NOT NULL,
    "second" DOUBLE PRECISION NOT NULL,
    "third" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_leaderboard_prize_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_supplier_orders" (
    "id" TEXT NOT NULL,
    "supplier" TEXT,
    "note" TEXT,
    "ordered_at" TIMESTAMP(3) NOT NULL,
    "arrived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_supplier_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_manual_sales" (
    "id" TEXT NOT NULL,
    "shopify_product_id" DOUBLE PRECISION NOT NULL,
    "product_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sale',
    "units" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "sold_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_manual_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_pending_products" (
    "id" TEXT NOT NULL,
    "synthetic_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_shopify_id" DOUBLE PRECISION,
    "matched_at" TIMESTAMP(3),

    CONSTRAINT "supplements_pending_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_inventory_adjustments" (
    "id" TEXT NOT NULL,
    "shopify_product_id" DOUBLE PRECISION NOT NULL,
    "product_name" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "adjusted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_business_expenses" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_business_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 25,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_email_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_email_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_affiliate_messages" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "read_by_affiliate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_affiliate_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_portal_accounts" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'affiliate',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplements_portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplements_portal_sessions" (
    "tokenHash" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_portal_sessions_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "supplements_portal_rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_portal_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_profiles_portal_user_id_key" ON "supplements_affiliate_profiles"("portal_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_profiles_email_key" ON "supplements_affiliate_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_profiles_promo_code_key" ON "supplements_affiliate_profiles"("promo_code");

-- CreateIndex
CREATE INDEX "supplements_tiktok_submissions_affiliate_id_created_at_idx" ON "supplements_tiktok_submissions"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "supplements_tiktok_submissions_created_at_idx" ON "supplements_tiktok_submissions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_tiktok_submissions_affiliate_id_url_key" ON "supplements_tiktok_submissions"("affiliate_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_bank_accounts_affiliate_id_key" ON "supplements_affiliate_bank_accounts"("affiliate_id");

-- CreateIndex
CREATE INDEX "supplements_affiliate_orders_affiliate_id_idx" ON "supplements_affiliate_orders"("affiliate_id");

-- CreateIndex
CREATE INDEX "supplements_affiliate_orders_shopify_order_id_idx" ON "supplements_affiliate_orders"("shopify_order_id");

-- CreateIndex
CREATE INDEX "supplements_affiliate_orders_customer_email_idx" ON "supplements_affiliate_orders"("customer_email");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_orders_leaderboard_cycle_key_leaderbo_key" ON "supplements_affiliate_orders"("leaderboard_cycle_key", "leaderboard_rank");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_orders_leaderboard_cycle_key_affiliat_key" ON "supplements_affiliate_orders"("leaderboard_cycle_key", "affiliate_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_orders_shopify_order_id_affiliate_id__key" ON "supplements_affiliate_orders"("shopify_order_id", "affiliate_id", "match_type");

-- CreateIndex
CREATE INDEX "supplements_affiliate_payouts_affiliate_id_idx" ON "supplements_affiliate_payouts"("affiliate_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_payout_items_order_id_key" ON "supplements_affiliate_payout_items"("order_id");

-- CreateIndex
CREATE INDEX "supplements_affiliate_audit_logs_target_affiliate_id_idx" ON "supplements_affiliate_audit_logs"("target_affiliate_id");

-- CreateIndex
CREATE INDEX "supplements_affiliate_audit_logs_created_at_idx" ON "supplements_affiliate_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_webhook_events_provider_external_id_key" ON "supplements_affiliate_webhook_events"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_affiliate_password_resets_token_hash_key" ON "supplements_affiliate_password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "supplements_affiliate_password_resets_email_idx" ON "supplements_affiliate_password_resets"("email");

-- CreateIndex
CREATE INDEX "supplements_contact_messages_status_idx" ON "supplements_contact_messages"("status");

-- CreateIndex
CREATE INDEX "supplements_contact_messages_created_at_idx" ON "supplements_contact_messages"("created_at");

-- CreateIndex
CREATE INDEX "supplements_admin_notes_pinned_updated_at_idx" ON "supplements_admin_notes"("pinned", "updated_at");

-- CreateIndex
CREATE INDEX "supplements_admin_notes_created_at_idx" ON "supplements_admin_notes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_inventory_items_shopify_product_id_key" ON "supplements_inventory_items"("shopify_product_id");

-- CreateIndex
CREATE INDEX "supplements_inventory_purchases_item_id_purchased_at_idx" ON "supplements_inventory_purchases"("item_id", "purchased_at");

-- CreateIndex
CREATE INDEX "supplements_inventory_purchases_purchased_at_idx" ON "supplements_inventory_purchases"("purchased_at");

-- CreateIndex
CREATE INDEX "supplements_inventory_purchases_order_id_idx" ON "supplements_inventory_purchases"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_leaderboard_prize_configs_cycle_key_key" ON "supplements_leaderboard_prize_configs"("cycle_key");

-- CreateIndex
CREATE INDEX "supplements_supplier_orders_ordered_at_idx" ON "supplements_supplier_orders"("ordered_at");

-- CreateIndex
CREATE INDEX "supplements_manual_sales_shopify_product_id_sold_at_idx" ON "supplements_manual_sales"("shopify_product_id", "sold_at");

-- CreateIndex
CREATE INDEX "supplements_manual_sales_sold_at_idx" ON "supplements_manual_sales"("sold_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_pending_products_synthetic_id_key" ON "supplements_pending_products"("synthetic_id");

-- CreateIndex
CREATE INDEX "supplements_inventory_adjustments_shopify_product_id_adjust_idx" ON "supplements_inventory_adjustments"("shopify_product_id", "adjusted_at");

-- CreateIndex
CREATE INDEX "supplements_inventory_adjustments_adjusted_at_idx" ON "supplements_inventory_adjustments"("adjusted_at");

-- CreateIndex
CREATE INDEX "supplements_business_expenses_incurred_at_idx" ON "supplements_business_expenses"("incurred_at");

-- CreateIndex
CREATE INDEX "supplements_email_campaigns_status_idx" ON "supplements_email_campaigns"("status");

-- CreateIndex
CREATE INDEX "supplements_email_campaign_recipients_campaign_id_status_idx" ON "supplements_email_campaign_recipients"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_email_campaign_recipients_campaign_id_email_key" ON "supplements_email_campaign_recipients"("campaign_id", "email");

-- CreateIndex
CREATE INDEX "supplements_affiliate_messages_affiliate_id_created_at_idx" ON "supplements_affiliate_messages"("affiliate_id", "created_at");

-- CreateIndex
CREATE INDEX "supplements_affiliate_messages_read_by_admin_idx" ON "supplements_affiliate_messages"("read_by_admin");

-- CreateIndex
CREATE UNIQUE INDEX "supplements_portal_accounts_email_key" ON "supplements_portal_accounts"("email");

-- CreateIndex
CREATE INDEX "supplements_portal_sessions_accountId_idx" ON "supplements_portal_sessions"("accountId");

-- CreateIndex
CREATE INDEX "supplements_portal_rate_limits_expiresAt_idx" ON "supplements_portal_rate_limits"("expiresAt");

-- AddForeignKey
ALTER TABLE "supplements_affiliate_profiles" ADD CONSTRAINT "supplements_affiliate_profiles_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_tiktok_submissions" ADD CONSTRAINT "supplements_tiktok_submissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_bank_accounts" ADD CONSTRAINT "supplements_affiliate_bank_accounts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_orders" ADD CONSTRAINT "supplements_affiliate_orders_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_orders" ADD CONSTRAINT "supplements_affiliate_orders_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "supplements_affiliate_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_orders" ADD CONSTRAINT "supplements_affiliate_orders_leaderboard_cycle_key_fkey" FOREIGN KEY ("leaderboard_cycle_key") REFERENCES "supplements_leaderboard_cycles"("cycle_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_payouts" ADD CONSTRAINT "supplements_affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_payout_items" ADD CONSTRAINT "supplements_affiliate_payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "supplements_affiliate_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_payout_items" ADD CONSTRAINT "supplements_affiliate_payout_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supplements_affiliate_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_affiliate_audit_logs" ADD CONSTRAINT "supplements_affiliate_audit_logs_target_affiliate_id_fkey" FOREIGN KEY ("target_affiliate_id") REFERENCES "supplements_affiliate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_inventory_purchases" ADD CONSTRAINT "supplements_inventory_purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "supplements_inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_inventory_purchases" ADD CONSTRAINT "supplements_inventory_purchases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supplements_supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_email_campaign_recipients" ADD CONSTRAINT "supplements_email_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "supplements_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplements_portal_sessions" ADD CONSTRAINT "supplements_portal_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "supplements_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
