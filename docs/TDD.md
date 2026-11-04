# Technical Design Document: EduLedger (Coaching Fee Management System)

## 1. Problem statement

Small and mid-sized coaching institutes usually track fees in registers or spreadsheets. This causes four problems:
- Balances drift when students pay in instalments.
- Overdue fees go unnoticed.
- Receipts are inconsistent.
- Parents have to phone the office to find out what they owe.

This system gives staff a single source of truth for fees and payments, and gives parents and students a self-serve, read-only view of their own records.

## 2. Assumptions

- There is one institute and one currency (INR). All amounts are stored as **integer paise**.
- Due dates are calendar dates in the institute's timezone (IST by default, configurable). A fee becomes overdue once its due **day** has ended locally.
- Payments are collected offline (cash at the office, or a bank transfer or UPI to the institute's account) and recorded by an admin. There is no payment gateway in the MVP.
- A student has at most one linked parent account and at most one fee plan at a time. Extra one-off charges, such as admission kits or test series, are added as custom fee records.
- Parents and students cannot change any data, except their own password and notification read state.
- No email or SMS provider is available. Notifications are in-app only.
- Paying more than the outstanding balance is **not** supported. Advance payments must be recorded against future fee records once they are generated.

## 3. Architecture

```
┌──────────────┐  HTTPS/JSON   ┌─────────────────────────────┐   Mongoose   ┌──────────────┐
│ React SPA     │ ────────────▶│ Express API (Render)         │ ───────────▶ │ MongoDB Atlas │
│ (Vercel)      │  Bearer JWT  │ routes → validate (Zod) →    │  sessions /  │ (replica set) │
│ Redux, RHF    │◀──────────── │ authenticate → authorize →   │  transactions│              │
└──────────────┘               │ controller → service         │              └──────────────┘
                               └─────────────────────────────┘
```

- **Modular monolith.** There is one API service, organised by module (auth, users, students, parents, fees, payments, notifications, announcements, reports). Business rules live in `server/src/services`. Controllers stay thin.
- **Request pipeline:**
  1. `helmet`
  2. CORS allow-list
  3. JSON body limit of 100 KB
  4. Operator-key sanitiser
  5. Rate limiter
  6. Route-level `validate()` with Zod (strips unknown keys and coerces types)
  7. `authenticate`
  8. `authorize(role)`
  9. Controller
  10. Centralised `errorHandler`
- **Frontend:**
  - Route-level code splitting.
  - Redux Toolkit holds only cross-cutting state (session, unread count, mobile navigation). Page data comes from a small `useApi` hook that refetches whenever its parameters change.
  - All money arrives as paise and is formatted only at render time. User input such as "1,250.50" is converted to paise with string arithmetic, never floats.

## 4. Database schema

| Collection | Key fields | Indexes / constraints |
|---|---|---|
| **User** | name, email, phone, passwordHash (`select:false`), role `admin\|parent\|student`, isActive, passwordChangedAt, resetTokenHash/Expiry (`select:false`) | email unique; role |
| **Student** | studentId (`STU-YYYY-NNNN`), fullName, email, phone, course, batch, admissionDate, parent → User, user → User (student login), feePlan → FeeStructure, status, deletedAt | studentId unique; user unique (partial); parent; course+batch; email |
| **FeeStructure** | name, course, frequency `monthly\|quarterly\|one_time`, amount (paise, integer), dueDay 1–28, isActive | name unique |
| **FeeRecord** | student, feeStructure (null for custom), title, periodKey, amount, amountPaid, dueDate, status `pending\|partial\|paid\|cancelled`, paidAt | **(student, feeStructure, periodKey) unique**; status+dueDate; student+dueDate |
| **Payment** | transactionId, receiptNumber, feeRecord, student, amount (> 0, integer), method `cash\|bank_transfer\|online_manual`, reference, paidAt, recordedBy, idempotencyKey, manualEntry, balanceAfter | transactionId unique; receiptNumber unique; **idempotencyKey unique**; **(method, reference) unique where reference is set**; feeRecord; student; paidAt |
| **Notification** | user, type, title, message, link, read, dedupeKey | user+read+createdAt; (user, dedupeKey) unique (partial) |
| **Announcement** | title, body, audience `all\|parents\|students`, pinned, createdBy | pinned+createdAt |
| **AuditLog** | actor, actorRole, action, entityType, entityId, summary, metadata, ip | createdAt; action; entityId |

**Relationships**
- A parent can have many students (`Student.parent`).
- A student can have many fee records.
- A fee record can have many payments.
- Every payment references exactly one fee record. `Payment.student` is a denormalised copy of `FeeRecord.student`, used for scoping queries.

**Avoiding inconsistent financial data**
- `overdue` is **never stored**. It is derived from `dueDate` and the balance at read time, by `effectiveStatus()` for reads and `statusFilter()` for queries, so it can never go stale.
- `FeeRecord.amountPaid` is a cached sum of payments. It changes in exactly one place: the payment service, in the same atomic operation and transaction that inserts the `Payment`. A test asserts `amountPaid == Σ payments.amount`.
- `balanceAfter` on a payment is an immutable snapshot used on receipts.
- Students are never hard-deleted ("archive" sets `deletedAt`), and fee records with payments cannot be cancelled. Historical payments and reports therefore always stay intact.

## 5. API design

The API is REST and grouped by module; the full list is in the README. Conventions:
- **Response envelope:** `{ success, data, meta }` on success, or `{ success:false, error:{ code, message, details } }` on failure.
- **Stable error codes** that the UI can act on: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OVERPAYMENT`, `ALREADY_PAID`, `FEE_CANCELLED`, `AMOUNT_BELOW_PAID`, `HAS_PAYMENTS`, `RATE_LIMITED`.
- **Pagination:** `?page&limit`, with `meta: { page, limit, total, totalPages }`. List endpoints accept search and filter parameters, and every parameter is validated by Zod.
- **Downloads:** CSV exports and PDF receipts are streamed with `Content-Disposition`. CSV cells are escaped and protected against spreadsheet formula injection.

## 6. Authentication and authorisation

- **Login:**
  - bcrypt hashes, cost 12. Plaintext passwords are never stored.
  - The same generic error is returned for a wrong password and an unknown email. The bcrypt work is the same in both cases, so timing does not reveal which accounts exist.
  - A successful login issues a JWT (HS256) containing only `sub`.
- **Per-request checks:**
  - The user is loaded from the database on every request, so a disabled account loses access immediately.
  - The role always comes from the database, never from the token or the client.
  - Tokens issued before `passwordChangedAt` are rejected. Changing or resetting a password therefore logs out other sessions.
- **RBAC:** `authorize('admin')` guards every mutating and admin endpoint. Read endpoints that parents and students share (`/students/:id`, `/fees/records`, `/payments`, receipts) are scoped in code:
  - `accessibleStudentIds(user)` returns `null` for admins (meaning all students), the linked children for a parent, and the student's own profile for a student.
  - `getAccessibleStudent()` returns **404, not 403**, for records the caller cannot access. This prevents IDOR enumeration.
  - Notifications are always filtered by `user: req.user._id`.
- **Password reset:**
  - A single-use random token with a 30-minute TTL. Only its SHA-256 hash is stored.
  - `forgot-password` responds identically whether or not the account exists.
  - There is no email provider, so admins can issue a reset link from the UI, and in development the link is logged.
- **Hardening:**
  - Rate limits: 20 requests per 15 minutes on auth routes, 300 per minute on the API overall.
  - Helmet, a CORS allow-list from `CLIENT_URL`, and a 100 KB body limit.
  - Express 5 `simple` query parser (no nested objects in query strings), plus a body sanitiser that drops `$` and dotted keys.
  - Server-side assignment of `role` (user-supplied values are ignored).
  - Secrets only in environment variables; `.env` is git-ignored.
- **Token storage trade-off:** the SPA and API run on different sites (Vercel and Render). Third-party cookie restrictions in Safari and Chrome make cross-site httpOnly cookies unreliable, so the token is kept in `localStorage`, with a 1-day expiry. The mitigation is strict input handling and React's default escaping. Serving both from one domain would allow switching to `SameSite=Strict` httpOnly cookies.

## 7. Main workflows

1. **Onboarding:**
   1. The admin creates a parent account.
   2. The admin adds a student, links the parent, assigns a fee plan and optionally creates a student login.
2. **Billing:**
   1. The admin clicks *Generate fees* for a month.
   2. For every active student on a plan, the server upserts a fee record keyed by `(student, plan, periodKey)`. Monthly plans use `2026-11`, quarterly plans use `FY2026-Q3`, and one-time plans use `ONE_TIME`.
   3. Re-running the generation creates nothing new.
   4. Parents and students get a "New fee due" notification.
3. **Payment:**
   1. The admin opens *Record payment* (from the dashboard, fees list or student page). The form generates a UUID `idempotencyKey`.
   2. The admin enters the amount, method, reference and date.
   3. The server records the payment (section 8), then returns the transaction ID and receipt number. The receipt PDF can be downloaded immediately.
   4. The parent and student receive a "Payment received" notification.
4. **Reminders:**
   1. `runFeeReminders()` runs at startup, every 6 hours, and on demand from the dashboard.
   2. It sends "due soon" reminders once per fee, and "overdue" reminders at most once per fee per day. Duplicates are prevented by `dedupeKey` with a unique index.
5. **Parent self-service:**
   1. The parent logs in and sees the total due, the overdue amount, the next deadline and a card per child.
   2. The parent can drill into a child's monthly breakdown and payment history, and download receipts.

## 8. Important business logic

- **Recording a payment** (`services/payment.service.ts`):
  1. Validate that the amount is a positive integer in paise and that a reference is present for non-cash methods. Reject payment dates in the future.
  2. Reject a reused `idempotencyKey` or a reused `(method, reference)` with **409**. Unique indexes also catch races.
  3. Inside a MongoDB transaction, run a **single conditional atomic update**:
     ```
     findOneAndUpdate(
       { _id, status ∈ {pending, partial}, $expr: amountPaid + amt ≤ amount },
       [ { $set: amountPaid += amt },
         { $set: status = amountPaid ≥ amount ? 'paid' : 'partial', paidAt } ])
     ```
     If nothing matches, the API returns a precise reason: `OVERPAYMENT` (with the outstanding amount), `ALREADY_PAID`, `FEE_CANCELLED` or not found.
  4. Insert the `Payment` (with `balanceAfter`) and the `AuditLog` entry in the same transaction.

  Because the guard sits in the update filter, even six concurrent requests cannot over-collect; this is tested. On a standalone MongoDB without transactions, the atomic guard alone still protects the balance.
- **Paid status:** a fee is marked *paid* only when `amountPaid === amount`, and `amountPaid` only increases through recorded payments.
- **Overdue:** a fee is overdue when `dueDate < now` and the balance is greater than zero. Partial payments on an overdue fee keep it overdue, with the balance shown. Due dates are stored as 23:59:59.999 local time on the due day.
- **Editing a fee:**
  - The amount cannot go below `amountPaid`.
  - The status is recomputed from the paid total.
  - The update is guarded by `amountPaid` being unchanged, so it cannot race with a concurrent payment.
  - Changing a fee plan's amount affects only fees generated afterwards.
- **Cancelling:** only allowed for `pending` fees with no payments. Payments are never deleted.
- **Archiving a student:** the student is hidden and their login disabled. Fee records and payments remain, so collection reports stay correct.

## 9. UI/UX decisions

- **Visual style:** follows the EduLedger UI design canvas. A `#f8f9fc` canvas, white bordered cards, an indigo accent (`#4f46e5`) with navy (`#1b2033`) for brand and secondary actions, the Inter font, and tabular figures for every amount.
- **Admin layout:** a light sidebar with Main and Workspace sections, a collapse-to-icons control and a user card. The top bar has a breadcrumb, a student search (`/` to focus) and an "Add student" button. The sidebar becomes a slide-in drawer below `lg`.
- **Student quick view:** a right-hand drawer with the outstanding balance, unpaid fees (each opens Record payment) and key details.
- **Parent and student layout:** a simple top navigation on desktop and a **bottom tab bar** on phones (Home, Payments, Notices, Alerts). This suits non-technical parents.
- **Tables:** every data table switches to stacked cards on mobile. The layout is not just a shrunken desktop table.
- **Dialogs:** they become bottom sheets on phones.
- **Feedback:** loading skeletons, meaningful empty states with a call to action, error states with a retry button, toasts, and confirmation dialogs for destructive actions (archive, cancel fee, disable account, unlink, delete).
- **Recording a payment:**
  - The dialog shows fee, paid and outstanding amounts.
  - A "Full" button fills in the full balance.
  - A live hint shows what will remain ("₹4,500 will remain").
  - Overpayment is caught on the client before the server rejects it.
  - Choosing an online payment shows a warning that this is a manual entry, not a gateway payment.
  - The success screen shows the transaction ID and a receipt download button.
- **Charts** (Recharts):
  - A single y-axis.
  - A neutral grey "billed" reference bar next to indigo "collected".
  - The method breakdown uses three hues (indigo, teal, amber) that pass a colour-vision-deficiency check, with 2px gaps between stacked segments.
  - Every chart has a legend and tooltips, plus a tabular view on the Reports page.
- **Accessibility:** labelled form fields, `aria-invalid` with inline errors, visible focus rings, sufficient tap-target sizes, `role="alert"` on errors, and status shown with both text and a coloured dot (never colour alone).

## 10. Testing strategy

| Level | Tooling | Scope |
|---|---|---|
| API / integration | Jest + Supertest + `mongodb-memory-server` replica set | 38 tests, each test file on its own seeded database. See the list below. |
| End-to-end | Playwright (Chromium; desktop and Pixel 7) | Boots a fresh in-memory database, the API and Vite. Covers the four flows listed below. |
| Manual | Screenshot sweep with Playwright at 1440 px and 390 px | Layout overflow, no console errors |

The API tests cover:
- auth, including timing-safe login errors and the reset flow with session invalidation
- RBAC across every module
- IDOR (a parent accessing another parent's student, fee, payment or receipt)
- role-injection attempts and NoSQL injection
- student CRUD, search and archive (with history retained)
- idempotent monthly and quarterly generation
- overdue edge cases around the due-day boundary
- multi-step partial payments down to 1 paisa
- overpayment, a fully paid fee, duplicate idempotency keys and duplicate UTRs
- six concurrent payments
- PDF receipt bytes and headers
- audit entries

The E2E tests cover:
- admin creates a student
- admin records a partial payment, sees overpayment rejected, and downloads the receipt
- parent views a child's status
- parent is blocked from another parent's child, in the UI and directly via the API

## 11. Limitations

- No payment gateway, refunds, voided payments, discounts or late-fee automation.
- No email or SMS delivery. Notifications are in-app only.
- One parent account per student. A second guardian would need to share the login.
- The reminder scheduler runs in-process. On sleeping free tiers it only runs while the service is awake.
- Text search uses case-insensitive regex, which is fine for thousands of students. A large deployment would need Atlas Search.
- Reports are computed live with aggregations, which is fine at institute scale.
- JWTs are kept in `localStorage` (see section 6). There is no refresh-token rotation.

## 12. Future improvements

- Razorpay or Stripe integration with webhook-verified payments. This would add a `gateway` payment method and signature verification, and would reuse the same atomic recording path.
- Refunds or voided payments as compensating entries, never deletions.
- Email and WhatsApp reminders through a provider, using the existing `dedupeKey` scheme.
- Multiple guardians per student, sibling discounts and scholarship rules.
- A queue (BullMQ) or Render cron job for reminders. Pre-aggregated monthly summaries.
- An httpOnly cookie session when the client and API share a domain. Admin two-factor authentication.
- Multi-branch (multi-tenant) support.
