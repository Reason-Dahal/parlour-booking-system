# Data Model

**Project:** Parlour Booking System
**Phase:** 3, System Design
**Document status:** Approved
**Version:** 1.0
**Last updated:** 1 August 2026

The physical translation of the eighteen-entity domain model defined in Phase
2, section 4.

---

## 1. Conventions

| Convention | Rule |
|---|---|
| Primary keys | `cuid()`. Sequential integers leak record counts and permit enumeration |
| Model naming | Singular PascalCase, mapped to plural snake_case tables via `@@map` |
| Tenant scoping | Every tenant-scoped table carries `tenantId`, indexed |
| Unique constraints | Always composite with `tenantId` on tenant-scoped tables |
| Money | `Decimal(10,2)`. Never `Float` |
| Absolute time | `DateTime`, stored UTC |
| Local time | `Int` minutes from local midnight |
| Deletion | Deactivation flags. Physical deletion only where no history exists |

### 1.1 The two kinds of time

This distinction runs through the whole schema and must not be blurred.

**Absolute instants** are stored as UTC `DateTime`. An appointment refers to
one specific moment in time. Per NFR-011 and BR-19.

**Local wall-clock times** are stored as integer minutes from midnight, in
the tenant's timezone, carrying no date. A rule stating "Saturday, 10:00 to
18:00" is a statement about the local clock that remains true regardless of
date. It becomes an absolute instant only when combined with a specific date
during slot computation.

Storing recurring rules as UTC timestamps is a common and serious error. It
breaks the moment a rule must survive a change of offset, and the stored
value is meaningless without a reference date.

---

## 2. Generator and Datasource

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## 3. Identity and Tenancy

### 3.1 Enumerations

```prisma
enum Role {
  CUSTOMER
  STAFF
  OWNER
  PLATFORM_ADMIN
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
}
```

### 3.2 Tenant

```prisma
// ---------------------------------------------------------------------------
// Tenant
//
// The isolation boundary of the entire platform. Almost every other entity
// carries a tenantId referencing this model, per SRS section 8.2 layer 1.
// ---------------------------------------------------------------------------

model Tenant {
  id     String       @id @default(cuid())
  status TenantStatus @default(ACTIVE)

  name String
  slug String @unique

  /*
   * IANA timezone identifier, for example "Asia/Kathmandu".
   *
   * Stored explicitly rather than assumed, per NFR-011. Every conversion
   * between stored UTC timestamps and local wall-clock time reads this
   * field. Nepal Standard Time is UTC+05:45, and the forty-five minute
   * offset breaks any code that assumes whole-hour timezones.
   */
  timezone String @default("Asia/Kathmandu")

  email       String
  phone       String
  addressLine String
  city        String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships      Membership[]
  customerProfiles CustomerProfile[]
  services         Service[]
  appointments     Appointment[]

  @@index([status])
  @@map("tenants")
}
```

`slug` is the subdomain. `glowparlour.platform.com.np` resolves by looking up
`slug = "glowparlour"`. It is globally unique because subdomains must be.

### 3.3 User

```prisma
// ---------------------------------------------------------------------------
// User
//
// Global identity. One record per person across the entire platform.
//
// Deliberately NOT tenant-scoped. Per OPD-01 and FR-051, a customer registers
// once and may book at any parlour. Their relationship with each parlour is
// held in CustomerProfile, which IS tenant-scoped.
//
// This shape is what satisfies FR-052: a tenant queries CustomerProfile
// filtered to itself and can never observe that the underlying User holds
// profiles elsewhere. The privacy guarantee is structural, not a matter of
// remembering to filter correctly.
// ---------------------------------------------------------------------------

model User {
  id String @id @default(cuid())

  email        String  @unique
  phone        String  @unique
  passwordHash String
  fullName     String
  isActive     Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  membership       Membership?
  customerProfiles CustomerProfile[]
  resetTokens      PasswordResetToken[]

  @@map("users")
}
```

`membership` is optional and singular per OPD-04. `customerProfiles` is
plural because a person may be a customer at many parlours.

### 3.4 Membership

