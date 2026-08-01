# API Contract

**Project:** Parlour Booking System
**Phase:** 3, System Design
**Document status:** Approved
**Version:** 1.0
**Last updated:** 1 August 2026

The contract is what makes the Flutter client additive rather than a rewrite.
It is defined once and consumed unchanged by every client.

---

## 1. Versioning

Every route sits under a version prefix, per NFR-017.

```
/api/v1/services
/api/v1/appointments
```

The prefix is not added in anticipation of an imminent `/v2`. It is added
because Release 2.0 introduces a second client that cannot be updated
simultaneously with the first. Some users will be running an older
application build.

Adding the prefix later requires changing every route in both codebases at
once. Adding it now costs nothing.

Version only on breaking changes: removing a field, renaming one, changing a
type. Adding an optional field is not breaking.

---

## 2. Tenant Resolution

The tenant is derived from the request host, never from a URL parameter or
request body, per FR-044.

```
glowparlour.platform.com.np/api/v1/services
```

Middleware reads the host, resolves the slug against the `Tenant` table, and
injects the tenant into the request context before any route handler runs.

A client therefore has no way to express a request for another tenant's data.
If the tenant were a parameter, as in `/api/v1/tenants/{id}/services`, every
route would need to verify that the authenticated user belongs to that
tenant, and forgetting once creates RSK-08. Host-based resolution makes
cross-tenant access inexpressible rather than merely forbidden.

Platform administration routes are the exception. They live under
`/api/v1/admin/*` and operate across tenants.

---

## 3. Response Envelope

Every response shares one shape.

```typescript
// Success
{
  "success": true,
  "data": { }
}

// Error
{
  "success": false,
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "That time is no longer available.",
    "details": []          // Optional. Validation errors only
  }
}
```

Consistency permits one response handler per client rather than special
casing per endpoint.

`code` is a stable machine-readable string. `message` is human-readable and
may change freely, including future translation to Nepali.

**Clients branch on `code`, never on `message`.** This rule prevents error
handling from breaking whenever wording is improved.

Paginated responses add a meta block:

```typescript
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 47 }
}
```

---

## 4. Timestamps

Every timestamp in every response is ISO 8601 in UTC, with the tenant
timezone supplied separately where relevant.

```json
{
  "startAt": "2026-08-15T04:15:00.000Z",
  "endAt": "2026-08-15T05:15:00.000Z",
  "timezone": "Asia/Kathmandu"
}
```

The `Z` suffix denotes UTC. The client converts for display.

`04:15Z` above is 10:00 local, taken from the worked example in Phase 2,
section 8.1. The API never sends local time. If it did, each client would
have to infer which timezone the string referred to, and one of them would
infer wrongly.

`reservedUntil` is never sent to a customer. Staff endpoints include it.

---

## 5. Error Codes

### 5.1 General

| Code | HTTP | Meaning |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No or invalid credentials |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `NOT_FOUND` | 404 | Resource does not exist in this tenant |
| `VALIDATION_FAILED` | 422 | Payload failed schema validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

### 5.2 Booking domain

| Code | HTTP | Meaning |
|---|---|---|
| `SLOT_UNAVAILABLE` | 409 | Slot taken between search and booking |
| `STAFF_NOT_QUALIFIED` | 422 | Staff cannot perform this service |
| `OUTSIDE_BOOKING_HORIZON` | 422 | Beyond `maxBookingHorizonDays` |
| `INSUFFICIENT_NOTICE` | 422 | Violates `minAdvanceNoticeHours` |
| `CANCELLATION_CUTOFF_PASSED` | 422 | Too late to cancel |
| `INVALID_STATUS_TRANSITION` | 422 | Not permitted by the state model |
| `CUSTOMER_DOUBLE_BOOKED` | 409 | Violates BR-15 |

### 5.3 The cross-tenant rule

**A resource belonging to another tenant returns `NOT_FOUND`, never
`FORBIDDEN`.**

This implements UC-24 exception flow E3. Returning `FORBIDDEN` would confirm
that the resource exists, permitting an attacker to enumerate what other
parlours offer. Both cases return an identical 404 with an identical body.

---

## 6. Routes

### 6.1 Public, no authentication

```
GET    /api/v1/site                Tenant theme, sections, content
GET    /api/v1/categories          Global categories
GET    /api/v1/services            Active catalogue
GET    /api/v1/staff               Active staff profiles
GET    /api/v1/availability        Slot search. UC-24
```

### 6.2 Authentication

```
POST   /api/v1/auth/register            UC-01
POST   /api/v1/auth/login               UC-02
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/password/forgot     UC-03
POST   /api/v1/auth/password/reset
GET    /api/v1/auth/me                  UC-04
PATCH  /api/v1/auth/me
```

### 6.3 Customer

```
GET    /api/v1/appointments                   UC-30
POST   /api/v1/appointments                   UC-25
GET    /api/v1/appointments/:id
PATCH  /api/v1/appointments/:id/reschedule    UC-27
POST   /api/v1/appointments/:id/cancel        UC-28
```

