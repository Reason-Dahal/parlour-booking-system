# Security, Transactions and Concurrency

**Project:** Parlour Booking System
**Phase:** 3, System Design
**Document status:** Approved
**Version:** 1.0
**Last updated:** 1 August 2026

---

## 1. Two Questions, Plus One

**Authentication** establishes who you are. **Authorisation** establishes what
you may do.

A multi-tenant system adds a third: which tenant are you acting within.
Getting that wrong is RSK-08, the highest-severity risk in the project.

---

## 2. Password Handling

`bcrypt` at cost factor 12, per FR-004.

Bcrypt is deliberately slow, which is the point. A fast hash such as SHA-256
permits an attacker holding a stolen database to test billions of candidates
per second. Bcrypt at cost 12 takes roughly 250 milliseconds per hash:
imperceptible at login, ruinous for brute force.

The cost factor is exponential; each increment doubles the work. Twelve is
the current sensible default and should be revisited periodically as hardware
improves.

Bcrypt salts automatically, so identical passwords produce different hashes.
Salts are not managed by application code.

```typescript
// Registration
const passwordHash = await bcrypt.hash(plaintext, 12);

// Login
const isValid = await bcrypt.compare(plaintext, user.passwordHash);
```

Plaintext passwords are never logged, never included in an error message, and
never returned in a response.

---

## 3. Tokens

Two tokens with different lifetimes.

| Token | Lifetime | Purpose |
|---|---|---|
| Access | 15 minutes | Sent with every request |
| Refresh | 30 days | Obtains a new access token |

The access token is a JWT: a signed string carrying a small payload. The
server verifies the signature and trusts the contents without a database
lookup, which is what makes it fast.

The tradeoff is that a JWT cannot be revoked before expiry. A banned user's
access token remains valid until it lapses. Fifteen minutes bounds that
window to an acceptable size.

The refresh token is stored hashed in the database and can be revoked
instantly. Long lifetime, but every use is checked against a row under server
control.

### 3.1 Payload

```typescript
{
  sub: "clx_user_123",         // User id
  role: "OWNER",
  tenantId: "clx_tenant_456",  // Null for customers
  iat: 1754006400,
  exp: 1754007300
}
```

**The token is the only source of identity.** Nothing about who the user is
or what role they hold is read from a request body or from any header the
client controls. A client permitted to send `role: "OWNER"` will eventually
do so.

### 3.2 Token storage

The clients differ here, and the difference is a genuine design decision
rather than an implementation detail.

**Next.js web:** refresh token in an httpOnly cookie, access token in memory.

`httpOnly` prevents JavaScript from reading the cookie. If any cross-site
scripting vulnerability ever reaches the site, an attacker's script can read
`localStorage` but cannot read an httpOnly cookie. Storing tokens in
`localStorage` is common practice and is the wrong default.

Cookie flags: `httpOnly`, `secure`, `sameSite: strict`, path scoped to the
refresh endpoint.

**Flutter mobile:** both tokens in `flutter_secure_storage`, backed by
Keychain on iOS and Keystore on Android. Cookies do not apply.

The API accepts a refresh token from either a cookie or an `Authorization`
header, so the contract remains identical across clients.

---

## 4. Middleware Chain

Order is not arbitrary. Each layer assumes the previous one has run.

```
1. rateLimiter        Before anything expensive
2. tenantResolver     Host to tenant. FR-044
3. authenticate       Token to user. Populates req.auth
4. authorize(roles)   Role check
5. validate(schema)   Zod payload check. NFR-004
6. controller
```

### 4.1 Why tenantResolver precedes authenticate

Public routes require a tenant but no authenticated user.
`GET /api/v1/services` on a parlour's subdomain must work for an anonymous
visitor.

Suspended tenants are rejected here once, rather than in every route.

```typescript
/*
 * Resolves the active tenant from the request host, per FR-044.
 *
 * Runs before authentication because public routes require a tenant but no
 * authenticated user.
 *
 * The tenant is derived from the host and never from a request parameter or
 * body. A client therefore has no way to express a request for another
 * tenant's data, which makes cross-tenant access inexpressible rather than
 * merely forbidden. See RSK-08.
 */
export async function tenantResolver(req, res, next) {
  const slug = extractSubdomain(req.hostname);
  if (!slug) return next(new ApiError("NOT_FOUND", 404));

  const tenant = await tenantRepository.findBySlug(slug);
  if (!tenant || tenant.status !== "ACTIVE") {
    return next(new ApiError("NOT_FOUND", 404));
  }

  req.tenant = tenant;
  next();
}
```

### 4.2 Authentication