```prisma
// ---------------------------------------------------------------------------
// Membership
//
// Links a User to a Tenant as staff or owner. Answers "what is this person's
// employment relationship with this parlour".
//
// Held separately from StaffProfile, which answers "what are this person's
// professional attributes". An Owner who performs no services has a
// Membership and no StaffProfile. Merging the two would force every owner
// row to carry null specialisation and null bio, and nullable columns that
// apply to only one role reliably indicate two conflated concepts.
// ---------------------------------------------------------------------------

model Membership {
  id String @id @default(cuid())

  userId   String @unique
  tenantId String

  role Role

  createdAt DateTime @default(now())

  user         User          @relation(fields: [userId], references: [id])
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  staffProfile StaffProfile?

  @@index([tenantId])
  @@map("memberships")
}
```

`userId` is `@unique`, enforcing OPD-04 at the database level. A person
working at two parlours requires two accounts, which is the accepted edge
case.

### 3.5 CustomerProfile

```prisma
// ---------------------------------------------------------------------------
// CustomerProfile
//
// Links a User to a Tenant as a customer. One record per customer per
// parlour. Created lazily on first booking, per UC-25 alternate flow A2.
// ---------------------------------------------------------------------------

model CustomerProfile {
  id String @id @default(cuid())

  userId   String
  tenantId String

  internalNote String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id])
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  appointments Appointment[]

  /*
   * Composite uniqueness: one profile per user per tenant.
   *
   * Every unique constraint on a tenant-scoped table includes tenantId, per
   * SRS section 8.2 layer 2. A constraint on userId alone would prevent a
   * customer from ever visiting a second parlour.
   */
  @@unique([userId, tenantId])
  @@index([tenantId])
  @@map("customer_profiles")
}
```

The composite unique constraint is the most important recurring pattern in a
multi-tenant schema. Omitting `tenantId` from one constraint either leaks
data across tenants or causes legitimate operations to fail inexplicably.

### 3.6 PasswordResetToken

```prisma
model PasswordResetToken {
  id String @id @default(cuid())

  userId String

  // SHA-256 of the token. The plaintext is emailed and never persisted, so
  // a database compromise does not yield usable reset tokens.
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?

  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("password_reset_tokens")
}
```

`usedAt` is the single-use marker. A timestamp rather than a boolean because
it records when, which is useful when investigating a suspicious reset.

---

## 4. Catalogue

### 4.1 Category

```prisma
// ---------------------------------------------------------------------------
// Category
//
// Global service classification, maintained by the Platform Administrator
// per OPD-05. Shared by every tenant.
//
// THIS MODEL CARRIES NO tenantId. It is the sole exception to platform-wide
// tenant isolation in the entire schema.
//
// The exception is recorded here prominently because an isolation audit in
// Phase 5 will otherwise flag this table as a defect, leading either to a
// wasted investigation or, worse, to someone "fixing" it by adding a tenantId
// column that breaks the global category set.
//
// Business rule BR-18: no tenant may modify a category.
// ---------------------------------------------------------------------------

model Category {
  id String @id @default(cuid())

  name        String  @unique
  slug        String  @unique
  description String?

  position Int
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  services Service[]

  @@index([isActive, position])
  @@map("categories")
}
```

`name` is globally unique with no `tenantId` in the constraint. This is the
only place in the schema where that is correct.

### 4.2 Service

```prisma
model Service {
  id       String @id @default(cuid())
  tenantId String

  categoryId String

  name        String
  description String?

  /*
   * Duration the customer experiences, in minutes. This is what appears on
   * the public site and in the confirmation.
   */
  durationMinutes Int

  /*
   * Cleanup and preparation time reserved after the service ends, per
   * FR-016. The staff member remains occupied for this period but the
   * customer is never shown it.
   *
   * Buffer is applied AFTER rather than before because cleanup is the
   * constraining activity in this domain. Applying it beforehand would
   * incorrectly block the first slot of the working day.
   */
  bufferMinutes Int @default(0)

  /*
   * Decimal rather than Float. Floating point cannot represent decimal
   * fractions exactly, so monetary arithmetic accumulates error. In
   * JavaScript, 0.1 + 0.2 evaluates to 0.30000000000000004.
   */
  price Decimal @db.Decimal(10, 2)

  /*
   * Deactivation rather than deletion, per FR-014 and BR-04. A service
   * referenced by any appointment must remain readable for historical
   * records and reports, per BR-07.
   */
  isActive Boolean @default(true)
  position Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  category     Category       @relation(fields: [categoryId], references: [id])
  staffLinks   StaffService[]
  appointments Appointment[]

  // Composite with tenantId. Two parlours may both offer "Gold Facial".
  @@unique([tenantId, name])
  @@index([tenantId, isActive])
  @@index([categoryId])
  @@map("services")
}
```