### 6.4 Staff and Owner

```
GET    /api/v1/manage/schedule                        UC-31
POST   /api/v1/manage/appointments                    UC-26
POST   /api/v1/manage/appointments/:id/approve
POST   /api/v1/manage/appointments/:id/complete       UC-29
POST   /api/v1/manage/appointments/:id/no-show
PATCH  /api/v1/manage/appointments/:id/reassign

GET    /api/v1/manage/availability/rules              UC-20
POST   /api/v1/manage/availability/rules
PATCH  /api/v1/manage/availability/rules/:id
DELETE /api/v1/manage/availability/rules/:id
POST   /api/v1/manage/availability/exceptions         UC-21
DELETE /api/v1/manage/availability/exceptions/:id
```

### 6.5 Owner only

```
POST   /api/v1/manage/services                        UC-14
PATCH  /api/v1/manage/services/:id                    UC-15
POST   /api/v1/manage/services/:id/deactivate         UC-16

POST   /api/v1/manage/staff                           UC-18
PATCH  /api/v1/manage/staff/:id
PUT    /api/v1/manage/staff/:id/services              UC-19
POST   /api/v1/manage/staff/:id/deactivate            UC-22

GET    /api/v1/manage/site                            UC-07, UC-08
PATCH  /api/v1/manage/site/theme
PATCH  /api/v1/manage/site/sections
POST   /api/v1/manage/site/publish                    UC-11

GET    /api/v1/manage/policy                          UC-32
PATCH  /api/v1/manage/policy

GET    /api/v1/manage/reports/summary                 UC-35
GET    /api/v1/manage/reports/utilisation
```

### 6.6 Platform administration

```
POST   /api/v1/admin/tenants                          UC-05
PATCH  /api/v1/admin/tenants/:id/status               UC-06
POST   /api/v1/admin/categories                       UC-13
```

### 6.7 The /manage/ prefix

The prefix separates authenticated administrative routes from public and
customer routes. It permits role middleware to be applied to an entire route
group rather than endpoint by endpoint. Forgetting once is RSK-08.

---

## 7. Named Actions for State Transitions

Status changes use `POST /appointments/:id/cancel` rather than
`PATCH /appointments/:id { status: "CANCELLED" }`.

Strict REST prefers the latter. It is wrong here.

Cancelling is not "set a field to a value". It evaluates the cancellation
cutoff, writes an `AppointmentEvent` per BR-13, and enqueues a notification.
It is an operation with rules, not a property assignment.

A generic PATCH invites a client to attempt `CANCELLED → COMPLETED`, which
the Phase 2 state model forbids, and forces the server to validate every
possible transition on a general-purpose endpoint. Named actions make the
permitted transitions explicit and each endpoint's rules obvious.

This pattern is common in production APIs. Purity loses to clarity.

---

## 8. The Availability Endpoint

The most important endpoint in the system.

### Request

```
GET /api/v1/availability
      ?serviceId=clx123
      &date=2026-08-15
      &staffId=clx456          Optional. Omit for any staff
```

`date` is a local date in the tenant's timezone.

### Response

```json
{
  "success": true,
  "data": {
    "date": "2026-08-15",
    "timezone": "Asia/Kathmandu",
    "slots": [
      {
        "startAt": "2026-08-15T04:15:00.000Z",
        "endAt": "2026-08-15T05:15:00.000Z",
        "staffProfileId": "clx456",
        "staffName": "Sunita"
      }
    ]
  }
}
```

Every slot carries a `staffProfileId` even when the customer requested "any
staff". This is OPD-10: assignment is resolved during search per BR-14, so
the customer knows who will serve them and the subsequent booking request is
unambiguous.

The response contains no `reservedUntil`. The customer sees a one-hour
appointment; the buffer is the parlour's business.

---

## 9. Shared Types

This is where `packages/shared` earns its place.

```typescript
// packages/shared/src/types/appointment.ts

/*
 * Wire format for an appointment as returned by the API.
 *
 * Defined once and imported by both the Express API and the Next.js client.
 * Adding a field surfaces as a compile error anywhere the object is
 * constructed or consumed, which is the entire reason for the monorepo.
 */
export interface AppointmentResponse {
  id: string;
  startAt: string;          // ISO 8601 UTC
  endAt: string;            // ISO 8601 UTC
  status: AppointmentStatus;
  service: { id: string; name: string };
  staff: { id: string; displayName: string };
  priceAtBooking: string;   // String, not number. See below
  customerNote: string | null;
}
```

`priceAtBooking` is a string for the same reason the database column is
`Decimal`. JSON numbers are IEEE 754 floats, so serialising a decimal price
as a number reintroduces exactly the precision loss the database type was
chosen to avoid.

---

## 10. Contract Principles

1. Version prefix from the first release
2. Tenant from host, never from parameter
3. One envelope shape everywhere
4. UTC timestamps only, timezone supplied separately
5. Machine-readable codes; cross-tenant misses return 404
6. Named actions for state transitions
