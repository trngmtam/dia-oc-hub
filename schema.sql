-- 1. ROLES

CREATE TABLE roles (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);


-- 2. USERS

CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id),

    CONSTRAINT chk_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);


-- 3. PROPERTIES

CREATE TABLE properties (
    property_id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    property_code VARCHAR(50) NOT NULL UNIQUE,
    property_name VARCHAR(255) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    ward VARCHAR(100),
    district VARCHAR(100),
    city VARCHAR(100),
    property_type VARCHAR(50),
    total_units INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_properties_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_properties_total_units
        CHECK (total_units > 0),

    CONSTRAINT chk_properties_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);


-- 4. PROPERTY MANAGER ASSIGNMENTS

CREATE TABLE property_manager_assignments (
    assignment_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    manager_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    salary_type VARCHAR(30) NOT NULL DEFAULT 'FIXED_MONTHLY',
    base_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
    commission_rate NUMERIC(10,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pma_property
        FOREIGN KEY (property_id)
        REFERENCES properties(property_id),

    CONSTRAINT fk_pma_manager
        FOREIGN KEY (manager_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_pma_salary_type
        CHECK (salary_type IN ('FIXED_MONTHLY', 'PER_PROPERTY', 'COMMISSION', 'HYBRID')),

    CONSTRAINT chk_pma_status
        CHECK (status IN ('ACTIVE', 'ENDED', 'SUSPENDED')),

    CONSTRAINT chk_pma_base_salary
        CHECK (base_salary >= 0),

    CONSTRAINT chk_pma_commission_rate
        CHECK (commission_rate >= 0)
);

-- Prevent duplicate active assignments for same property-manager pair starting same day
CREATE UNIQUE INDEX uq_pma_property_manager_start
ON property_manager_assignments(property_id, manager_id, start_date);


-- 5. UNITS

CREATE TABLE units (
    unit_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    unit_code VARCHAR(50) NOT NULL,
    unit_name VARCHAR(255),
    floor_number INT,
    bedroom_count INT,
    bathroom_count INT,
    area_sqm NUMERIC(10,2),
    furnishing_status VARCHAR(50),
    default_monthly_rent NUMERIC(15,2),
    default_deposit NUMERIC(15,2),
    occupancy_status VARCHAR(30) NOT NULL DEFAULT 'VACANT',
    vacant_since DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_units_property
        FOREIGN KEY (property_id)
        REFERENCES properties(property_id),

    CONSTRAINT uq_units_property_code
        UNIQUE (property_id, unit_code),

    CONSTRAINT chk_units_bedroom_count
        CHECK (bedroom_count IS NULL OR bedroom_count >= 0),

    CONSTRAINT chk_units_bathroom_count
        CHECK (bathroom_count IS NULL OR bathroom_count >= 0),

    CONSTRAINT chk_units_area
        CHECK (area_sqm IS NULL OR area_sqm >= 0),

    CONSTRAINT chk_units_default_monthly_rent
        CHECK (default_monthly_rent IS NULL OR default_monthly_rent >= 0),

    CONSTRAINT chk_units_default_deposit
        CHECK (default_deposit IS NULL OR default_deposit >= 0),

    CONSTRAINT chk_units_occupancy_status
        CHECK (occupancy_status IN ('VACANT', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE'))
);


-- 6. LEASES

CREATE TABLE leases (
    lease_id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL,
    tenant_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_day_of_month INT NOT NULL,
    base_rent NUMERIC(15,2) NOT NULL,
    deposit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    management_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    utility_note TEXT,
    penalty_type VARCHAR(30) NOT NULL DEFAULT 'NONE',
    penalty_rate NUMERIC(10,4) NOT NULL DEFAULT 0,
    penalty_flat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_leases_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT fk_leases_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_leases_dates
        CHECK (end_date > start_date),

    CONSTRAINT chk_leases_due_day
        CHECK (due_day_of_month BETWEEN 1 AND 31),

    CONSTRAINT chk_leases_base_rent
        CHECK (base_rent >= 0),

    CONSTRAINT chk_leases_deposit
        CHECK (deposit_amount >= 0),

    CONSTRAINT chk_leases_management_fee
        CHECK (management_fee >= 0),

    CONSTRAINT chk_leases_penalty_rate
        CHECK (penalty_rate >= 0),

    CONSTRAINT chk_leases_penalty_flat_amount
        CHECK (penalty_flat_amount >= 0),

    CONSTRAINT chk_leases_penalty_type
        CHECK (penalty_type IN ('NONE', 'DAILY_PERCENT', 'MONTHLY_PERCENT', 'FLAT_FEE')),

    CONSTRAINT chk_leases_status
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDING_SOON', 'EXPIRED', 'TERMINATED'))
);


-- 7. INVOICES

CREATE TABLE invoices (
    invoice_id BIGSERIAL PRIMARY KEY,
    lease_id BIGINT NOT NULL,
    invoice_code VARCHAR(50) NOT NULL UNIQUE,
    billing_year INT NOT NULL,
    billing_month INT NOT NULL,
    rent_amount NUMERIC(15,2) NOT NULL,
    utility_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    management_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    penalty_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    other_fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoices_lease
        FOREIGN KEY (lease_id)
        REFERENCES leases(lease_id),

    CONSTRAINT uq_invoices_lease_billing
        UNIQUE (lease_id, billing_year, billing_month),

    CONSTRAINT chk_invoices_billing_year
        CHECK (billing_year >= 2000),

    CONSTRAINT chk_invoices_billing_month
        CHECK (billing_month BETWEEN 1 AND 12),

    CONSTRAINT chk_invoices_rent_amount
        CHECK (rent_amount >= 0),

    CONSTRAINT chk_invoices_utility_amount
        CHECK (utility_amount >= 0),

    CONSTRAINT chk_invoices_management_fee_amount
        CHECK (management_fee_amount >= 0),

    CONSTRAINT chk_invoices_penalty_amount
        CHECK (penalty_amount >= 0),

    CONSTRAINT chk_invoices_other_fee_amount
        CHECK (other_fee_amount >= 0),

    CONSTRAINT chk_invoices_total_amount
        CHECK (total_amount >= 0),

    CONSTRAINT chk_invoices_status
        CHECK (status IN ('DRAFT', 'UNPAID', 'PROCESSING', 'PAID', 'OVERDUE', 'REJECTED', 'CANCELLED'))
);


-- 8. PAYMENTS

CREATE TABLE payments (
    payment_id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    payer_id BIGINT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transfer_reference VARCHAR(100),
    paid_amount NUMERIC(15,2) NOT NULL,
    payment_proof_url VARCHAR(500),
    payment_note TEXT,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_by BIGINT,
    verified_at TIMESTAMP,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT fk_payments_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(invoice_id),

    CONSTRAINT fk_payments_payer
        FOREIGN KEY (payer_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_payments_verified_by
        FOREIGN KEY (verified_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_payments_paid_amount
        CHECK (paid_amount > 0),

    CONSTRAINT chk_payments_verification_status
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'))
);


-- 9. EXPENSES

CREATE TABLE expenses (
    expense_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    unit_id BIGINT,
    assignment_id BIGINT,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    expense_date DATE NOT NULL,
    vendor_name VARCHAR(255),
    note TEXT,
    receipt_url VARCHAR(500),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_expenses_property
        FOREIGN KEY (property_id)
        REFERENCES properties(property_id),

    CONSTRAINT fk_expenses_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT fk_expenses_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES property_manager_assignments(assignment_id),

    CONSTRAINT fk_expenses_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(user_id),

    CONSTRAINT chk_expenses_amount
        CHECK (amount >= 0),

    CONSTRAINT chk_expenses_category
        CHECK (category IN (
            'MANAGER_SALARY',
            'CONTRACTOR_PAYMENT',
            'MAINTENANCE',
            'UTILITIES',
            'INSURANCE',
            'TAX',
            'CLEANING',
            'REPLACEMENT',
            'OTHER'
        ))
);


-- 10. ALERTS

CREATE TABLE alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT,
    unit_id BIGINT,
    lease_id BIGINT,
    invoice_id BIGINT,
    assignment_id BIGINT,
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    alert_date DATE NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_alerts_property
        FOREIGN KEY (property_id)
        REFERENCES properties(property_id),

    CONSTRAINT fk_alerts_unit
        FOREIGN KEY (unit_id)
        REFERENCES units(unit_id),

    CONSTRAINT fk_alerts_lease
        FOREIGN KEY (lease_id)
        REFERENCES leases(lease_id),

    CONSTRAINT fk_alerts_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(invoice_id),

    CONSTRAINT fk_alerts_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES property_manager_assignments(assignment_id),

    CONSTRAINT chk_alerts_type
        CHECK (alert_type IN (
            'UNIT_VACANT',
            'LEASE_ENDING_SOON',
            'PAYMENT_OVERDUE',
            'MANAGER_SALARY_DUE'
        )),

    CONSTRAINT chk_alerts_severity
        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    CONSTRAINT chk_alerts_status
        CHECK (status IN ('OPEN', 'READ', 'RESOLVED', 'DISMISSED'))
);


-- 11. ALERT RECIPIENTS

CREATE TABLE alert_recipients (
    alert_recipient_id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    notified_at TIMESTAMP,

    CONSTRAINT fk_alert_recipients_alert
        FOREIGN KEY (alert_id)
        REFERENCES alerts(alert_id),

    CONSTRAINT fk_alert_recipients_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT uq_alert_recipients_alert_user
        UNIQUE (alert_id, user_id)
);