---

## 5. Staff and Availability

### 5.1 StaffProfile

```prisma
model StaffProfile {
  id       String @id @default(cuid())
  tenantId String

  membershipId String @unique

  displayName    String
  specialisation String?
  bio            String?
  photoUrl       String?
  position       Int     @default(0)

  /*
   * Deactivation rather than deletion, per FR-021 and BR-05.
   *
   * Per BR-06, deactivating a staff member does not alter their existing
   * appointments. Future appointments require explicit reassignment or
   * cancellation by the owner. Silently cancelling a customer's booking
   * because an employee left would be worse than surfacing the decision.
   */
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  membership   Membership              @relation(fields: [membershipId], references: [id])
  services     StaffService[]
  rules        AvailabilityRule[]
  exceptions   AvailabilityException[]
  appointments Appointment[]

  @@index([tenantId, isActive])
  @@map("staff_profiles")
}
```

### 5.2 StaffService

```prisma
// ---------------------------------------------------------------------------
// StaffService
//
// Capability mapping, per FR-018. Enforces BR-02. Slot search reads this
// table to determine the candidate staff set, per UC-24 main flow step 5.
// ---------------------------------------------------------------------------

model StaffService {
  id       String @id @default(cuid())
  tenantId String

  staffProfileId String
  serviceId      String

  createdAt DateTime @default(now())

  staffProfile StaffProfile @relation(fields: [staffProfileId], references: [id], onDelete: Cascade)
  service      Service      @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([staffProfileId, serviceId])
  @@index([tenantId])
  @@index([serviceId])
  @@map("staff_services")
}
```

`onDelete: Cascade` appears here and nowhere in the booking core. The
distinction: this row is not a record of anything that happened, it is a
statement of current capability. Removing a qualification is a normal
administrative action with no historical value. Appointments are the
opposite, which is why NFR-010 forbids deleting them.

### 5.3 AvailabilityRule

```prisma
// ---------------------------------------------------------------------------
// AvailabilityRule
//
// A recurring weekly working window, per FR-019.
//
// TIMEZONE HANDLING, READ THIS BEFORE CHANGING ANYTHING HERE
//
// startMinute and endMinute are minutes from local midnight, in the tenant's
// timezone. They carry no date and no timezone of their own.
//
// This does NOT violate NFR-011. A rule stating "Saturday, 10:00 to 18:00"
// is a statement about the local clock that remains true regardless of date.
// It becomes an absolute instant only when combined with a specific date
// during slot computation, at which point it is converted to UTC.
//
// Integers rather than a time type because Prisma's time handling across
// databases is inconsistent, and minute arithmetic is trivial with integers.
// 10:00 is 600. 18:00 is 1080.
// ---------------------------------------------------------------------------

model AvailabilityRule {
  id       String @id @default(cuid())
  tenantId String

  staffProfileId String

  // 0 = Sunday through 6 = Saturday, matching JavaScript's Date.getDay()
  // to avoid a conversion at every use site.
  dayOfWeek Int

  startMinute Int
  endMinute   Int

  /*
   * Optional validity window, supporting scheduled changes to working hours.
   * An owner can enter next month's roster today without disturbing this
   * month's.
   */
  effectiveFrom  DateTime? @db.Date
  effectiveUntil DateTime? @db.Date

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  staffProfile StaffProfile @relation(fields: [staffProfileId], references: [id], onDelete: Cascade)

  @@index([tenantId, staffProfileId, dayOfWeek])
  @@map("availability_rules")
}
```

### 5.4 AvailabilityException