```typescript
/*
 * Verifies the access token and populates req.auth.
 *
 * The tenant claim in the token is checked against the tenant resolved from
 * the host. A staff member authenticated at one parlour presenting their
 * token at another parlour's subdomain is rejected here, before any handler
 * runs. This is the second independent tenant check, per NFR-021.
 */
export async function authenticate(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next(new ApiError("AUTH_REQUIRED", 401));

  const payload = verifyAccessToken(token);
  if (!payload) return next(new ApiError("AUTH_REQUIRED", 401));

  // A tenant-scoped token is valid only on its own tenant's host.
  if (payload.tenantId && payload.tenantId !== req.tenant.id) {
    return next(new ApiError("NOT_FOUND", 404));
  }

  req.auth = {
    userId: payload.sub,
    role: payload.role,
    tenantId: payload.tenantId,
  };
  next();
}
```

The mismatch returns 404 rather than 403, consistent with the cross-tenant
rule in the API contract.

---

## 5. Role Model

| Route group | Required role |
|---|---|
| `/api/v1/*` public | None |
| `/api/v1/auth/me` | Any authenticated |
| `/appointments/*` | CUSTOMER |
| `/manage/*` | STAFF or OWNER |
| `/manage/services` | OWNER |
| `/manage/staff` | OWNER |
| `/manage/site` | OWNER |
| `/manage/policy` | OWNER |
| `/manage/reports` | OWNER |
| `/admin/*` | PLATFORM_ADMIN |

Applied to route groups rather than individual endpoints:

```typescript
const ownerOnly = [authenticate, authorize(["OWNER"])];
router.use("/manage/services", ownerOnly, serviceRoutes);
```

Per SRS section 4, Owner is a capability superset of Staff. `authorize
(["STAFF"])` admits owners, avoiding the need to list both roles everywhere.

---

## 6. Ownership Checks

Role is insufficient. `authorize(["CUSTOMER"])` establishes that the caller
is a customer, not that the appointment belongs to them.

```typescript
/*
 * Ownership is verified in the service layer, not in middleware.
 *
 * Middleware knows the role but not the resource. Only after loading the
 * appointment can ownership be determined. Attempting this in middleware
 * would require loading the entity twice.
 *
 * Returns NOT_FOUND rather than FORBIDDEN. Confirming that an appointment
 * exists but belongs to someone else leaks information.
 */
async function cancelAppointment(id: string, auth: AuthContext) {
  const appointment = await repo.findById(id, auth.tenantId);
  if (!appointment) throw new ApiError("NOT_FOUND", 404);

  if (auth.role === "CUSTOMER") {
    const profile = await repo.findCustomerProfile(auth.userId, auth.tenantId);
    if (appointment.customerProfileId !== profile?.id) {
      throw new ApiError("NOT_FOUND", 404);
    }
  }
  // ...
}
```

Three ownership rules:

- A customer sees only their own appointments, per FR-041
- A staff member sees only appointments assigned to them, per FR-039
- An owner sees everything within their tenant, per FR-040

---

## 7. Automatic Tenant Filtering

Sections 4 through 6 are application-level. NFR-021 requires isolation at two
independent layers, because a single forgotten `where` clause is a data
breach.

```typescript
/*
 * Injects tenantId into every query on a tenant-scoped model, per SRS
 * section 8.2 layer 3.
 *
 * A developer cannot forget the filter because a developer never writes it.
 * This converts tenant isolation from a discipline problem into a structural
 * property.
 *
 * Category is deliberately excluded. Per OPD-05 it is global and carries no
 * tenantId. It is the only such exception in the schema.
 */
export function tenantScoped(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (GLOBAL_MODELS.includes(model)) return query(args);

          if (READ_OPERATIONS.includes(operation)) {
            args.where = { ...args.where, tenantId };
          }
          if (operation === "create") {
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
```

The service layer receives a client already scoped to the request's tenant. A
query written without a tenant filter still receives one.

PostgreSQL Row Level Security sits beneath this as layer 4, so a defect in
the extension still cannot leak data. The RLS policies are SQL rather than
Prisma and are written alongside the migrations in Phase 4.

---

## 8. Rate Limiting

Per NFR-006.

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 per 15 min per IP and email |
| `POST /auth/register` | 3 per hour per IP |
| `POST /auth/password/forgot` | 3 per hour per email |
| `POST /appointments` | 10 per hour per user |
| Everything else | 100 per 15 min per IP |

Login is keyed on IP **and** email together. IP alone permits an attacker to
distribute attempts across addresses. Email alone permits deliberate lockout
of a known user through repeated failures. Combining both mitigates each.

