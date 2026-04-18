
-- 1. ROLES

INSERT INTO roles (role_name) VALUES
('OWNER'),
('MANAGER'),
('TENANT'),
('ADMIN');


-- 2. USERS

INSERT INTO users (full_name, email, phone, password_hash, role_id, status)
VALUES
('Nguyen Minh Chau', 'owner@pmh.com', '0909000001', 'demo_hash_owner', 1, 'ACTIVE'),
('Tran Gia Huy', 'manager@pmh.com', '0909000002', 'demo_hash_manager', 2, 'ACTIVE'),
('Le Bao Han', 'tenant1@pmh.com', '0909000003', 'demo_hash_tenant1', 3, 'ACTIVE'),
('Pham Quoc Viet', 'tenant2@pmh.com', '0909000004', 'demo_hash_tenant2', 3, 'ACTIVE'),
('Vo Thu Trang', 'tenant3@pmh.com', '0909000005', 'demo_hash_tenant3', 3, 'ACTIVE'),
('Nguyen Hoang Nam', 'tenant4@pmh.com', '0909000006', 'demo_hash_tenant4', 3, 'ACTIVE'),
('System Admin', 'admin@pmh.com', '0909000007', 'demo_hash_admin', 4, 'ACTIVE');


-- 3. PROPERTIES
-- owner_id = 1