```prisma
enum ExceptionType {
  UNAVAILABLE
  CUSTOM_HOURS
}

// ---------------------------------------------------------------------------
// AvailabilityException
//
// A date-specific override of the recurring rules, per FR-020.
//
// Per BR-08, an exception OVERRIDES the recurring rule for that date. It is
// never merged with it. Merge semantics produce ambiguity that neither the
// developer nor the owner can reason about reliably.
// ---------------------------------------------------------------------------

model AvailabilityException {
  id       String @id @default(cuid())
  tenantId String

  staffProfileId String

  date DateTime      @db.Date
  type ExceptionType

  /*
   * Required when type is CUSTOM_HOURS, null when type is UNAVAILABLE.
   *
   * Prisma cannot express "required only when another field has a given
   * value". This is enforced in the service layer instead, and the
   * constraint is stated here so the requirement is visible at the schema.
   */
  startMinute Int?
  endMinute   Int?

  reason String?

  createdAt DateTime @default(now())

  staffProfile StaffProfile @relation(fields: [staffProfileId], references: [id], onDelete: Cascade)

  /*
   * One exception per staff member per date. Two competing overrides for the
   * same day, one UNAVAILABLE and one CUSTOM_HOURS, would make BR-08
   * undecidable. The database prevents the ambiguity from arising.
   */
  @@unique([staffProfileId, date])
  @@index([tenantId, date])
  @@map("availability_exceptions")
}
```

---

## 6. Booking Core

### 6.1 BookingPolicy

```prisma
// ---------------------------------------------------------------------------
// BookingPolicy
//
// Per-tenant booking constraints. Exactly one record per tenant, created
// during provisioning.
//
// Every value here is an owner-adjustable default. No booking constraint is
// hardcoded anywhere in the application. A literal such as "2 hours notice"
// appearing in a service belongs in this table instead.
// ---------------------------------------------------------------------------

model BookingPolicy {
  id       String @id @default(cuid())
  tenantId String @unique

  /*
   * OPD-08. When false, online bookings are created CONFIRMED. When true,
   * they are created PENDING and await staff approval.
   */
  requiresApproval Boolean @default(false)

  /*
   * FR-061. Hours after which an unapproved PENDING appointment is
   * automatically cancelled.
   *
   * This field is not optional behaviour. A PENDING appointment holds its
   * slot per BR-21. Without expiry, an owner who does not act freezes that
   * slot indefinitely, invisibly to customers and with no error raised. The
   * tenant degrades toward permanent unavailability while their calendar
   * appears empty.
   */
  pendingExpiryHours Int @default(24)

  /*
   * OPD-09. Constrained in the service layer to {5, 10, 15, 20, 30, 60}.
   * Every permitted value divides 60 evenly, so slots align to a
   * recognisable pattern within each LOCAL hour. For a Kathmandu tenant the
   * corresponding UTC instants fall on quarter-hour boundaries offset from
   * the hour, because Nepal Standard Time is UTC+05:45. This is expected.
   */
  slotGranularityMinutes Int @default(15)

  minAdvanceNoticeHours   Int @default(2)   // FR-024
  maxBookingHorizonDays   Int @default(60)  // FR-025
  cancellationCutoffHours Int @default(4)   // FR-030
  reminderLeadHours       Int @default(24)  // FR-037

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("booking_policies")
}
```

### 6.2 Appointment

