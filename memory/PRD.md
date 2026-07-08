# Laxmi Electronics ERP — PRD

## Original Problem Statement
Full-stack, production-ready ERP for **Laxmi Electronics** — an Indian electronics & home appliance retailer. A simplified Zoho Inventory + Tally + POS + CRM combined. Currency INR, GST slabs 5/12/18/28%. Roles: super_admin, owner, store_manager, sales_executive, cashier, warehouse_staff, technician, accountant.

## User Choices (from initial ask_human)
- **MVP scope**: Core — Dashboard, Inventory, POS Billing, Customers, Suppliers, Sales, Reports (+ AI Insights added)
- **Auth**: JWT-based custom with role-based access
- **AI**: Claude Sonnet 4.5 via Emergent LLM key
- **Notifications (Email/SMS/WhatsApp)**: Deferred to Phase 2
- **Currency/Tax**: INR with GST

## Architecture
- **Backend**: FastAPI (`/api/*`), MongoDB via Motor, JWT auth (cookie + Bearer fallback), bcrypt hashing, seed data on startup, emergentintegrations for Claude Sonnet 4.5
- **Frontend**: React 19, react-router 7, shadcn/ui, recharts, tailwind (light/dark), Outfit + Inter fonts, glassmorphism aesthetic, SWR for data fetching, sonner for toasts

## Implemented (MVP — 2026-02-07)
- [x] JWT auth with 3 seed accounts (admin, cashier, store_manager)
- [x] Dashboard: 8 KPI cards + 7-day sales trend + category pie + top products + low stock
- [x] Inventory: CRUD, auto SKU generator, stock adjustment with history, GST slabs
- [x] POS Billing: fast product tile grid, cart, GST calc, 5 payment methods, invoice generation, stock deduction
- [x] Customers CRM: CRUD, loyalty points auto-awarded on purchase, total spent tracking
- [x] Suppliers: CRUD with GST & contact fields
- [x] Sales ledger with invoice detail dialog + print
- [x] Reports: CSV export for sales, inventory, customers + 7-day revenue bar chart
- [x] AI Insights: Sales Forecast, Reorder Guidance, Cross-sell Ideas via Claude Sonnet 4.5
- [x] Light/Dark theme toggle, responsive mobile top-bar navigation
- [x] Seed data: 8 categories, 10 brands, 12 products, 4 customers, 4 suppliers, 20 historical sales
- [x] E2E tested — all backend & frontend flows passing


## Iteration 2 — 2026-02-08 (POS Enhancements)
- [x] Editable per-unit price in cart (GST-inclusive input; backend receives net price)
- [x] Per-bill **GST toggle** — when off: GSTIN, HSN, CGST/SGST columns and place-of-supply hidden; header shows "BILL" + "Cash Memo"
- [x] Quick-add Customer / Item / Brand directly from POS with dialogs (fixed 500 caused by pymongo `_id` mutation)
- [x] GST invoice template matching uploaded PDF: header with GSTIN, Bill To / Ship To, HSN/SAC, CGST + SGST columns, @rate% subtotals, amount-in-words, Authorized Signatory
- [x] Barcode: Enter-to-scan on search input (physical scanners) + camera scan dialog via html5-qrcode
- [x] Business settings endpoint (`/api/settings`) with default LAXMI ELECTRONICS profile

## Backlog / Next Phases

### P0 (High priority, next iteration)
- Purchase Orders module (GRN, vendor bills, payment tracking)
- Warehouse module (multi-warehouse, stock transfer, bin locations)
- User management UI (create/edit/deactivate users, permission matrix)
- Barcode/QR code generation on invoices
- Thermal receipt (58mm) print layout

### P1
- Delivery module (assign, OTP, photo proof)
- Installation & Service Center module (ticket, technician, repair status)
- Warranty & AMC tracking with expiry reminders
- EMI / Finance module (Bajaj, HDB, Home Credit)
- Employee attendance, salary, commission
- Bulk Excel import/export for products
- Global search across all entities

### P2
- Full accounting (Cash book, P&L, Balance Sheet, Trial Balance)
- Notifications (Email via Resend, SMS via Twilio, WhatsApp)
- Auto backup & restore
- 2FA, audit logs, login history
- Digital signature, customer wallet, referral program
- E-commerce integration
