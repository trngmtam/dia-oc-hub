ALTER TABLE "leases"
ADD COLUMN "termination_requested_at" TIMESTAMP(3),
ADD COLUMN "termination_requested_note" TEXT,
ADD COLUMN "terminated_at" TIMESTAMP(3);

CREATE TABLE "unit_invite_codes" (
    "unit_invite_code_id" BIGSERIAL NOT NULL,
    "unit_id" BIGINT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_invite_codes_pkey" PRIMARY KEY ("unit_invite_code_id")
);

CREATE TABLE "unit_connection_requests" (
    "unit_connection_request_id" BIGSERIAL NOT NULL,
    "unit_id" BIGINT NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "invite_id" BIGINT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" BIGINT,
    "rejection_note" TEXT,

    CONSTRAINT "unit_connection_requests_pkey" PRIMARY KEY ("unit_connection_request_id")
);

CREATE TABLE "property_manager_invite_codes" (
    "property_manager_invite_code_id" BIGSERIAL NOT NULL,
    "property_id" BIGINT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_manager_invite_codes_pkey" PRIMARY KEY ("property_manager_invite_code_id")
);

CREATE TABLE "manager_assignment_requests" (
    "manager_assignment_request_id" BIGSERIAL NOT NULL,
    "property_id" BIGINT NOT NULL,
    "manager_id" BIGINT NOT NULL,
    "invite_id" BIGINT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" BIGINT,
    "rejection_note" TEXT,

    CONSTRAINT "manager_assignment_requests_pkey" PRIMARY KEY ("manager_assignment_request_id")
);

CREATE UNIQUE INDEX "unit_invite_codes_code_hash_key" ON "unit_invite_codes"("code_hash");
CREATE UNIQUE INDEX "unit_connection_requests_invite_id_tenant_id_key" ON "unit_connection_requests"("invite_id", "tenant_id");
CREATE UNIQUE INDEX "property_manager_invite_codes_code_hash_key" ON "property_manager_invite_codes"("code_hash");
CREATE UNIQUE INDEX "manager_assignment_requests_invite_id_manager_id_key" ON "manager_assignment_requests"("invite_id", "manager_id");
CREATE UNIQUE INDEX "leases_unit_id_active_key" ON "leases"("unit_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "unit_connection_requests_unit_id_pending_key" ON "unit_connection_requests"("unit_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "manager_assignment_requests_property_manager_pending_key" ON "manager_assignment_requests"("property_id", "manager_id") WHERE "status" = 'PENDING';

ALTER TABLE "unit_invite_codes" ADD CONSTRAINT "unit_invite_codes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_invite_codes" ADD CONSTRAINT "unit_invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_connection_requests" ADD CONSTRAINT "unit_connection_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_connection_requests" ADD CONSTRAINT "unit_connection_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_connection_requests" ADD CONSTRAINT "unit_connection_requests_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "unit_invite_codes"("unit_invite_code_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_connection_requests" ADD CONSTRAINT "unit_connection_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "property_manager_invite_codes" ADD CONSTRAINT "property_manager_invite_codes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_manager_invite_codes" ADD CONSTRAINT "property_manager_invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_assignment_requests" ADD CONSTRAINT "manager_assignment_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_assignment_requests" ADD CONSTRAINT "manager_assignment_requests_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_assignment_requests" ADD CONSTRAINT "manager_assignment_requests_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "property_manager_invite_codes"("property_manager_invite_code_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manager_assignment_requests" ADD CONSTRAINT "manager_assignment_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