```prisma
enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

enum AppointmentSource {
  ONLINE
  PHONE
  WALK_IN
}

model Appointment {
  id       String @id @default(cuid())
  tenantId String

  customerProfileId String
  staffProfileId    String
  serviceId         String

  /*
   * All three timestamps are absolute UTC instants, per NFR-011 and BR-19.
   *
   *   startAt        When the customer arrives
   *   endAt          When the service finishes. Shown to the customer
   *   reservedUntil  When the staff member becomes free. endAt plus buffer
   *
   * reservedUntil is stored rather than derived because the exclusion
   * constraint operates on it, and a database constraint cannot call
   * application code to compute a value.
   *
   * The customer is shown endAt and never reservedUntil. Conflating the two
   * produces a system that either overbooks staff or displays an inflated
   * service duration.
   */
  startAt       DateTime
  endAt         DateTime
  reservedUntil DateTime

  status AppointmentStatus @default(CONFIRMED)
  source AppointmentSource @default(ONLINE)

  /*
   * Point-in-time snapshot, per FR-029 and BR-12.
   *
   * These are COPIES of the service's values at the moment of booking, not
   * references. When an owner raises a facial from 1,500 to 1,800, every
   * appointment booked beforehand must still report 1,500.
   *
   * Reading price through the serviceId foreign key would silently rewrite
   * financial history and corrupt every report.
   */
  priceAtBooking    Decimal @db.Decimal(10, 2)
  durationAtBooking Int
  bufferAtBooking   Int

  customerNote String?
  internalNote String?

  /*
   * Distinguishes UC-25 from UC-26. When this equals the customer's own user
   * id, the booking was made online by the customer. When it differs, a staff
   * member entered it on their behalf.
   */
  createdByUserId String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant          Tenant               @relation(fields: [tenantId], references: [id])
  customerProfile CustomerProfile      @relation(fields: [customerProfileId], references: [id])
  staffProfile    StaffProfile         @relation(fields: [staffProfileId], references: [id])
  service         Service              @relation(fields: [serviceId], references: [id])
  events          AppointmentEvent[]
  notifications   NotificationOutbox[]

  /*
   * Index column order matters. PostgreSQL uses a composite index
   * left-to-right, so equality columns precede the range column. This serves
   * the availability query, which filters by staff and status then ranges
   * over time. Reversing the order would make the index far less effective.
   */
  @@index([tenantId, staffProfileId, status, startAt])
  @@index([tenantId, startAt])
  @@index([customerProfileId])
  @@index([status, startAt])
  @@map("appointments")
}
```

`staffProfileId` is not nullable. This is OPD-10 enforced structurally and is
what makes section 6.3 possible. An unassigned appointment could not
participate in overlap detection, so deferred assignment would have destroyed
FR-027.

### 6.3 The exclusion constraint

Prisma has no syntax for exclusion constraints. This SQL is written by hand
into a migration file.

FR-027 requires that no staff member holds two overlapping appointments, and
that the guarantee not rely solely on application code. The reason is a race
condition that application code cannot close:

```
Time    Request A                    Request B
────────────────────────────────────────────────
t0      check availability → free
t1                                   check availability → free
t2      insert appointment
t3                                   insert appointment
```

Both checks passed. Both inserts succeed. The gap between check and write is
inherent to check-then-act across concurrent processes.

```sql
-- Enable the extension providing GiST index support for scalar types.
CREATE EXTENSION IF NOT EXISTS btree_gist;

/*
 * Implements FR-027 and BR-01.
 *
 * Rejects any INSERT or UPDATE producing two rows where staff_profile_id is
 * equal AND the reserved time ranges overlap, considering only appointments
 * that actually occupy time.
 *
 * The guarantee is held by the database engine, so it holds under any degree
 * of concurrency regardless of what application code does.
 *
 * '[)' makes the range inclusive of start and exclusive of end. An
 * appointment reserved until 11:00 does not conflict with one starting at
 * 11:00. Using '[]' would block back-to-back bookings entirely.
 *
 * The WHERE clause is essential. PENDING and CONFIRMED occupy time, per
 * BR-21. CANCELLED, COMPLETED and NO_SHOW do not, so a cancelled slot
 * becomes immediately rebookable.
 */
ALTER TABLE appointments
ADD CONSTRAINT appointments_no_staff_overlap
EXCLUDE USING gist (
  staff_profile_id WITH =,
  tstzrange(start_at, reserved_until, '[)') WITH &&
)
WHERE (status IN ('PENDING', 'CONFIRMED'));
```

`&&` is the overlap operator. `tstzrange` is a timestamp range type. Together
they express "these two ranges intersect" as something the database can index
and enforce.

The constraint covers `UPDATE` as well as `INSERT`, so reschedule is
protected without additional work.

### 6.4 AppointmentEvent

