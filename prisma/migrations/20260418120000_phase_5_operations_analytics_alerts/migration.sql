ALTER TABLE "expenses"
ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "voided_at" TIMESTAMP(3),
ADD COLUMN "voided_by" BIGINT;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_voided_by_fkey"
FOREIGN KEY ("voided_by") REFERENCES "users"("user_id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "expenses_property_id_expense_date_idx"
ON "expenses"("property_id", "expense_date");

CREATE INDEX "expenses_created_by_status_idx"
ON "expenses"("created_by", "status");

ALTER TABLE "alerts"
ADD COLUMN "dedupe_key" VARCHAR(160),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "resolved_at" TIMESTAMP(3);

UPDATE "alerts"
SET "dedupe_key" = CONCAT('legacy-', "alert_id"::text)
WHERE "dedupe_key" IS NULL;

ALTER TABLE "alerts"
ALTER COLUMN "dedupe_key" SET NOT NULL;

CREATE UNIQUE INDEX "alerts_dedupe_key_key"
ON "alerts"("dedupe_key");

CREATE INDEX "alerts_status_alert_type_idx"
ON "alerts"("status", "alert_type");

CREATE INDEX "alerts_property_id_status_idx"
ON "alerts"("property_id", "status");
