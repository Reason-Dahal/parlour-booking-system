# Decision Log

Every significant design decision, its resolution and its rationale. This
document exists so that a decision is never revisited from scratch, and so
that the reasoning behind a constraint remains available after the reasoning
itself has been forgotten.

Decisions are recorded as OPD entries, meaning Open Decision Point. An OPD is
opened when a question is identified and closed when it is answered.

---

## Status Summary

| ID | Question | Status |
|---|---|---|
| OPD-01 | Single parlour or multi-tenant platform | Resolved |
| OPD-02 | Home service in Release 1.0 | Resolved |
| OPD-03 | Online deposit in Release 1.0 | Resolved |
| OPD-04 | Staff belong to one tenant or several | Resolved |
| OPD-05 | Global or per-tenant service categories | Resolved |
| OPD-06 | Number of templates in Release 1.0 | Resolved |
| OPD-07 | Section reordering or visibility toggling only | Resolved |
| OPD-08 | Automatic confirmation or staff approval | Open |
| OPD-09 | Fixed or per-tenant slot granularity | Open |
| OPD-10 | Immediate or deferred staff assignment | Open |

---

## Resolved Decisions

### OPD-01: Single parlour or multi-tenant platform

**Resolution:** Multi-tenant platform. Many parlours as tenants.

**Consequences:**

- Actor ACT-05, Platform Administrator, is confirmed as existing
- Nearly every table requires a `tenantId` column
- Tenant isolation becomes the highest-severity risk in the project, recorded
  as RSK-08 and mitigated through the five-layer enforcement in SRS section
  8.2
- Marketplace optionality is preserved for a future release, though nothing
  is built toward it

---

### OPD-02: Home service in Release 1.0

**Resolution:** Excluded.

**Rationale:** Home service introduces customer address, travel time and
service radius into slot computation. This would substantially increase the
complexity of the single most difficult component in the system before that
component has been proven to work in its simple form.

---

### OPD-03: Online deposit in Release 1.0

**Resolution:** Excluded. Deferred to Release 1.1.

**Rationale:** Payment gateway integration carries reconciliation logic,
refund handling and failure-state management, none of which is necessary to
demonstrate the core value proposition. Per ASM-05, payment is settled in
person at the time of service.

---

### OPD-04: Staff tenancy scope

**Resolution:** A Staff member belongs to exactly one tenant.

**Consequences:**

- `staffProfileId` carries `tenantId` directly
- No join table is required between StaffProfile and Tenant
- A person working at two parlours would require two accounts. This is
  accepted as an edge case not worth modelling

---

### OPD-05: Service category scope

**Resolution:** Categories are global, maintained by the Platform
Administrator.

**Consequences:**

- The Category table carries no `tenantId` column
- **This is the sole exception to platform-wide tenant isolation.** It must be
  recorded prominently, because an isolation audit in Phase 5 will otherwise
  flag it as a defect
- Global categories enable future cross-tenant comparison and discovery
- Business rule BR-18 records that no tenant may modify a category

**Noted alternative:** a per-tenant custom category escape hatch was
considered and not adopted in Release 1.0. It remains available later without
schema disruption.

---

### OPD-06: Number of templates in Release 1.0

**Resolution:** Two templates. Classic and Modern.

**Rationale:** Two is sufficient to demonstrate genuine choice in a sales
conversation while keeping the initial build small. A third and fourth are
inexpensive to add later because a template is configuration rather than
code, per NFR-026.

**Template definitions:**

```
Classic   HERO split, SERVICES list, GALLERY uniform
          Serif heading, comfortable scale, soft radius

Modern    HERO fullbleed, SERVICES cards, GALLERY masonry
          Geometric sans heading, spacious scale, round radius
```

---

### OPD-07: Section reordering

**Resolution:** Visibility toggling only in Release 1.0. Free reordering
deferred to Release 1.1.

**Rationale:** Reordering requires drag-and-drop interaction, position
reconciliation and additional validation. None of it is difficult, but none
of it needs to exist in the first release. Visibility toggling alone already
produces visibly distinct homepages.

**Schema consequence:** the `position` column on TenantSection is retained,
because Release 1.1 will need it, but it is populated from a platform-defined
canonical ordering rather than from owner input. The reordering interface is
not built.

---

## Open Decisions

### OPD-08: Automatic confirmation or staff approval

**Question:** Does an online booking become CONFIRMED automatically, or enter
PENDING awaiting staff approval?

**Recommendation:** A per-tenant policy flag on BookingPolicy, defaulting to
automatic confirmation.

**Reasoning:** Automatic confirmation is a materially better customer
experience and is what booking platforms have trained people to expect. Some
owners will nonetheless insist on approving every booking, particularly early
on when they do not yet trust the system, and a flag costs almost nothing.

**Critical constraint if approval is adopted:** PENDING appointments must
still hold the slot. If a pending appointment does not occupy time in the
availability computation, approval is meaningless and double booking becomes
possible.

---

### OPD-09: Slot granularity

**Question:** Is slot granularity fixed platform-wide at 15 minutes, or
configurable per tenant?

**Recommendation:** A per-tenant field on BookingPolicy defaulting to 15
minutes.

**Reasoning:** A parlour whose shortest service is 45 minutes may prefer 30
minute granularity to present a cleaner grid. The field costs one column now
and cannot be retrofitted without recomputing every cached availability
response later.

---

### OPD-10: Staff assignment timing

**Question:** When a customer selects "any available staff", is the staff
member assigned at booking time or left unassigned for the owner to allocate
later?

**Recommendation:** Assignment at booking time, per BR-14.

**Reasoning:** Deferred assignment sounds flexible but creates an entire
category of problems:

1. Unassigned appointments do not participate in overlap detection, so the
   system cannot guarantee FR-027
2. The customer cannot be told who will serve them
3. The owner acquires a daily allocation task they did not ask for

Assign immediately and permit the owner to reassign manually afterwards.

---

## How to Add a Decision

1. Open the entry with a unique OPD identifier and a clearly stated question.
2. Record the options considered, not only the one chosen.
3. Record the resolution and the consequences, particularly schema
   consequences.
4. Where the decision was made against a recommendation, record why.
5. Commit the change in the same pull request as any specification amendment
   it causes.

A decision recorded without its rationale is only marginally more useful than
no record at all. The rationale is what allows the decision to be revisited
intelligently when circumstances change.