```prisma
enum AppointmentEventType {
  CREATED
  CONFIRMED
  RESCHEDULED
  CANCELLED
  COMPLETED
  NO_SHOW
  EXPIRED
  REASSIGNED
}

// ---------------------------------------------------------------------------
// AppointmentEvent
//
// Immutable audit record of every lifecycle change, per FR-034 and BR-13.
//
// APPEND ONLY. No update path and no delete path is ever written for this
// model. Immutability is a property of how the entity is used, not something
// the database enforces by itself, so it is stated here and honoured in
// every service that touches it.
//
// actorUserId is nullable because ACT-06, the Scheduler, is a system actor
// with no user record. A null actor means the transition was automatic,
// which in practice means FR-061 expiry.
// ---------------------------------------------------------------------------

model AppointmentEvent {
  id String @id @default(cuid())

  tenantId      String
  appointmentId String

  type       AppointmentEventType
  fromStatus AppointmentStatus?
  toStatus   AppointmentStatus

  actorUserId String?

  // Free-form context: previous times on a reschedule, cancellation reason,
  // previous staff member on a reassignment.
  metadata Json?

  createdAt DateTime @default(now())

  appointment Appointment @relation(fields: [appointmentId], references: [id])

  @@index([appointmentId, createdAt])
  @@index([tenantId, createdAt])
  @@map("appointment_events")
}
```

### 6.5 NotificationOutbox

```prisma
enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_PENDING
  BOOKING_APPROVED
  BOOKING_RESCHEDULED
  BOOKING_CANCELLED
  BOOKING_EXPIRED
  APPOINTMENT_REMINDER
}

enum NotificationStatus {
  QUEUED
  SENT
  FAILED
}

// ---------------------------------------------------------------------------
// NotificationOutbox
//
// Durable queue implementing the transactional outbox pattern, per FR-038
// and BR-20.
//
// The problem: a booking must not fail because an email provider is down,
// but neither should a successful booking silently send no email.
//
// The solution: the notification row is written inside the SAME transaction
// as the appointment. Either both commit or neither does. A separate worker
// then polls for QUEUED rows and dispatches them.
//
// Dispatch failure can therefore never roll back a booking, and a booking
// can never exist without its notification having been recorded. The naive
// alternative, calling the email API inside the booking transaction, fails
// on both counts.
// ---------------------------------------------------------------------------

model NotificationOutbox {
  id       String @id @default(cuid())
  tenantId String

  appointmentId String?

  type      NotificationType
  status    NotificationStatus @default(QUEUED)
  recipient String

  // Rendering data captured at enqueue time, so the worker need not re-read
  // entities that may have changed since.
  payload Json

  // Earliest dispatch time. Immediate for confirmations, future-dated for
  // reminders per FR-037.
  scheduledFor DateTime @default(now())

  attempts  Int       @default(0)
  lastError String?
  sentAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  appointment Appointment? @relation(fields: [appointmentId], references: [id])

  // The worker's polling query.
  @@index([status, scheduledFor])
  @@index([tenantId])
  @@map("notification_outbox")
}
```

---

## 7. Model Inventory

| Model | Tenant-scoped | Notes |
|---|---|---|
| `Tenant` | Is the boundary | |
| `User` | No | Global identity per FR-051 |
| `Membership` | Yes | |
| `CustomerProfile` | Yes | Satisfies FR-052 structurally |
| `PasswordResetToken` | No | Attached to global User |
| `Category` | **No** | Sole isolation exception, per OPD-05 |
| `Service` | Yes | |
| `StaffProfile` | Yes | |
| `StaffService` | Yes | Only cascading delete in the schema |
| `AvailabilityRule` | Yes | Local time as minutes |
| `AvailabilityException` | Yes | Overrides, never merges |
| `BookingPolicy` | Yes | One per tenant |
| `Appointment` | Yes | Carries the exclusion constraint |
| `AppointmentEvent` | Yes | Append-only |
| `NotificationOutbox` | Yes | Transactional outbox |

`TenantTheme`, `TenantSection` and `MediaAsset` are deferred to the site
management increment and will be added in Phase 4 rather than specified now.

---

## 8. Design Principles

| Principle | Manifestation |
|---|---|
| Tenant isolation is structural | `tenantId` everywhere, composite unique constraints |
| Two kinds of time, never conflated | `AvailabilityRule` minutes versus `Appointment` UTC |
| Financial records are snapshots | `priceAtBooking` and siblings |
| History is never deleted | Deactivation flags, append-only events |
| Guarantees belong in the database | The exclusion constraint |

The final principle is the difference between a system that works in testing
and one that works under load.