---

## 9. Transactions

A transaction is a group of operations that either all succeed or all fail,
with no partial state.

Booking writes to three tables: `appointments`, `appointment_events`,
`notification_outbox`. Without a transaction, a crash between the first and
second write leaves an appointment with no audit record, violating BR-13,
with nothing indicating that anything went wrong.

NFR-009 requires that any operation writing to more than one table runs in a
single transaction.

```typescript
await prisma.$transaction(async (tx) => {
  const appointment = await tx.appointment.create({ /* ... */ });
  await tx.appointmentEvent.create({ /* ... */ });
  await tx.notificationOutbox.create({ /* ... */ });
  return appointment;
});
```

Everything inside uses `tx`, not `prisma`. Using `prisma` by mistake executes
that statement outside the transaction, so it commits independently and
survives a rollback. This is a common and quiet defect.

### 9.1 What belongs inside

| Inside | Outside |
|---|---|
| Database writes | Email dispatch |
| Reads the writes depend upon | HTTP calls to external services |
| | Image processing |
| | Anything slow |

A transaction holds locks. Every millisecond it remains open is a millisecond
other requests may wait. An email API call inside the transaction means an
unresponsive mail provider stalls the database.

This is precisely what the outbox pattern addresses.

---

## 10. The Booking Flow

UC-25 as an executable sequence.

```
OUTSIDE THE TRANSACTION
  1. Validate payload against Zod schema
  2. Load service, staff, policy
  3. Check qualification              → STAFF_NOT_QUALIFIED
  4. Check advance notice             → INSUFFICIENT_NOTICE
  5. Check booking horizon            → OUTSIDE_BOOKING_HORIZON
  6. Recompute availability           → SLOT_UNAVAILABLE
  7. Resolve staff if "any"           → BR-14

INSIDE THE TRANSACTION
  8.  Find or create CustomerProfile
  9.  Check BR-15, customer not double booked
  10. Insert appointment              → may violate exclusion constraint
  11. Insert AppointmentEvent
  12. Insert NotificationOutbox row
  13. Commit

OUTSIDE
  14. Return the appointment
```

Steps 1 through 7 sit outside deliberately. They perform no writes, and
validating before opening a transaction keeps the transaction as short as
possible. Common failure cases return errors without ever acquiring a lock.

---

## 11. The Race Condition

Step 6 recomputes availability. Step 10 inserts. Between them lies a gap,
however small.

```
Time    Request A                    Request B
────────────────────────────────────────────────
t0      step 6: slot is free
t1                                   step 6: slot is free
t2      step 10: insert
t3                                   step 10: insert
```

Both checks passed. Both inserts succeed. The staff member is double booked.

No amount of additional checking in application code closes this. The gap is
inherent to check-then-act across concurrent processes.

The exclusion constraint defined in the data model closes it, because the
database evaluates the constraint at write time under its own locking:

```
t3      step 10: insert → REJECTED
                          appointments_no_staff_overlap
```

Request B's transaction rolls back entirely. No appointment, no event, no
notification.

### 11.1 Catching the violation

```typescript
/*
 * Books an appointment. Implements UC-25.
 *
 * Availability is checked twice, deliberately.
 *
 * The check at step 6 is a user experience measure. It catches the common
 * case, where the slot was taken minutes ago, and returns a clear error
 * before any transaction opens.
 *
 * The exclusion constraint caught below is the correctness measure. It
 * catches the microsecond race that no application-level check can prevent.
 * This is why FR-027 states the guarantee must not rely SOLELY on
 * application-level validation.
 *
 * Both surface the same error to the client, because from the customer's
 * perspective the situations are identical.
 */
try {
  return await prisma.$transaction(async (tx) => {
    // steps 8 to 12
  });
} catch (error) {
  // P2010 is Prisma's code for a raw database constraint failure.
  if (isExclusionViolation(error, "appointments_no_staff_overlap")) {
    throw new ApiError("SLOT_UNAVAILABLE", 409);
  }
  throw error;
}
```

### 11.2 Isolation level

PostgreSQL defaults to `READ COMMITTED`, which is correct here. The exclusion
constraint is the reason.

`SERIALIZABLE` would also prevent double booking, but it operates by aborting
conflicting transactions, requiring retry logic throughout and reducing
throughput. The exclusion constraint provides a stronger and more precise
guarantee at lower cost, because it targets exactly the invariant in question
rather than serialising all activity.

**The general principle: prefer a constraint that makes the bad state
unrepresentable over an isolation level that makes it unlikely.**

---

## 12. Reschedule

