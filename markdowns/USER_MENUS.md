# User Roles and Navigation Menus

Based on the provided UI designs, here is the exact page breakdown for each user type. This will serve as our blueprint for the routing and sidebar navigation for the next phases.

## 1. Tenant (Cư dân)
**Base Route:** `/tenant/*`

*   **Trang chủ** (`/tenant/dashboard`) - Home / Overview
*   **Thanh toán** (`/tenant/payments`) - View invoices and make payments
*   **Yêu cầu** (`/tenant/requests`) - Submit and track maintenance/support requests
*   **Hợp đồng** (`/tenant/contracts`) - View active leases/contracts
*   **Thông báo** (`/tenant/notifications`) - System alerts and messages
*   **Tài khoản** (`/tenant/account`) - User profile and settings

---

## 2. Owner (Chủ nhà)
**Base Route:** `/owner/*`

*   **Trang chủ** (`/owner/dashboard`) - Home / Quick metrics
*   **Thu tiền nhà** (`/owner/invoices`) - Rent collection, invoices, and payment tracking
*   **Quản lý nhà** (`/owner/properties`) - Properties, units, and lease management
*   **Quản gia** (`/owner/managers`) - Manage hired property managers and assignments
*   **Doanh thu** (`/owner/revenue`) - Financial reports and revenue tracking
*   **Yêu cầu** (`/owner/requests`) - Tenant requests and maintenance tickets
*   **Thông báo** (`/owner/notifications`) - System alerts and messages
*   **Tài khoản** (`/owner/account`) - User profile and settings

---

## 3. Manager (Quản gia)
**Base Route:** `/manager/*`
*(Note: Matches the provided Manager screenshot layout)*

*   **Trang chủ** (`/manager/dashboard`) - Home / Quick metrics
*   **Thu tiền nhà** (`/manager/invoices`) - Rent collection and track unpaid invoices
*   **Quản lý nhà** (`/manager/properties`) - Manage assigned properties and units
*   **Quản gia** (`/manager/managers`) - View co-managers or team members
*   **Doanh thu** (`/manager/revenue`) - View assigned properties' revenue
*   **Yêu cầu** (`/manager/requests`) - Respond to tenant requests and tickets
*   **Thông báo** (`/manager/notifications`) - System alerts and messages
*   **Tài khoản** (`/manager/account`) - User profile and settings

---

### Implementation Notes (For Later)
- The layout needs to be refactored to use a dynamic Sidebar component that conditionally renders these links based on the user's `session.role` (TENANT, OWNER, MANAGER).
- The current `/manager/...` routes we built earlier will need to be aligned with these specific menu categories (e.g. moving property creation strictly under Owner, while Managers handle assigned operational tasks under their "Quản lý nhà" tab).
