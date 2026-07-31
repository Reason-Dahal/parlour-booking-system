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
| OPD-08 | Automatic confirmation or staff approval | Resolved |
| OPD-09 | Fixed or per-tenant slot granularity | Resolved |
| OPD-10 | Immediate or deferred staff assignment | Resolved |

All open decision points are closed. Phase 1 and Phase 2 design decisions are
settled.

---

## OPD-01: Single parlour or multi-tenant platform

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

## OPD-02: Home service in Release 1.0

**Resolution:** Excluded.

**Rationale:** Home service introduces customer address, travel time and
service radius into slot computation. This would substantially increase the
complexity of the single most difficult component in the system before that
component has been proven to work in its simple form.

---

## OPD-03: Online deposit in Release 1.0

**Resolution:** Excluded. Deferred to Release 1.1.

**Rationale:** Payment gateway integration carries reconciliation logic,
refund handling and failure-state management, none of which is necessary to
demonstrate the core value proposition. Per ASM-05, payment is settled in
person at the time of service.

---

## OPD-04: Staff tenancy scope

**Resolution:** A Staff member belongs to exactly one tenant.

**Consequences:**

- `staffProfileId` carries `tenantId` directly
- No join table is required between StaffProfile and Tenant
- A person working at two parlours would require two accounts. This is
  accepted as an edge case not worth modelling

---

## OPD-05: Service category scope

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

## OPD-06: Number of templates in Release 1.0

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

## OPD-07: Section reordering

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

## OPD-08: Automatic confirmation or staff approval

**Question:** Does an online booking become CONFIRMED automatically, or enter
PENDING awaiting staff approval?

**Resolution:** A per-tenant policy flag, `requiresApproval`, on
BookingPolicy, defaulting to `false`, meaning automatic confirmation.

**Options considered:**

| Option | Assessment |
|---|---|
| Always automatic | Best customer experience. Rejected because some owners will refuse to adopt a system that books their time without their consent |
| Always approval | Rejected. Introduces a delay between request and confirmation that customers will not tolerate, and creates a daily task the owner did not ask for |
| Per-tenant flag | Adopted. Costs one boolean column. Permits the owner to begin cautiously and relax the setting once they trust the system |

**Rationale:** Automatic confirmation is what booking platforms have trained
people to expect, and any delay between request and confirmation increases
abandonment. However, an owner who does not yet trust the system will not
adopt it if it commits their time without their consent. The flag resolves
this at negligible cost, and it is expected that most owners will switch it
off within the first month.

**Consequences:**

1. A PENDING appointment **must occupy time** in the availability
   computation. If it does not, approval is meaningless, because a second
   customer could book the same slot while the first awaits a decision. This
   is reflected in the availability model, stage 3, which subtracts
   appointments in status PENDING or CONFIRMED.

2. **A PENDING appointment must expire.** This consequence was not identified
   when the decision was first framed and constitutes a genuine gap in the
   specification.

   If a PENDING appointment holds its slot and the owner never acts on it,
   the slot is frozen indefinitely. It is invisible to other customers, it
   generates no error, and it produces no dashboard signal. An owner who does
   not open the dashboard for a week would find every requested slot blocked
   while their calendar appeared empty.

   The failure presents to the operator as "customers say they cannot book
   but I have no appointments", which is extremely difficult to diagnose from
   that description.

   Resolved by adding FR-061, BR-21, UC-36 and a PENDING to CANCELLED
   transition initiated by the Scheduler. The expiry period is configurable
   per tenant via `pendingExpiryHours`, defaulting to 24.

3. BR-14 required amendment. Load balancing previously counted CONFIRMED
   appointments per staff member. With PENDING appointments now occupying
   real time, the rule counts active appointments, meaning PENDING or
   CONFIRMED. Without this change the assignment logic would systematically
   overload whichever staff member held the most pending requests.