Reschedule is an update rather than a create, but faces the same race per
BR-01. The exclusion constraint covers `UPDATE` as well as `INSERT`, so no
additional mechanism is required.

```typescript
await prisma.$transaction(async (tx) => {
  const updated = await tx.appointment.update({
    where: { id },
    data: { startAt, endAt, reservedUntil, staffProfileId },
  });

  await tx.appointmentEvent.create({
    data: {
      appointmentId: id,
      type: "RESCHEDULED",
      fromStatus: appointment.status,
      toStatus: appointment.status,     // Unchanged, per Phase 2 section 7.2
      metadata: { previousStartAt: appointment.startAt },
    },
  });
  // ...
});
```

Status does not change on reschedule. Previous times are recorded in
`metadata`, which is what makes the audit trail useful later.

---

## 13. Background Workers

### 13.1 Notification dispatch

```typescript
/*
 * Dispatches queued notifications, per FR-038 and BR-20.
 *
 * Runs outside any request transaction. A dispatch failure marks the row
 * FAILED and increments attempts. It never affects the appointment that
 * produced it.
 */
async function processOutbox() {
  const due = await prisma.notificationOutbox.findMany({
    where: {
      status: "QUEUED",
      scheduledFor: { lte: new Date() },
      attempts: { lt: 5 },
    },
    take: 50,
  });

  for (const item of due) {
    try {
      await mailer.send(item);
      await markSent(item.id);
    } catch (err) {
      await markFailed(item.id, err.message);
    }
  }
}
```

`attempts: { lt: 5 }` caps retries. Without it, a permanently invalid address
is retried indefinitely and the queue fills with unsendable rows.

Reminders per FR-037 require no separate mechanism. The row is created at
booking time with `scheduledFor` set to the appointment start minus
`reminderLeadHours`, and the same worker collects it when due.

### 13.2 Pending expiry

```typescript
/*
 * Cancels PENDING appointments not actioned within the tenant's configured
 * pendingExpiryHours. Implements FR-061 and UC-36.
 *
 * Actor is ACT-06, the Scheduler, so actorUserId on the event is null.
 *
 * Without this job, a PENDING appointment holds its slot indefinitely per
 * BR-21, and a tenant whose owner does not action requests degrades toward
 * permanent unavailability while their calendar appears empty.
 */
async function expirePendingAppointments() {
  // Grouped by tenant, since the expiry window is per-tenant policy.
  for (const policy of await prisma.bookingPolicy.findMany()) {
    const cutoff = subHours(new Date(), policy.pendingExpiryHours);

    const expired = await prisma.appointment.findMany({
      where: {
        tenantId: policy.tenantId,
        status: "PENDING",
        createdAt: { lt: cutoff },
      },
    });

    for (const appt of expired) {
      // Each expiry is its own transaction, so one failure does not block
      // the remainder.
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appt.id },
          data: { status: "CANCELLED" },
        });
        await tx.appointmentEvent.create({
          data: {
            appointmentId: appt.id,
            type: "EXPIRED",
            fromStatus: "PENDING",
            toStatus: "CANCELLED",
            actorUserId: null,
          },
        });
        await tx.notificationOutbox.create({
          data: { type: "BOOKING_EXPIRED" /* ... */ },
        });
      });
    }
  }
}
```

Two questions from Phase 2 section 12.1 remain open and must be answered
before implementation:

1. Is the customer notified when their pending request expires? Notification
   is written in above as the sensible default.
2. Does the expiry clock run from creation, or is it bounded by the
   appointment start time?

### 13.3 Where jobs run

| Option | Assessment |
|---|---|
| `node-cron` in the API process | Simplest. Fails if two API instances run, since both execute every job. Adequate for Release 1.0 |
| Separate worker process | Correct, but doubles deployment surface. Appropriate when scaling past one instance |
| Managed scheduler hitting a protected endpoint | Removes the process concern, adds an external dependency |

Release 1.0 adopts `node-cron`, with a note in the deployment documentation
that it must move before horizontal scaling. Premature infrastructure carries
its own cost.

---

## 14. Principles

### Security

1. Identity comes only from a verified token, never from client-supplied data
2. Tenant comes only from the host, never from a parameter
3. Role checks in middleware, ownership checks in services
4. Cross-tenant and non-owned resources return 404, never 403
5. Tenant filtering is automatic, not remembered

### Concurrency

1. Multi-table writes go in a transaction; everything slow stays out
2. Check in the application for user experience, enforce in the database for
   correctness
3. Prefer a constraint that makes bad state unrepresentable over an isolation
   level that makes it unlikely
4. Side effects go through the outbox, never inside the transaction
