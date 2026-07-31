# SDLC Methodology

**Document status:** Approved
**Phase:** Pre-Phase 1
**Last updated:** 31 July 2026

---

## 1. Selected Model

**Incremental and Iterative development, executed with lightweight Agile
practices, preceded by a formal upfront Requirements and Design phase.**

In industry shorthand this is a hybrid model, sometimes called Agile with a
design spike. It is neither pure Waterfall nor pure Scrum. It takes the
discipline of the first and the adaptability of the second.

---

## 2. How the Model Operates

### 2.1 Formal upfront phases

Phases 1 through 3 are completed in sequence and produce written artifacts:

- A software requirements specification
- A domain model and entity relationship diagram
- An API contract and architecture definition

This work is done once and done properly, because these are the decisions
that are expensive to reverse after implementation begins.

### 2.2 Incremental implementation

Implementation proceeds in vertical slices. Each increment cuts through every
layer of the system: database, backend endpoint, frontend screen, tested and
deployed.

```
Increment 1    A customer can register and log in
Increment 2    An owner can define services
Increment 3    An owner can define staff availability
Increment 4    A customer can view available slots
...
```

Each increment ends with working software deployed to a live environment.
No increment ends with a half-finished layer.

### 2.3 Cadence

| Parameter | Value |
|---|---|
| Iteration length | One week |
| Iteration contents | Two to four user stories, each a vertical slice |
| Definition of Done | See CONTRIBUTING.md section 4 |
| Backlog | Single prioritised list, groomed at iteration start |
| Tooling | GitHub Projects |

---

## 3. Rationale

### 3.1 It fits an API-first, web-then-mobile roadmap

The requirement is a web application now and a Flutter application later.
That is by definition incremental delivery of the same product. The model
forces the backend to be treated as a stable, versioned contract that any
client can consume.

A methodology that encouraged building web and backend as one entangled unit
would make the mobile phase a rewrite rather than an addition.

### 3.2 It protects against both beginner failure modes

Beginners fail in one of two directions:

1. Plan nothing, start coding, produce an unmaintainable tangle.
2. Plan endlessly, never ship, lose motivation.

The upfront design phase prevents the first. Short incremental delivery
cycles prevent the second.

### 3.3 Requirements are not yet fully knowable

The needs of a Kathmandu parlour owner have not been directly verified. Any
model assuming requirements are fully knowable at the outset would fail here.
Incremental delivery permits showing working software early, gathering
correction, and adjusting.

### 3.4 It produces evidence of competence

Each increment is a deployable milestone with a clean commit history, which
is directly visible to any employer or client reviewing the repository.

---

## 4. Rejected Alternatives

| Model | Reason for rejection |
|---|---|
| **Waterfall** | Requires complete frozen requirements before implementation and delivers working software only at the end. Its failure mode is discovering a fundamental misunderstanding after months of work. Defensible for regulated or safety-critical systems with immovable specifications. This is not that. |
| **V-Model** | Waterfall with a formal testing counterpart per phase. Same rigidity, greater documentation overhead. Appropriate for aerospace, medical devices and defence contracting. Disproportionate here. |
| **Spiral** | Organised around formal risk analysis cycles. Designed for large, high-risk, high-budget systems. Ceremony cost far exceeds the project's risk profile. |
| **Pure Scrum** | Scrum's mechanisms are built around team coordination: sprint planning, standups, reviews, retrospectives, a Product Owner and a Scrum Master. A solo developer performing these rituals is performing theatre. Adopt the useful parts, being a prioritised backlog and timeboxed iterations, and discard the rest. |
| **Big Bang** | Build with no plan and see what emerges. This is the default behaviour of most self-taught developers and the reason most of their projects are abandoned. |

---

## 5. Phase Definitions

| Phase | Name | Primary deliverable | Directory |
|---|---|---|---|
| 1 | Planning and Requirements Gathering | Software Requirements Specification | `docs/01-requirements/` |
| 2 | System Analysis | Use case model, domain model, ERD, business rules | `docs/02-analysis/` |
| 3 | System Design | Architecture, folder structure, schema, API contract | `docs/03-design/` |
| 4 | Implementation | Working software, delivered incrementally | `docs/04-implementation/` |
| 5 | Testing | Test plan, test cases, defect log | `docs/05-testing/` |
| 6 | Deployment and Maintenance | Deployment runbook, monitoring, support process | `docs/06-deployment/` |

Each phase has explicit exit criteria recorded in its own document. A phase is
not closed until its criteria are met and its artifacts are committed.