INSERT INTO properties (
    owner_id,
    property_code,
    property_name,
    address_line,
    ward,
    district,
    city,
    property_type,
    total_units,
    status
)
VALUES
(1, 'PMH001', 'The Ascentia Tower A', 'Nguyen Luong Bang, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH002', 'The Ascentia Tower B', 'Nguyen Luong Bang, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH003', 'Midtown M5 Residence', 'Midtown, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH004', 'Midtown M6 Residence', 'Midtown, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH005', 'Midtown M8 Residence', 'Midtown, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH006', 'The Antonia Residence', 'Nguyen Luong Bang, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH007', 'Urban Hill Residence', 'Nguyen Van Linh, Phu My Hung', 'Tan Phong', 'District 7', 'Ho Chi Minh City', 'HIGH_END_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH008', 'Cardinal Court Residence', 'Phu My Hung International Business District', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'LUXURY_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH009', 'Star Hill Residence', 'Crescent Area, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'HIGH_END_APARTMENT', 1, 'ACTIVE'),
(1, 'PMH010', 'Scenic Valley Residence', 'Nguyen Van Linh, Phu My Hung', 'Tan Phu', 'District 7', 'Ho Chi Minh City', 'HIGH_END_APARTMENT', 1, 'ACTIVE');


-- 4. PROPERTY MANAGER ASSIGNMENTS
-- manager_id = 2 manages all 10 properties

INSERT INTO property_manager_assignments (
    property_id,
    manager_id,
    start_date,
    end_date,
    salary_type,
    base_salary,
    commission_rate,
    status
)
SELECT
    property_id,
    2,
    DATE '2026-01-01',
    NULL,
    'FIXED_MONTHLY',
    25000000,
    0,
    'ACTIVE'
FROM properties
ORDER BY property_id;


-- 5. UNITS


INSERT INTO units (
    property_id,
    unit_code,
    unit_name,
    floor_number,
    bedroom_count,
    bathroom_count,
    area_sqm,
    furnishing_status,
    default_monthly_rent,
    default_deposit,
    occupancy_status,
    vacant_since
)
VALUES
(1,  'A-1205', 'The Ascentia A-1205', 12, 2, 2, 78.0, 'FULLY_FURNISHED', 26000000, 52000000, 'OCCUPIED', NULL),
(2,  'B-1502', 'The Ascentia B-1502', 15, 3, 2, 110.0, 'FULLY_FURNISHED', 42000000, 84000000, 'VACANT', '2026-03-08'),
(3,  'M5-0801', 'Midtown M5-0801', 8, 2, 2, 82.0, 'FULLY_FURNISHED', 29000000, 58000000, 'OCCUPIED', NULL),
(4,  'M6-1803', 'Midtown M6-1803', 18, 3, 2, 118.0, 'FULLY_FURNISHED', 45000000, 90000000, 'OCCUPIED', NULL),
(5,  'M8-2207', 'Midtown M8-2207', 22, 2, 2, 89.0, 'DESIGNER_FURNISHED', 34000000, 68000000, 'VACANT', '2026-03-15'),
(6,  'ANT-1604', 'The Antonia 1604', 16, 2, 2, 79.0, 'FULLY_FURNISHED', 30000000, 60000000, 'OCCUPIED', NULL),
(7,  'UH-0902', 'Urban Hill 0902', 9, 2, 2, 78.0, 'SEMI_FURNISHED', 22000000, 44000000, 'VACANT', '2026-03-01'),
(8,  'CC-1401', 'Cardinal Court 1401', 14, 3, 2, 107.0, 'FULLY_FURNISHED', 39000000, 78000000, 'OCCUPIED', NULL),
(9,  'SH-1106', 'Star Hill 1106', 11, 2, 2, 86.0, 'FULLY_FURNISHED', 28000000, 56000000, 'OCCUPIED', NULL),
(10, 'SV-1708', 'Scenic Valley 1708', 17, 1, 1, 70.0, 'FULLY_FURNISHED', 21000000, 42000000, 'VACANT', '2026-03-20');


-- 6. LEASES
-- 6 occupied units get leases

INSERT INTO leases (
    unit_id,
    tenant_id,
    start_date,
    end_date,
    due_day_of_month,
    base_rent,
    deposit_amount,
    management_fee,
    utility_note,
    penalty_type,
    penalty_rate,
    penalty_flat_amount,
    status
)
VALUES
(1, 3, '2025-10-01', '2026-09-30', 5, 26000000, 52000000, 1200000, 'Utilities billed monthly', 'DAILY_PERCENT', 0.0100, 0, 'ACTIVE'),
(3, 4, '2025-11-15', '2026-11-14', 5, 29000000, 58000000, 1300000, 'Utilities billed monthly', 'DAILY_PERCENT', 0.0100, 0, 'ACTIVE'),
(4, 5, '2025-05-01', '2026-04-15', 10, 45000000, 90000000, 1800000, 'Utilities billed monthly', 'FLAT_FEE', 0, 500000, 'ENDING_SOON'),
(6, 6, '2025-08-01', '2026-07-31', 7, 30000000, 60000000, 1400000, 'Utilities billed monthly', 'DAILY_PERCENT', 0.0080, 0, 'ACTIVE'),
(8, 4, '2025-09-10', '2026-09-09', 8, 39000000, 78000000, 1700000, 'Utilities billed monthly', 'DAILY_PERCENT', 0.0100, 0, 'ACTIVE'),
(9, 5, '2025-12-01', '2026-11-30', 5, 28000000, 56000000, 1200000, 'Utilities billed monthly', 'DAILY_PERCENT', 0.0100, 0, 'ACTIVE');


-- 7. INVOICES
-- March 2026 billing

INSERT INTO invoices (
    lease_id,
    invoice_code,
    billing_year,
    billing_month,
    rent_amount,
    utility_amount,
    management_fee_amount,
    penalty_amount,
    other_fee_amount,
    total_amount,
    due_date,
    status
)
VALUES
(1, 'INV-2026-03-A1205', 2026, 3, 26000000, 950000, 1200000, 0,      0, 28150000, '2026-03-05', 'PAID'),
(2, 'INV-2026-03-M50801', 2026, 3, 29000000, 1100000, 1300000, 0,     0, 31400000, '2026-03-05', 'PAID'),
(3, 'INV-2026-03-M61803', 2026, 3, 45000000, 1600000, 1800000, 500000, 0, 48900000, '2026-03-10', 'OVERDUE'),
(4, 'INV-2026-03-ANT1604', 2026, 3, 30000000, 1000000, 1400000, 0,     0, 32400000, '2026-03-07', 'PROCESSING'),
(5, 'INV-2026-03-CC1401', 2026, 3, 39000000, 1450000, 1700000, 0,      0, 42150000, '2026-03-08', 'UNPAID'),
(6, 'INV-2026-03-SH1106', 2026, 3, 28000000, 900000, 1200000, 0,       0, 30100000, '2026-03-05', 'PAID');


-- 8. PAYMENTS
-- Some verified, one pending

INSERT INTO payments (
    invoice_id,
    payer_id,
    payment_method,
    transfer_reference,
    paid_amount,
    payment_proof_url,
    payment_note,
    submitted_at,
    verified_by,
    verified_at,
    verification_status
)
VALUES
(1, 3, 'BANK_TRANSFER', 'TXN-A1205-032026', 28150000, 'https://example.com/proof-a1205.jpg',  'March payment for A-1205', '2026-03-04 09:00:00', 1, '2026-03-04 12:00:00', 'VERIFIED'),
(2, 4, 'BANK_TRANSFER', 'TXN-M50801-032026', 31400000, 'https://example.com/proof-m50801.jpg', 'March payment for M5-0801', '2026-03-04 10:00:00', 1, '2026-03-04 13:00:00', 'VERIFIED'),
(4, 6, 'BANK_TRANSFER', 'TXN-ANT1604-032026', 32400000, 'https://example.com/proof-ant1604.jpg', 'March payment for ANT-1604', '2026-03-07 11:30:00', NULL, NULL, 'PENDING'),
(6, 5, 'BANK_TRANSFER', 'TXN-SH1106-032026', 30100000, 'https://example.com/proof-sh1106.jpg', 'March payment for SH-1106', '2026-03-05 08:45:00', 1, '2026-03-05 11:00:00', 'VERIFIED');


-- 9. EXPENSES
-- Manager salary + operating costs

INSERT INTO expenses (
    property_id,
    unit_id,
    assignment_id,
    category,
    amount,
    expense_date,
    vendor_name,
    note,
    receipt_url,
    created_by
)
VALUES
(1,  NULL, 1,  'MANAGER_SALARY',   25000000, '2026-03-31', 'Tran Gia Huy',         'March portfolio manager salary', 'https://example.com/receipt-manager-salary-march.pdf', 1),
(1,  1,    NULL, 'MAINTENANCE',     2800000,  '2026-03-18', 'Daikin Service',       'AC maintenance for The Ascentia A-1205', 'https://example.com/receipt-ac-a1205.pdf', 1),
(4,  4,    NULL, 'MAINTENANCE',     6500000,  '2026-03-12', 'Luxury Home Care',     'Kitchen cabinet repair for Midtown M6-1803', 'https://example.com/receipt-m61803.pdf', 1),
(8,  NULL, NULL, 'TAX',             7800000,  '2026-03-20', 'District 7 Tax Office','Quarterly rental tax payment', 'https://example.com/receipt-tax-q1.pdf', 1),
(9,  9,    NULL, 'CLEANING',        1200000,  '2026-03-09', 'Premium Clean Co.',    'Deep cleaning after tenant request', 'https://example.com/receipt-clean-sh1106.pdf', 1),
(10, NULL, NULL, 'INSURANCE',       3500000,  '2026-03-15', 'Bao Viet',             'Annual unit insurance renewal', 'https://example.com/receipt-insurance-sv1708.pdf', 1);


-- 10. ALERTS
-- Vacancy + lease ending + overdue + salary due

INSERT INTO alerts (
    property_id,
    unit_id,
    lease_id,
    invoice_id,
    assignment_id,
    alert_type,
    title,
    description,
    alert_date,
    severity,
    status
)
VALUES
(2,  2, NULL, NULL, 2, 'UNIT_VACANT',        'The Ascentia B-1502 is vacant',   'Unit B-1502 has been vacant since 2026-03-08.', '2026-03-29', 'HIGH',     'OPEN'),
(5,  5, NULL, NULL, 5, 'UNIT_VACANT',        'Midtown M8-2207 is vacant',       'Unit M8-2207 has been vacant since 2026-03-15.', '2026-03-29', 'MEDIUM',   'OPEN'),
(7,  7, NULL, NULL, 7, 'UNIT_VACANT',        'Urban Hill 0902 is vacant',       'Unit UH-0902 has been vacant since 2026-03-01.', '2026-03-29', 'HIGH',     'OPEN'),
(10, 10, NULL, NULL, 10, 'UNIT_VACANT',      'Scenic Valley 1708 is vacant',    'Unit SV-1708 has been vacant since 2026-03-20.', '2026-03-29', 'MEDIUM',   'OPEN'),
(4,  4, 3, NULL, 4, 'LEASE_ENDING_SOON',     'Lease for Midtown M6-1803 ending soon', 'Lease will end on 2026-04-15 and requires renewal follow-up.', '2026-03-29', 'CRITICAL', 'OPEN'),
(4,  4, 3, 3, 4, 'PAYMENT_OVERDUE',          'March invoice for Midtown M6-1803 is overdue', 'Invoice INV-2026-03-M61803 is overdue and requires owner/manager action.', '2026-03-29', 'HIGH', 'OPEN'),
(1,  NULL, NULL, NULL, 1, 'MANAGER_SALARY_DUE', 'Manager salary due for March', 'Portfolio manager salary should be recorded and reviewed at month end.', '2026-03-29', 'MEDIUM', 'OPEN');

-- =========================================
-- 11. ALERT RECIPIENTS
-- Owner = user_id 1
-- Manager = user_id 2
-- =========================================
INSERT INTO alert_recipients (
    alert_id,
    user_id,
    is_read,
    read_at,
    notified_at
)
VALUES
(1, 1, FALSE, NULL, '2026-03-29 08:00:00'),
(1, 2, FALSE, NULL, '2026-03-29 08:00:00'),
(2, 1, FALSE, NULL, '2026-03-29 08:05:00'),
(2, 2, TRUE,  '2026-03-29 09:00:00', '2026-03-29 08:05:00'),
(3, 1, FALSE, NULL, '2026-03-29 08:10:00'),
(3, 2, FALSE, NULL, '2026-03-29 08:10:00'),
(4, 1, FALSE, NULL, '2026-03-29 08:15:00'),
(4, 2, FALSE, NULL, '2026-03-29 08:15:00'),
(5, 1, FALSE, NULL, '2026-03-29 08:20:00'),
(5, 2, FALSE, NULL, '2026-03-29 08:20:00'),
(6, 1, FALSE, NULL, '2026-03-29 08:25:00'),
(6, 2, FALSE, NULL, '2026-03-29 08:25:00'),
(7, 1, TRUE,  '2026-03-29 10:00:00', '2026-03-29 08:30:00'),
(7, 2, FALSE, NULL, '2026-03-29 08:30:00');
