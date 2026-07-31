# Software Requirements Specification

**Project:** Parlour Booking System
**Phase:** 1, Planning and Requirements Gathering
**Document status:** Approved, pending external operator validation
**Version:** 1.1
**Last updated:** 31 July 2026

This document consolidates the Phase 1 specification with Addendum I
(multi-tenant product model) and Addendum II (theming architecture).

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Problem Statement](#2-problem-statement)
3. [Product and Commercial Model](#3-product-and-commercial-model)
4. [Actors and Stakeholders](#4-actors-and-stakeholders)
5. [Scope Definition](#5-scope-definition)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Multi-Tenant Architecture](#8-multi-tenant-architecture)
9. [Theming Architecture](#9-theming-architecture)
10. [Constraints](#10-constraints)
11. [Assumptions](#11-assumptions)
12. [Risk Register](#12-risk-register)
13. [Phase Exit Criteria](#13-phase-exit-criteria)

---

## 1. Project Vision

The system is a multi-tenant, web-based appointment booking platform for
beauty parlours. Each tenant receives a branded public website through which
customers view services and staff availability and book, reschedule or cancel
appointments online. Owners and staff manage their service catalogue, working
hours and daily schedule through an administrative interface.

A native mobile client for customers will follow in a later release,
consuming the same application programming interface.

---

## 2. Problem Statement

Beauty parlour appointment management is predominantly conducted by telephone
and paper register. This creates measurable operational problems:

- Bookings can only be made during business hours, when staff are typically
  occupied with clients
- Double bookings occur when multiple staff members record appointments
  concurrently
- No-shows are frequent because no automated reminder mechanism exists
- No historical record supports demand forecasting, staff scheduling or
  customer retention
- Customers cannot see availability without initiating a phone call

---

## 3. Product and Commercial Model

### 3.1 The asymmetry between felt need and actual need

A parlour owner's **felt need** is visibility. They observe competitors
appearing online. A website is a legible object they can point at, and it has
status value. It is purchasable in a way they already have a mental model for.

A parlour owner's **actual need** is operational: fewer no-shows, no double
bookings, a customer record that is not a paper register vulnerable to loss,
and knowledge of which services generate revenue.

Selling against the actual need requires first convincing the owner that the
problem exists. Selling against the felt need requires no persuasion.
Therefore the platform sells a website and delivers a system.

### 3.2 Website as wedge, booking as moat

| Component | Commercial function | Switching cost |
|---|---|---|
| Public website | Acquisition. What the owner buys and understands | Near zero. Any freelancer can rebuild it |
| Booking system | Retention. Accumulates customer database and history | High. The data cannot be taken elsewhere |

Pricing follows function:

```
Setup fee, one time
  Framed as "your website". Covers onboarding, branding configuration,
  content entry, domain and search engine setup.

Subscription, monthly
  Framed as "hosting, online booking, reminders, support".
  This is the actual business.
```

### 3.3 Adoption risk eliminated by design

A pure booking platform has a two-sided adoption problem: it delivers value
only once customers change behaviour and book online. If customers continue
telephoning, the owner sees no value and cancels.

This design breaks that dependency. FR-032 permits staff to create
appointments on a customer's behalf. From day one, with zero online
customers, the owner receives a functioning digital appointment register,
a customer database, no-show tracking and reports. The website generates
visibility regardless. Online booking then grows on top of a system already
delivering value.

**This property must be preserved.** No later design decision may make online
customer adoption a precondition for value.

### 3.4 The agency trap

If the platform sells bespoke websites it becomes a web agency. Each sale is
a one-time payment, each client requests custom layout, margins collapse
under customisation, revenue does not recur, and ten clients means ten
codebases requiring maintenance.

The distinction between a product company and an agency is not technical. It
is the willingness to decline layout requests. See section 9.5.

### 3.5 Marketplace optionality

Once the platform holds sufficient tenant density, a customer who booked at
one parlour could discover another. That is a marketplace, and marketplaces
are where the substantial economics of this sector sit.

**Do not build it.** Not in Release 1.0, not in 2.0. Marketplace features
built before tenant density produce an empty directory that damages
credibility with existing tenants.

Design the data model so it remains possible. Build nothing toward it.

---

## 4. Actors and Stakeholders

| ID | Actor | Scope | Authentication | Primary interest |
|---|---|---|---|---|
| ACT-01 | Guest | Single tenant site | None | Browse services and pricing |
| ACT-02 | Customer | Global identity, tenant-scoped data | Required | Book and manage own appointments |
| ACT-03 | Staff Member | Exactly one tenant | Required | View own schedule, complete appointments |
| ACT-04 | Owner | Exactly one tenant | Required | Manage catalogue, staff, hours, site, reports |
| ACT-05 | Platform Administrator | All tenants | Required | Provision and support tenants |
| ACT-06 | Scheduler | System internal | Not applicable | Time-triggered reminder dispatch |

ACT-04 is defined as a capability superset of ACT-03 within the same tenant.
An Owner performs every Staff use case plus administrative ones. Modelling
this as inheritance rather than as two disjoint permission sets removes
substantial duplication from the authorisation layer.

---

## 5. Scope Definition

Explicitly recording exclusions is as important as recording inclusions. An
unbounded scope is the single most common cause of abandoned solo projects.

### 5.1 In scope for Release 1.0

**Platform and tenancy**

- Manual tenant provisioning by the platform operator
- Subdomain-based tenant resolution
- Tenant suspension and reactivation

**Public website**

- Statically generated public website per tenant
- Two templates: Classic and Modern
- Design token configuration: colour, typography, type scale, shape
- Structured content management through forms
- Section visibility toggling
- Authenticated preview of unpublished changes
- Automated per-tenant search engine optimisation artifacts
- Responsive image processing

**Identity and access**

- Customer registration, authentication and password reset
- Role-based authorisation across three roles
- Global customer identity with tenant-scoped relationship data

**Catalogue**

- Global service categories, maintained by the platform operator
- Per-tenant services with duration, buffer and price
- Service deactivation

**Staff and availability**

- Staff profiles, scoped to exactly one tenant
- Staff to service capability mapping
- Recurring weekly availability rules
- Date-specific availability exceptions

**Booking**

- Dynamic slot computation
- Appointment creation, rescheduling and cancellation
- Staff-initiated booking for telephone and walk-in customers
- Appointment completion and no-show marking
- Immutable status transition audit
- Configurable booking policy per tenant

**Notification and reporting**

- Email confirmation, reschedule, cancellation and reminder
- Asynchronous dispatch through a durable outbox
- Operational reports: volume, revenue, cancellation rate, staff utilisation

### 5.2 Explicitly out of scope

| Excluded item | Disposition |
|---|---|
| Native mobile applications | Release 2.0 |
| Custom domain support | Release 1.1 |
| Online payment and deposits | Release 1.1 |
| Short message service notifications | Release 1.1 |
| Free section reordering | Release 1.1 |
| Self-service tenant registration | Release 1.2 |
| Cross-tenant discovery and marketplace | Release 3.0 at earliest |
| Free-form page or layout editing | Not planned |
| Bespoke per-tenant frontend design | Not planned at any price |
| Customer reviews and ratings | Not planned |
| Loyalty schemes, coupons, promotional pricing | Not planned |
| Inventory and product retail | Not planned |
| Payroll and commission calculation | Not planned |
| Multi-branch and multi-location per tenant | Not planned |
| Home service and travel logistics | Not planned |
| External calendar synchronisation | Not planned |
| Group and multi-service combined bookings | Not planned |
| Tenant billing and subscription automation | Deferred. Invoice manually while tenant count is low |

Any excluded item later deemed essential must be moved into scope through a
documented change, not absorbed silently. Silent scope absorption is how
schedules collapse.

---

## 6. Functional Requirements

Requirements are stated in the form "the system shall", which is the standard
specification convention. Each is written to be independently verifiable.

### 6.1 Module A: Authentication and Identity

| ID | Requirement |
|---|---|
| FR-001 | The system shall allow a Guest to register a Customer account using name, email address, mobile number and password. |
| FR-002 | The system shall validate email address format and enforce uniqueness across all accounts. |
| FR-003 | The system shall validate mobile numbers against Nepali numbering format and enforce uniqueness. |
| FR-004 | The system shall store passwords using a one-way adaptive hashing algorithm and shall never store or transmit passwords in plain text. |
| FR-005 | The system shall authenticate users by email and password, issuing a time-limited access credential upon success. |
| FR-006 | The system shall enforce a minimum password complexity policy, defined as a minimum of eight characters. |
| FR-007 | The system shall provide a password reset mechanism using a single-use, time-limited token delivered by email. |
| FR-008 | The system shall assign every account exactly one role from the set CUSTOMER, STAFF, OWNER. |
| FR-009 | The system shall restrict access to every protected resource according to the authenticated user's role. |
| FR-010 | The system shall allow an authenticated user to view and update their own profile information. |

### 6.2 Module B: Service Catalogue

| ID | Requirement |
|---|---|
| FR-011 | The system shall allow a Platform Administrator to maintain the global service category set. |
| FR-012 | The system shall allow an Owner to create a service with a name, description, category, duration in minutes and price. |
| FR-013 | The system shall allow an Owner to update and to deactivate a service. |
| FR-014 | The system shall prevent hard deletion of any service referenced by an existing appointment, permitting deactivation only. |
| FR-015 | The system shall allow a Guest or Customer to browse the active service catalogue grouped by category. |
| FR-016 | The system shall support a service buffer period, defined as preparation or cleanup time reserved after the service ends and excluded from the bookable slot presented to the customer. |

### 6.3 Module C: Staff and Availability

| ID | Requirement |
|---|---|
| FR-017 | The system shall allow an Owner to create a Staff profile containing name, contact details and specialisation description. |
| FR-018 | The system shall allow an Owner to associate a Staff member with one or more services, defining which services that member is qualified to perform. |
| FR-019 | The system shall allow an Owner or Staff member to define recurring weekly working hours as a set of day-of-week, start time and end time rules. |
| FR-020 | The system shall allow definition of date-specific availability exceptions covering leave, public holidays and altered hours for a single date. |
| FR-021 | The system shall allow an Owner to deactivate a Staff member without deleting historical appointment records. |

### 6.4 Module D: Booking Engine

This module is the functional core of the system.

| ID | Requirement |
|---|---|
| FR-022 | The system shall compute available appointment slots dynamically from recurring availability rules, date-specific exceptions, service duration, service buffer and existing confirmed appointments. |
| FR-023 | The system shall not present any slot that begins in the past. |
| FR-024 | The system shall enforce a configurable minimum advance booking notice, expressed in hours before the appointment start time. |
| FR-025 | The system shall enforce a configurable maximum booking horizon, expressed in days beyond the current date. |
| FR-026 | The system shall allow a Customer to select a service, then select either a specific qualified Staff member or the first available qualified Staff member, then select an available slot. |
| FR-027 | The system shall guarantee that no Staff member is assigned two overlapping appointments under any concurrency condition. This guarantee shall be enforced at the database layer and shall not rely solely on application-level validation. |
| FR-028 | The system shall persist an appointment with a status drawn from the set PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW. |
| FR-029 | The system shall record the price, duration and buffer in effect at the time of booking, so that subsequent catalogue changes do not retroactively alter historical records. |
| FR-030 | The system shall allow a Customer to cancel an appointment, subject to a configurable cancellation cutoff period. |
| FR-031 | The system shall allow a Customer to reschedule an appointment to another available slot, subject to the same cutoff policy. |
| FR-032 | The system shall allow an Owner or Staff member to create an appointment on a customer's behalf, supporting telephone and walk-in bookings. |
| FR-033 | The system shall allow an Owner or Staff member to transition an appointment to COMPLETED or NO_SHOW after its scheduled end time. |
| FR-034 | The system shall maintain an immutable audit record of every appointment status transition, capturing the acting user and timestamp. |
| FR-061 | The system shall automatically transition a PENDING appointment to CANCELLED if it has not been approved or declined within a configurable expiry period. |

FR-061 exists because a PENDING appointment holds its slot in the
availability computation, per OPD-08. Without automatic expiry, an owner who
does not act on a request freezes that slot indefinitely, invisibly to
customers and with no error raised anywhere. Enabling approval without expiry
produces a system that silently degrades toward permanent unavailability.

### 6.5 Module E: Notifications

| ID | Requirement |
|---|---|
| FR-035 | The system shall dispatch an email confirmation upon successful appointment creation. |
| FR-036 | The system shall dispatch an email notification upon cancellation or reschedule. |
| FR-037 | The system shall dispatch a reminder email at a configurable interval before the appointment start time. |
| FR-038 | The system shall process notification dispatch asynchronously, such that a failure in the notification subsystem does not cause the booking transaction to fail. |

### 6.6 Module F: Dashboard and Reporting

| ID | Requirement |
|---|---|
| FR-039 | The system shall present a Staff member with a day and week view of their own assigned appointments only. |
| FR-040 | The system shall present an Owner with a day and week view of all appointments across all Staff. |
| FR-041 | The system shall present a Customer with their upcoming and historical appointments. |
| FR-042 | The system shall report appointment volume, completed revenue and cancellation rate over an owner-selected date range. |
| FR-043 | The system shall report utilisation per Staff member, defined as booked hours divided by available hours. |

### 6.7 Module G: Tenancy

| ID | Requirement |
|---|---|
| FR-044 | The system shall resolve the active tenant from the request host before any data access occurs. |
| FR-045 | The system shall prevent any authenticated user from reading or writing data belonging to a tenant other than their own. |
| FR-050 | The system shall permit a Platform Administrator to provision, suspend and configure a tenant. |
| FR-051 | The system shall maintain a single global customer identity, with all customer relationship data scoped per tenant. |
| FR-052 | The system shall prevent any tenant from observing that a customer holds a relationship with any other tenant. |

### 6.8 Module H: Public Website and Theming

| ID | Requirement |
|---|---|
| FR-046 | The system shall allow an Owner to configure branding tokens comprising logo, primary colour, secondary colour, accent colour, surface colour and font selection. |
| FR-047 | The system shall allow an Owner to manage website content through structured forms, without markup authoring. |
| FR-048 | The system shall render a public, statically generated website for each active tenant. |
| FR-049 | The system shall generate per-tenant search engine metadata, LocalBusiness structured data and an XML sitemap automatically. |
| FR-053 | The system shall allow an Owner to select a template from the available preset catalogue. |
| FR-054 | The system shall allow an Owner to configure design tokens comprising colour, typography, type scale and shape values. |
| FR-055 | The system shall allow an Owner to toggle the visibility of sections on their public site. Free reordering is deferred to Release 1.1. |
| FR-056 | The system shall render the public site from the tenant's resolved token set, template and section composition. |
| FR-057 | The system shall provide an authenticated preview of unsaved theme and content changes prior to publication. |
| FR-058 | The system shall regenerate the tenant's static public pages upon publication of a theme or content change. |
| FR-059 | The system shall populate the SERVICES section directly from the tenant's live service catalogue, requiring no duplicate content entry. |
| FR-060 | The system shall process uploaded images into responsive derivatives with appropriate compression and modern formats. |

FR-059 is the point at which the website and the booking system stop being
two products sold together and become one product. It is also the most
effective feature to demonstrate in a sales conversation.

---

## 7. Non-Functional Requirements

Functional requirements define what the system does. Non-functional
requirements define how well it does it. Their omission surfaces later as
poor performance, security defects or an unmaintainable codebase.

### 7.1 Performance

| ID | Requirement |
|---|---|
| NFR-001 | Slot availability computation shall return a response within 500 milliseconds for a single service across a two-week window under normal load. |
| NFR-002 | Standard read endpoints shall respond within 300 milliseconds at the 95th percentile. |
| NFR-023 | Public tenant pages shall achieve first contentful paint within 2.5 seconds on a simulated 3G mobile connection. |

### 7.2 Security

| ID | Requirement |
|---|---|
| NFR-003 | All network traffic shall be transmitted over Transport Layer Security. |
| NFR-004 | All request payloads shall be validated against a schema at the API boundary before reaching business logic. |
| NFR-005 | The system shall be protected against injection attacks through exclusive use of parameterised queries via the object-relational mapper. |
| NFR-006 | Authentication endpoints shall be rate limited to mitigate credential stuffing. |
| NFR-007 | No secret, credential or connection string shall be committed to version control under any circumstance. |
| NFR-008 | Customer contact information shall be readable only by that customer, by Staff assigned to their appointments, and by the Owner of the relevant tenant. |
| NFR-021 | Tenant isolation shall be enforced at both the application layer and the database layer independently. |

### 7.3 Reliability and data integrity

| ID | Requirement |
|---|---|
| NFR-009 | Every operation that writes to more than one table shall execute within a single database transaction. |
| NFR-010 | Appointment records shall never be physically deleted, only status-transitioned. |
| NFR-011 | All timestamps shall be persisted in Coordinated Universal Time. Local time shall be derived at the presentation layer using an explicitly stored IANA timezone identifier. |
| NFR-028 | A configuration fault in one section shall not prevent the remainder of a tenant's public site from rendering. |

**NFR-011 warrants emphasis.** Nepal Standard Time is UTC plus five hours and
forty-five minutes. This forty-five minute offset breaks a substantial amount
of code and a number of libraries that were only ever tested against
whole-hour offsets. Handling this correctly from the first day is not
optional. See risk RSK-03.

### 7.4 Maintainability

| ID | Requirement |
|---|---|
| NFR-012 | The codebase shall be written in TypeScript with the compiler operating in strict mode. |
| NFR-013 | A single automated linting and formatting standard shall be enforced across the repository. |
| NFR-014 | Business logic shall reside in a service layer and shall not be embedded in route handlers or user interface components. |
| NFR-015 | No logic shall be duplicated across the codebase, in accordance with the Do Not Repeat Yourself principle. |
| NFR-025 | No presentation component shall contain a hardcoded colour, font family or radius value. All such values shall derive from design tokens. |
| NFR-026 | Adding a template shall require configuration only, with no new component code. |
| NFR-027 | The administrative dashboard shall not be themable and shall present identical styling for all tenants. |

### 7.5 Portability and extensibility

| ID | Requirement |
|---|---|
| NFR-016 | The backend shall expose a client-agnostic HTTP interface returning JSON, containing no logic specific to any single client type. |
| NFR-017 | The API shall be versioned by path prefix from the first release, permitting non-breaking evolution once the mobile client exists. |
| NFR-022 | Public tenant pages shall be server-rendered or statically generated and shall be fully indexable by search engines. |
| NFR-024 | Adding a tenant shall require no code change and no deployment. |

**NFR-024 determines whether the outcome is a product or an agency.** Every
design decision from this point should be tested against it.

### 7.6 Usability

| ID | Requirement |
|---|---|
| NFR-018 | The web interface shall be functional on viewport widths from 320 pixels upward. |
| NFR-019 | Every destructive action shall require explicit confirmation. |
| NFR-020 | All error messages presented to end users shall be actionable and shall not expose internal system detail. |

---

## 8. Multi-Tenant Architecture

### 8.1 Tenant resolution

| Release | Mechanism | Example | Infrastructure |
|---|---|---|---|
| 1.0 | Subdomain | `glowparlour.platform.com.np` | One wildcard DNS record, one wildcard TLS certificate |
| 1.1 | Custom domain | `glowparlour.com.np` | Tenant CNAME plus automated per-domain certificate issuance |

The tenant identifier is resolved from the request host in middleware,
validated against the tenant table, and injected into the request context. No
route handler parses the host itself.

### 8.2 Tenant data isolation

Multi-tenancy introduces a severe failure mode. A single forgotten filter
clause in a single query causes one parlour to see another parlour's customer
list, phone numbers and revenue. That is a data breach and it ends the
business.

Isolation is not achieved by remembering to filter. It is enforced
structurally, in five independent layers.

| Layer | Mechanism |
|---|---|
| 1 | Every tenant-scoped table carries a `tenantId` column: non-nullable, foreign keyed, indexed |
| 2 | Every unique constraint is composite with `tenantId`. A service named "Haircut" must be permitted in every tenant simultaneously |
| 3 | Prisma Client Extensions inject the tenant filter automatically on every query. A developer cannot omit it because a developer never writes it |
| 4 | PostgreSQL Row Level Security policies as a backstop beneath the application layer, so a defect in layer 3 still cannot leak data |
| 5 | An automated test asserting that a request authenticated as Tenant A receives an error, not data, when requesting a Tenant B resource. Runs on every commit |

Layers 3 and 4 together are what distinguish a system that is safe by
construction from one that is safe only while every developer is careful.

### 8.3 Identity model

**Customer accounts are global. All customer relationship data is
tenant-scoped.**

A person registers once on the platform and may book at any parlour. Their
appointments, service history, notes and preferences exist separately per
parlour.

The alternative, fully isolated accounts per tenant, would force
re-registration at every parlour and would foreclose the marketplace
optionality described in section 3.5 permanently.

This carries a strict privacy obligation recorded as FR-052. A parlour must
never be able to determine that a customer also visits another parlour. The
owner sees only the relationship between that customer and their own parlour,
never the customer's platform-wide record. In a small city, and in this
specific business, that discretion matters considerably.

---

## 9. Theming Architecture

### 9.1 What creates perceived difference

Perceived identity on this class of website is carried, in approximate order
of weight, by:

1. Photography
2. Colour
3. Typography
4. Content voice
5. Layout

Layout is the last thing a non-designer notices and the first thing they ask
for. The practical consequence is that engineering investment belongs in the
image pipeline, not in layout flexibility. A parlour with excellent
photographs on a fixed template will look better than the same parlour with
mediocre photographs on a bespoke design.

This yields a concrete onboarding action: for early tenants, arrange the
photography. It is the highest-leverage hour spent per client.

### 9.2 The three layers of variation

| Layer | Mechanism | Owner-visible variation | Engineering cost |
|---|---|---|---|
| 1. Tokens | Per-tenant values | Effectively unlimited | Zero |
| 2. Composition | Which sections appear | High | Zero |
| 3. Variants | How each section renders | Two or three per section | One component, once, shared by every tenant forever |

Anything outside these three layers is not offered. That sentence is the
whole architecture.

### 9.3 Layer 1: Design tokens

```
Colour
  colorPrimary          Brand colour. Buttons, links, accents
  colorSecondary        Supporting colour. Headings, footer
  colorAccent           Highlight colour. Badges, dividers
  colorSurface          Page background

Typography
  fontHeading           Selected from a curated set of six faces
  fontBody              Selected from a curated set of four faces
  typeScale             compact | comfortable | spacious

Shape
  radiusScale           sharp | soft | round
  buttonStyle           solid | outline | pill

Identity
  logoUrl
  faviconUrl
```

Fonts are selected from a list rather than named freely. Free font input
means arbitrary external requests, unpredictable load performance, licensing
exposure, and layouts breaking on faces with unexpected metrics. A curated
set of six removes all four problems while still feeling like a choice.

### 9.4 Layer 2: Section catalogue

| Section type | Content |
|---|---|
| `HERO` | Business name, tagline, primary image, booking call to action |
| `ABOUT` | Narrative text with supporting image |
| `SERVICES` | Catalogue pulled live from the booking system |
| `STAFF` | Team profiles with photographs and specialisations |
| `GALLERY` | Image grid of work and premises |
| `TESTIMONIALS` | Owner-entered client quotations |
| `HOURS_LOCATION` | Opening hours, map, address |
| `CONTACT` | Telephone, email, social links |
| `BOOKING_CTA` | Standalone call to action band |

In Release 1.0 the owner controls visibility only. Order is platform-defined
per OPD-07. One parlour hides TESTIMONIALS because they have none. Another
hides GALLERY because their photographs are weak. Visibly different homepages,
zero new code.

### 9.5 Layer 3: Section variants and templates

```
HERO      fullbleed   Full-viewport image, overlaid text
          split       Image one side, text the other
          minimal     Typographic, no large image

SERVICES  cards       Grid of cards with price
          list        Dense rows, price aligned right
          accordion   Grouped by category, collapsible

GALLERY   masonry     Variable-height grid
          carousel    Horizontal scroll
          uniform     Fixed square grid
```

**A template is not a codebase. A template is a configuration object.** It
selects a variant per section type and supplies coherent default token
values. Nothing more. Adding a template therefore requires no new components,
no new routes and no deployment risk to existing tenants.

Release 1.0 ships two templates: **Classic** and **Modern**.

### 9.6 Scope containment

| Aspect | Constraint |
|---|---|
| Content | Structured. Owner completes forms. Content is data, never markup |
| Branding | Constrained tokens applied through CSS custom properties |
| Layout | Fixed. Two templates. The owner selects one and cannot modify it |
| Custom design | Not offered. At any price |

The theming system applies to the public tenant website only. The
administrative dashboard is never themed, per NFR-027. Theming an
administrative interface doubles the styling surface, doubles the testing
burden and delivers nothing, because no member of the public sees it and the
staff using it care about speed rather than brand.

### 9.7 Holding the boundary: the escalation ladder

Every design request is resolved at the lowest applicable rung.

| Rung | Condition | Action |
|---|---|---|
| 1 | Solvable with existing tokens | Do it immediately, no charge, in minutes. Covers the substantial majority of requests |
| 2 | Solvable by toggling sections | Do it immediately, no charge |
| 3 | Requires a new section type or variant, and would plausibly benefit other tenants | Add to the roadmap. Build once. Ship to every tenant. Charge nothing |
| 4 | Specific to one tenant and useful to nobody else | Decline |

**The governing rule: anything built ships to every tenant.** If a request
cannot be generalised, it is not built. This single rule keeps the codebase
at one and maintenance cost independent of tenant count. The pressure to
break it will come from a paying client at a moment when the revenue is
wanted.

### 9.8 The quantitative case

| | Bespoke frontends | Templated architecture |
|---|---|---|
| Delivery cost per tenant | 20 to 40 hours, not declining with experience | 1 to 2 hours, declining as onboarding is refined |
| Maintenance cost | Scales with tenant count. One bug fix at twenty tenants is twenty integrations | Independent of tenant count. One fix, one deployment, all tenants corrected |
| Practical ceiling | 10 to 15 tenants, at which point capacity is consumed by maintenance | None |

This is not a gradual difference in margin. It is the difference between a
business that compounds and one that saturates.

---

## 10. Constraints

| ID | Constraint |
|---|---|
| CON-01 | Development is performed by a single developer. |
| CON-02 | The developer is concurrently acquiring TypeScript, Prisma and relational database competency. |
| CON-03 | Initial deployment targets free or low-cost hosting tiers, implying cold start latency and constrained resources. |
| CON-04 | Primary operating timezone is Asia/Kathmandu at UTC plus 05:45. |
| CON-05 | The system must be architected such that a Flutter client can be added without backend rework. |

---

## 11. Assumptions

Assumptions are statements believed true but not yet verified. Each
represents a risk if incorrect.

| ID | Assumption |
|---|---|
| ASM-01 | Each service is delivered by exactly one Staff member. Services requiring two or more simultaneous staff are not supported in Release 1.0. |
| ASM-02 | Physical resources such as chairs, wash basins and treatment rooms are not independently constrained. Staff availability is treated as the sole limiting factor. |
| ASM-03 | Customers possess an email address and reliable internet access. |
| ASM-04 | All services are performed at the parlour premises. |
| ASM-05 | Payment is settled in person at the time of service. |

**ASM-02 warrants scrutiny.** If a parlour has four beauticians but two wash
stations, the model is incorrect and slot computation will overbook the
physical space. This must be confirmed with a practising parlour operator.

---

## 12. Risk Register

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| RSK-01 | Availability model designed incorrectly, requiring full rewrite | High | Medium | Model availability as rules plus exceptions, never as pre-generated slot rows. Design reviewed in Phase 3 before implementation |
| RSK-02 | Concurrent booking produces double allocation | High | High | Database-level exclusion constraint plus appropriate transaction isolation. Explicitly load tested |
| RSK-03 | Timezone defects arising from the 45 minute offset | Medium | High | UTC storage discipline per NFR-011. First availability test cases written against Asia/Kathmandu specifically, not against UTC or a whole-hour offset |
| RSK-04 | Scope creep into excluded features | High | High | Formal exclusion list in section 5.2. Any addition requires documented scope change |
| RSK-05 | Learning curve on three concurrent technologies stalls delivery | Medium | Medium | Increment 1 deliberately trivial in business logic, used to establish toolchain fluency |
| RSK-06 | Requirements diverge from real operator needs | High | Medium | Validate this specification against at least one practising parlour owner |
| RSK-07 | Project abandoned before completion | High | Medium | One-week increments, each ending in deployed working software |
| RSK-08 | Cross-tenant data leakage through a missing query filter | Critical | Medium | Five-layer enforcement per section 8.2 |
| RSK-09 | Tenant customisation requests erode the fixed-layout constraint, converting the product into agency work | High | High | Escalation ladder per section 9.7. Custom frontend work declined at any price |
| RSK-10 | Website component expands into a general page builder | High | Medium | Structured content only. No markup editing |
| RSK-11 | Section content stored as JSON diverges from component expectations, producing render failures | Medium | Medium | Schema validation per section type, enforced on write and on read. Graceful section-level failure per NFR-028 |

---

## 13. Phase Exit Criteria

| Criterion | Status |
|---|---|
| All open decisions OPD-01 to OPD-07 resolved | Met. See DECISION-LOG.md |
| Functional and non-functional requirements reviewed and approved | Met |
| Scope boundary accepted as binding | Met |
| Specification committed to `docs/01-requirements/SRS.md` | Met on commit of this document |
| RSK-06 retired through operator validation | Outstanding |

### Outstanding action

RSK-06 remains open. The recommended action is to walk section 6 through with
one practising parlour owner in Kathmandu before Phase 3 design work begins.
Two specific questions are worth more than the rest of the conversation
combined:

1. What do you currently do when a customer telephones while you are with a
   client?
2. Show me the websites of two parlours you admire.

If the decision is to proceed without this validation, record RSK-06 as
**accepted** rather than mitigated. An accepted risk that is documented is a
legitimate engineering position. An accepted risk that is undocumented is an
oversight.