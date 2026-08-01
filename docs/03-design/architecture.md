# Architecture

**Project:** Parlour Booking System
**Phase:** 3, System Design
**Document status:** Approved
**Version:** 1.0
**Last updated:** 1 August 2026

---

## 1. Repository Strategy

### 1.1 Decision

A single repository containing all applications, organised as an npm workspace.

### 1.2 Rationale

The system has three clients across two releases: the Express API, the
Next.js web application, and the Flutter mobile application at Release 2.0.

The API returns an `Appointment`. The web application renders it. If these
live in separate repositories, the shape of that object is defined twice, and
adding a field to the API produces no signal in the web application until
something fails at runtime.

In a single repository the type is defined once and imported by both. A
change to the API surfaces as a compile error during development rather than
as a defect in production. This is the primary practical benefit of
TypeScript in this project, and it is unavailable across repository
boundaries.

### 1.3 Structure

```
parlour-booking-system/
├── apps/
│   ├── api/              Express, Prisma, PostgreSQL
│   ├── web/              Next.js
│   └── mobile/           Flutter. Release 2.0
├── packages/
│   └── shared/           Types, validation schemas, constants
├── docs/
├── package.json          Workspace root
└── .gitignore
```

`apps/mobile` sits outside the TypeScript workspace, since Dart has its own
toolchain, but remains in the same repository so that the API contract stays
visible alongside the client that consumes it.

### 1.4 Contents of packages/shared

Anything the API and web application must agree upon:

- TypeScript interfaces for every entity and API response
- Zod schemas for request validation
- Shared constants, including appointment statuses and the permitted slot
  granularity values from OPD-09

Nothing else. No business logic and no database access. A Prisma import in
`shared` breaks the boundary, because it would pull database code into the
browser bundle.

Concretely, NFR-004 requires payload validation at the API boundary. That Zod
schema is written once in `shared`. The API validates incoming requests with
it and the web form validates user input with it. One definition, two
consumers, no possibility of drift. This is NFR-015 enforced structurally
rather than by discipline.

### 1.5 Tooling

npm workspaces, which is built into npm and requires no additional
installation.

Turborepo and Nx are commonly recommended for monorepos. Both address build
caching problems that do not exist at this scale. Neither is adopted.

---

## 2. API Internal Architecture

### 2.1 Layering

Three layers with a single direction of dependency.

```
Route        HTTP only. Parse request, call service, send response
  ↓
Service      Business logic. Knows nothing about HTTP
  ↓
Repository   Database access. Knows nothing about business rules
```

Routes depend on services. Services depend on repositories. Nothing depends
upward.

**The enforcing rule: no `req` or `res` object appears below the route
layer.** A service function accepting `req` has broken the layering.

This implements NFR-014.

### 2.2 Rationale

Booking logic is invoked from three places: the customer web application, the
staff dashboard creating a telephone booking per UC-26, and the Flutter
application at Release 2.0.

Logic embedded in an Express route handler is reachable from exactly one of
these. Logic in a service is reachable from all three, calling the same
function with the same guarantees.

### 2.3 Folder structure

```
apps/api/src/
├── modules/
│   ├── auth/
│   ├── tenant/
│   ├── catalogue/
│   ├── staff/
│   ├── booking/
│   └── notification/
├── middleware/
├── lib/
├── config/
├── types/
└── server.ts
```

The six modules are the six subsystems defined in Phase 2, section 2.1. That
correspondence is deliberate: the analysis grouping becomes the folder
structure, so the question "where does slot computation live" is answered by
a document written before any code existed.

### 2.4 Module contents

```
modules/booking/
├── booking.routes.ts         Endpoint definitions
├── booking.controller.ts     Request and response handling
├── booking.service.ts        Business logic
├── booking.repository.ts     Database queries
├── booking.schema.ts         Zod validation
├── booking.types.ts          Module-local types
└── availability.service.ts   Slot computation
```

Organisation is feature-based rather than type-based. The alternative,
grouping all controllers together and all services together, appears tidy and
works poorly: changing one feature requires editing five distant folders, and
nothing indicates which files belong together.

Feature grouping keeps a module self-contained and readable in one place. It
is the dominant convention in NestJS, Angular, and contemporary Express
codebases.

`availability.service.ts` sits alongside `booking.service.ts` as a separate
file because Phase 2 identified UC-24 as included by three other use cases,
signalling a component rather than a step. The analysis predicted the file.

### 2.5 Supporting folders

| Folder | Contents |
|---|---|
| `middleware/` | `tenantResolver`, `authenticate`, `authorize`, `validate`, `errorHandler`, `rateLimiter` |
| `lib/` | Prisma client instance, logger, mailer, date and timezone helpers |
| `config/` | Environment variable reading and validation at startup |
| `types/` | Express request type augmentation |

Timezone utilities live in `lib/` and are used throughout. Given NFR-011 and
the UTC+05:45 offset, having exactly one location where local time converts
to UTC is what prevents RSK-03 from becoming a distributed class of defects.

`config/` validates environment variables at startup. A missing
`DATABASE_URL` must prevent the process from booting with a clear message,
rather than failing hours later on the first query.

---

## 3. Application of SOLID

Two of the five principles materially affect this codebase. The remainder are
worth knowing but do not change what is built.

### 3.1 Single Responsibility

The layering in section 2.1. A route handles HTTP. A service handles business
rules. A repository handles queries. A file performing two of these should be
split.

### 3.2 Dependency Inversion

Services never import Prisma directly. The booking service requests
appointments from a repository and does not know whether they originate in
PostgreSQL. This is what permits the service to be tested without a database.

### 3.3 The remaining three

Open/Closed, Liskov Substitution, and Interface Segregation are primarily
concerned with class hierarchies. This codebase will not contain deep
hierarchies.

Applying them aggressively at this scale produces abstraction for its own
sake, which is a worse problem than the one it purports to solve. They are
noted and deliberately not pursued.

---

## 4. Frontend Architecture

### 4.1 Next.js route groups

```
apps/web/app/
├── (public)/       Tenant-facing site. Statically generated. Indexable
└── (dashboard)/    Owner and staff administration. Client rendered
```

Public tenant pages are statically generated per NFR-022, because the
commercial premise of the product is that the parlour becomes findable. The
dashboard requires no indexing and is client rendered.

### 4.2 The constraint on Next.js API routes

**Next.js API routes are not used for business logic under any
circumstances.**

All business logic remains in the Express API. Next.js is a client of that
API, exactly as the Flutter application will be.

Booking logic placed inside Next.js would be unreachable from the Flutter
client, forcing either duplication or rewrite. Duplicated business logic
across clients is among the most damaging architectural errors available and
violates NFR-015 directly.

```
                    +---------------------+
                    |   Express API       |
                    |   Business logic    |
                    |   PostgreSQL        |
                    +----------+----------+
                               |
              +----------------+----------------+
              |                                 |
    +---------+---------+           +-----------+---------+
    |  Next.js web app  |           |  Flutter mobile app |
    |  Release 1.0      |           |  Release 2.0        |
    +-------------------+           +---------------------+
```

The API knows nothing about either client. This property is what makes
Release 2.0 additive rather than disruptive, and it is required by NFR-016
and CON-05.
