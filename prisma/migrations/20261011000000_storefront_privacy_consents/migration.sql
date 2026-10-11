-- Additive: anonymous storefront privacy decisions (see docs/privacy-consent.md).
-- visitor_key is the SHA-256 of a random browser token. No customer, order, IP or device data.
-- Rollback: DROP TABLE "storefront_privacy_consents";
-- CreateTable
CREATE TABLE "storefront_privacy_consents" (
    "visitor_key" CHAR(64) NOT NULL,
    "analytics" BOOLEAN,
    "marketing" BOOLEAN,
    "preferences" BOOLEAN,
    "sale_of_data" BOOLEAN,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_privacy_consents_pkey" PRIMARY KEY ("visitor_key")
);

-- CreateIndex
CREATE INDEX "storefront_privacy_consents_updated_at_idx" ON "storefront_privacy_consents"("updated_at");
