ALTER TABLE "payments"
ADD COLUMN "payment_proof_path" VARCHAR(500),
ADD COLUMN "verification_note" TEXT;

CREATE TABLE "payment_receiving_accounts" (
    "payment_receiving_account_id" BIGSERIAL NOT NULL,
    "property_id" BIGINT NOT NULL,
    "bank_code" VARCHAR(50) NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "account_number" VARCHAR(100) NOT NULL,
    "account_name" VARCHAR(255) NOT NULL,
    "transfer_note_template" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receiving_accounts_pkey" PRIMARY KEY ("payment_receiving_account_id")
);

CREATE INDEX "payment_receiving_accounts_property_id_is_active_idx"
ON "payment_receiving_accounts"("property_id", "is_active");

CREATE UNIQUE INDEX "payment_receiving_accounts_property_active_key"
ON "payment_receiving_accounts"("property_id")
WHERE "is_active" = true;

ALTER TABLE "payment_receiving_accounts"
ADD CONSTRAINT "payment_receiving_accounts_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("property_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