**Note on delegation:** the default value of this flag is a commercial
judgement rather than a technical one, and it depends on how Kathmandu
parlour owners actually respond to a system booking their time. Because the
decision is expressed as a per-tenant flag rather than as platform behaviour,
it is cheap to reverse for any individual tenant and cheap to change as a
platform default. This is why delegating it carried low risk.

---

## OPD-09: Slot granularity

**Question:** Is slot granularity fixed platform-wide at 15 minutes, or
configurable per tenant?

**Resolution:** A per-tenant field, `slotGranularityMinutes`, on
BookingPolicy, defaulting to 15, constrained to the set
{5, 10, 15, 20, 30, 60}.

**Rationale:** A parlour whose shortest service is 45 minutes may prefer 30
minute granularity to present a cleaner grid with fewer choices. A parlour
offering short services such as threading may want 10 minutes. The field
costs one column now and cannot be retrofitted later without recomputing
every cached availability response.

**Why the value set is constrained:** an unconstrained integer permits values
such as 7 or 13, which produce slot grids that do not align to any
recognisable clock pattern and are unusable in practice. Every permitted
value divides 60 evenly, so slot boundaries align to a recognisable pattern
within each hour.

**Note on the 45 minute offset:** the alignment described above is alignment
in **local** time. In UTC, a Kathmandu tenant's slots fall on quarter-hour
boundaries offset from the hour, because Nepal Standard Time is UTC+05:45.
This is expected and correct. See the worked example in the system analysis,
section 8.1.

---

## OPD-10: Staff assignment timing

**Question:** When a customer selects "any available staff", is the staff
member assigned at booking time or left unassigned for the owner to allocate
later?

**Resolution:** Assignment at booking time, deterministically, per BR-14.

**Rationale:** Deferred assignment sounds flexible but creates an entire
category of problems, the first of which is disqualifying on its own:

1. **An unassigned appointment cannot participate in overlap detection.** The
   FR-027 guarantee is expressed as a constraint on a staff member's reserved
   intervals. An appointment with no staff member is outside that constraint
   entirely, so the system could not guarantee that assigning it later would
   not create a conflict. This alone rules the option out.

2. The customer cannot be told who will serve them, which materially degrades
   the confirmation.

3. The owner acquires a daily allocation task they did not ask for, in a
   system sold on the promise of reducing administrative work.

**Consequences:**

- `staffProfileId` on Appointment remains **not null**
- BR-14 governs deterministic assignment, so two identical requests always
  produce the same outcome, which keeps the system testable and support
  conversations tractable
- The owner may reassign an appointment manually after creation. Reassignment
  is subject to the same overlap constraint as booking

---

## Requirements Added by These Decisions

| ID | Requirement | Source |
|---|---|---|
| FR-061 | The system shall automatically transition a PENDING appointment to CANCELLED if it has not been approved or declined within a configurable expiry period. | OPD-08 |
| BR-21 | A PENDING appointment shall hold its slot until it is approved, declined or expired. | OPD-08 |
| UC-36 | Expire unapproved pending appointment. Initiated by ACT-06, Scheduler. | OPD-08 |
| BR-14 (amended) | Load balancing counts active appointments, meaning PENDING or CONFIRMED, rather than CONFIRMED alone. | OPD-08 |

---

## Resulting BookingPolicy Fields

The three decisions above, together with FR-024, FR-025 and FR-030, fully
define the per-tenant booking policy.

| Field | Default | Source |
|---|---|---|
| `requiresApproval` | `false` | OPD-08 |
| `pendingExpiryHours` | 24 | FR-061 |
| `slotGranularityMinutes` | 15 | OPD-09 |
| `minAdvanceNoticeHours` | 2 | FR-024 |
| `maxBookingHorizonDays` | 60 | FR-025 |
| `cancellationCutoffHours` | 4 | FR-030 |

Every value is a per-tenant default that the owner may adjust. None is
hardcoded anywhere in the application.

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