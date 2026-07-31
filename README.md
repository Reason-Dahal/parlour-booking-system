# Parlour Booking System

A multi-tenant appointment booking platform for beauty parlours. Each tenant
receives a branded public website with online booking built in, plus an
administrative dashboard for managing services, staff, availability and
appointments.

---

## Project Status

| Phase | Name | Status |
|---|---|---|
| 1 | Planning and Requirements Gathering | Complete |
| 2 | System Analysis | In progress |
| 3 | System Design | Not started |
| 4 | Implementation | Not started |
| 5 | Testing | Not started |
| 6 | Deployment and Maintenance | Not started |

No application code exists yet. This repository currently contains
specification documents only. The application folder structure is defined in
Phase 3 and created at the start of Phase 4.

---

## Product Summary

### The problem

Beauty parlour appointments are managed by telephone and paper register. This
produces double bookings, no-shows with no reminder mechanism, no customer
history, and no way for a customer to see availability without making a call.

### The product model

The platform is sold as a complete online presence rather than as a booking
utility. A parlour owner buys a website, which is a purchase they already
understand, and receives an appointment system built into it.

- The **website** is the acquisition mechanism. It is what the owner buys.
- The **booking system** is the retention mechanism. It accumulates the
  customer database and booking history that make the platform difficult
  to leave.
- Revenue is a one-time setup fee plus a recurring monthly subscription.

### Multi-tenancy

One codebase serves many parlours. Tenants are resolved from the request
host. Visual variation between tenants is achieved through design tokens,
section composition and section variants, all of which are configuration.
No tenant receives bespoke frontend code at any price.

Adding a tenant requires no code change and no deployment. This property is
recorded as NFR-024 and is the constraint that separates a product from an
agency.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Web client | Next.js, React, TypeScript | Server rendering required for search engine indexing of public tenant pages |
| Mobile client | Flutter | Release 2.0. Consumes the same API |
| API | Node.js, Express, TypeScript | Client-agnostic HTTP interface returning JSON |
| ORM | Prisma | Type-safe data access with migration support |
| Database | PostgreSQL | Relational integrity, transactions and exclusion constraints |

### Architectural rule

All business logic resides in the Express API. Next.js API routes are not
used for business logic under any circumstance. Next.js is a client of the
API in exactly the same way the Flutter application will be.

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

---

## Documentation

| Document | Purpose |
|---|---|
| [SDLC Methodology](docs/00-methodology/sdlc-methodology.md) | The development model in use and why |
| [Software Requirements Specification](docs/01-requirements/SRS.md) | Phase 1 output. Scope, requirements, risks |
| [System Analysis](docs/02-analysis/system-analysis.md) | Phase 2 output. Use cases, domain model, business rules |
| [Decision Log](docs/DECISION-LOG.md) | Every resolved design decision and its rationale |
| [Contributing](CONTRIBUTING.md) | Branching strategy, commit format, coding standards |
| [Setup Guide](docs/SETUP-GUIDE.md) | Repository and local environment setup |

---

## Release Plan

| Release | Contents |
|---|---|
| 1.0 | Web platform. Tenant websites, booking, dashboard, email notifications |
| 1.1 | Custom domains, SMS notifications, online deposits, section reordering |
| 1.2 | Self-service tenant registration |
| 2.0 | Flutter mobile client for customers |
| 3.0 | Cross-tenant discovery, subject to tenant density |

---

## Licence

MIT. See [LICENSE](LICENSE).
