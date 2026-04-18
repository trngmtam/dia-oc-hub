-- quick test
-- SELECT property_id, property_name FROM properties ORDER BY property_id;

-- SELECT unit_code, unit_name, default_monthly_rent, occupancy_status
-- FROM units
-- ORDER BY unit_id;


-- SELECT invoice_code, total_amount, status
-- FROM invoices
-- ORDER BY invoice_id;


-- SELECT category, amount, expense_date
-- FROM expenses
-- ORDER BY expense_id;



-- Owner dashboard summary
SELECT
    (SELECT COUNT(*) FROM properties) AS total_properties,
    (SELECT COUNT(*) FROM units) AS total_units,
    (SELECT COUNT(*) FROM units WHERE occupancy_status = 'OCCUPIED') AS occupied_units,
    (SELECT COUNT(*) FROM units WHERE occupancy_status = 'VACANT') AS vacant_units,
    (SELECT COUNT(*) FROM leases WHERE status = 'ACTIVE') AS active_leases,
    (SELECT COUNT(*) FROM leases WHERE status = 'ENDING_SOON') AS ending_soon_leases,
    (SELECT COUNT(*) FROM invoices WHERE status = 'OVERDUE') AS overdue_invoices,
    (SELECT COUNT(*) FROM invoices WHERE status IN ('UNPAID', 'PROCESSING')) AS pending_invoices;

-- Total monthly revenue expected
SELECT
    billing_year,
    billing_month,
    COUNT(*) AS total_invoices,
    SUM(total_amount) AS expected_revenue
FROM invoices
WHERE billing_year = 2026
  AND billing_month = 3
GROUP BY billing_year, billing_month;

--owner outcome summary
SELECT
    category,
    COUNT(*) AS expense_count,
    SUM(amount) AS total_expense
FROM expenses
GROUP BY category
ORDER BY total_expense DESC;

-- net owner
SELECT
    COALESCE((
        SELECT SUM(total_amount)
        FROM invoices
        WHERE billing_year = 2026
          AND billing_month = 3
          AND status = 'PAID'
    ), 0) AS collected_revenue,
    COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE DATE_TRUNC('month', expense_date) = DATE '2026-03-01'
    ), 0) AS total_outcome,
    COALESCE((
        SELECT SUM(total_amount)
        FROM invoices
        WHERE billing_year = 2026
          AND billing_month = 3
          AND status = 'PAID'
    ), 0)
    -
    COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE DATE_TRUNC('month', expense_date) = DATE '2026-03-01'
    ), 0) AS net_cash_flow;


--vacnt unit
SELECT
    p.property_name,
    u.unit_code,
    u.unit_name,
    u.default_monthly_rent,
    u.vacant_since,
    CURRENT_DATE - u.vacant_since AS vacant_days
FROM units u
JOIN properties p ON u.property_id = p.property_id
WHERE u.occupancy_status = 'VACANT'
ORDER BY u.vacant_since;

-- lease ending soon
SELECT
    l.lease_id,
    p.property_name,
    u.unit_code,
    usr.full_name AS tenant_name,
    l.start_date,
    l.end_date,
    (l.end_date - CURRENT_DATE) AS days_until_expiry,
    l.status
FROM leases l
JOIN units u ON l.unit_id = u.unit_id
JOIN properties p ON u.property_id = p.property_id
JOIN users usr ON l.tenant_id = usr.user_id
WHERE l.status = 'ENDING_SOON'
   OR l.end_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY l.end_date;


-- Overdue invoices
SELECT
    i.invoice_code,
    p.property_name,
    u.unit_code,
    usr.full_name AS tenant_name,
    i.total_amount,
    i.due_date,
    CURRENT_DATE - i.due_date AS overdue_days,
    i.status
FROM invoices i
JOIN leases l ON i.lease_id = l.lease_id
JOIN units u ON l.unit_id = u.unit_id
JOIN properties p ON u.property_id = p.property_id
JOIN users usr ON l.tenant_id = usr.user_id
WHERE i.status = 'OVERDUE'
ORDER BY i.due_date;

--Payment verification queue
SELECT
    i.invoice_code,
    p.property_name,
    u.unit_code,
    usr.full_name AS tenant_name,
    pay.paid_amount,
    pay.payment_method,
    pay.submitted_at,
    pay.verification_status
FROM payments pay
JOIN invoices i ON pay.invoice_id = i.invoice_id
JOIN leases l ON i.lease_id = l.lease_id
JOIN units u ON l.unit_id = u.unit_id
JOIN properties p ON u.property_id = p.property_id
JOIN users usr ON pay.payer_id = usr.user_id
WHERE pay.verification_status = 'PENDING'
ORDER BY pay.submitted_at DESC;

-- Manager salary
SELECT
    e.expense_date,
    p.property_name,
    e.vendor_name AS manager_name,
    e.amount,
    e.category,
    e.note
FROM expenses e
JOIN properties p ON e.property_id = p.property_id
WHERE e.category = 'MANAGER_SALARY'
ORDER BY e.expense_date DESC;

--Property-level financial report
SELECT
    p.property_name,
    COALESCE(inc.collected_income, 0) AS collected_income,
    COALESCE(exp.total_expense, 0) AS total_expense,
    COALESCE(inc.collected_income, 0) - COALESCE(exp.total_expense, 0) AS net_result
FROM properties p
LEFT JOIN (
    SELECT
        u.property_id,
        SUM(i.total_amount) AS collected_income
    FROM invoices i
    JOIN leases l ON i.lease_id = l.lease_id
    JOIN units u ON l.unit_id = u.unit_id
    WHERE i.status = 'PAID'
    GROUP BY u.property_id
) inc ON p.property_id = inc.property_id
LEFT JOIN (
    SELECT
        property_id,
        SUM(amount) AS total_expense
    FROM expenses
    GROUP BY property_id
) exp ON p.property_id = exp.property_id
ORDER BY p.property_name;

-- Alert list
SELECT
    ar.user_id,
    u.full_name,
    a.alert_type,
    a.title,
    a.severity,
    a.status,
    ar.is_read,
    ar.notified_at
FROM alert_recipients ar
JOIN alerts a ON ar.alert_id = a.alert_id
JOIN users u ON ar.user_id = u.user_id
ORDER BY ar.user_id, a.alert_date DESC;

-- Unread alert
SELECT
    a.alert_type,
    a.title,
    a.description,
    a.severity,
    a.alert_date
FROM alert_recipients ar
JOIN alerts a ON ar.alert_id = a.alert_id
WHERE ar.user_id = 1
  AND ar.is_read = FALSE
ORDER BY a.alert_date DESC;

-- Occupancy rate
SELECT
    COUNT(*) AS total_units,
    SUM(CASE WHEN occupancy_status = 'OCCUPIED' THEN 1 ELSE 0 END) AS occupied_units,
    SUM(CASE WHEN occupancy_status = 'VACANT' THEN 1 ELSE 0 END) AS vacant_units,
    ROUND(
        100.0 * SUM(CASE WHEN occupancy_status = 'OCCUPIED' THEN 1 ELSE 0 END) / COUNT(*),
        2
    ) AS occupancy_rate_percent
FROM units;

--premium portfolio listing

SELECT
    p.property_code,
    p.property_name,
    u.unit_code,
    u.unit_name,
    u.bedroom_count,
    u.area_sqm,
    u.default_monthly_rent,
    u.occupancy_status
FROM properties p
JOIN units u ON p.property_id = u.property_id
ORDER BY p.property_id;
