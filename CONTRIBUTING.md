# Contributing Guide

Engineering standards for the Parlour Booking System. These standards apply
from the first commit, including commits that contain documentation only.

---

## 1. Branching Strategy

The strategy is a simplified GitFlow. Full GitFlow adds release branches and
hotfix coordination overhead that a solo developer does not need at this
stage. The omitted branch types can be introduced later without restructuring
anything that already exists.

### 1.1 Permanent branches

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Production-ready code only | Protected. Never receives a direct commit. Every commit is deployable. |
| `develop` | Primary integration branch | Protected. Reflects the state of the next release. |

### 1.2 Temporary branches

| Prefix | Purpose | Branched from | Merged into |
|---|---|---|---|
| `feature/` | New functionality | `develop` | `develop` |
| `bugfix/` | Defect in unreleased code | `develop` | `develop` |
| `hotfix/` | Urgent production defect | `main` | `main` and `develop` |
| `docs/` | Documentation only | `develop` | `develop` |
| `chore/` | Tooling, dependencies, configuration | `develop` | `develop` |

### 1.3 Naming convention

Format: `type/short-kebab-case-description`. Where a tracked issue exists,
include the issue number.

```
feature/customer-registration
feature/23-availability-slot-engine
bugfix/17-reschedule-timezone-offset
docs/software-requirements-specification
chore/configure-eslint-prettier
```

Branch names are lowercase throughout. Mixed-case branch names cause defects
when a repository is shared between case-insensitive and case-sensitive
filesystems.

### 1.4 Branch lifecycle

```bash
# 1. Ensure the integration branch is current
git checkout develop
git pull

# 2. Create the working branch
git checkout -b feature/customer-registration

# 3. Commit work in atomic units, as often as useful

# 4. Push the branch
git push -u origin feature/customer-registration

# 5. Open a pull request into develop on GitHub

# 6. Read the complete diff before merging

# 7. Merge using squash, then delete the remote branch

# 8. Clean up locally
git checkout develop
git pull
git branch -d feature/customer-registration
```

Step 6 is not ceremonial. Reading your own complete diff before merging is
one of the highest-value habits available to a developer and it catches a
consistent proportion of defects before they reach the integration branch.

### 1.5 Branch protection

Configure on GitHub under Settings, then Branches, for both `main` and
`develop`:

- Require a pull request before merging
- Disallow force pushes
- Disallow deletion

---

## 2. Commit Message Convention

The Conventional Commits specification is adopted. It is the prevailing
industry standard, it is machine-parsable, and it permits automated changelog
generation and semantic version derivation.

### 2.1 Structure

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 2.2 Permitted types

| Type | Use |
|---|---|
| `feat` | A new feature visible to a user |
| `fix` | A defect correction |
| `docs` | Documentation only |
| `style` | Formatting with no change in meaning |
| `refactor` | Restructuring that neither fixes a defect nor adds a feature |
| `perf` | A change that improves performance |
| `test` | Adding or correcting tests |
| `build` | Build system or dependency changes |
| `ci` | Continuous integration configuration |
| `chore` | Maintenance falling outside all other types |
| `revert` | Reverting a previous commit |

### 2.3 Permitted scopes

```
auth, service, staff, availability, booking, notification,
dashboard, report, tenant, theme, db, api, web, config, deps
```

### 2.4 Subject line rules

- Imperative mood. Write `add`, not `added` or `adds`.
- Lowercase initial character.
- No terminating full stop.
- Fifty characters or fewer.

The imperative mood convention exists because Git's own generated messages
use it. A subject line should correctly complete the sentence
"if applied, this commit will ...".

### 2.5 Compliant examples

```
feat(auth): add customer registration endpoint

Implements FR-001 through FR-004. Passwords are hashed with bcrypt at a
cost factor of 12. Email uniqueness is enforced by a database constraint
rather than an application-level check, preventing a race condition under
concurrent registration.

Refs: #12
```

```
fix(booking): prevent overlapping appointments under concurrency

Application-level availability checking permitted a race condition in
which two simultaneous requests both observed a slot as free. Replaced
with a PostgreSQL exclusion constraint over a tstzrange, which moves the
guarantee into the database engine.

Implements: FR-027
Closes: #41
```

```
docs(api): document availability computation endpoint
```

```
chore(deps): upgrade prisma to 5.22.0
```

### 2.6 Non-compliant examples

| Message | Defect |
|---|---|
| `updated files` | No type, no scope, no information content |
| `Fix bug` | Which defect, in what area, resolved how |
| `feat: added login.` | Past tense and a terminating full stop |
| `FEAT(AUTH): Add Login` | Incorrect casing throughout |
| `wip` | Work in progress is not a unit of change |

### 2.7 Breaking changes

A change that breaks an existing API contract is marked with an exclamation
mark after the scope and described in the footer. This becomes relevant once
the Flutter client consumes the API.

```
feat(api)!: restructure appointment response payload

BREAKING CHANGE: the staff field is replaced by a nested staff object
containing id, name and specialisation. Clients reading staff as a string
identifier must be updated.
```

### 2.8 Commit discipline

- One commit represents one logical change. If the subject line requires the
  word "and", the work should be two commits.
- Commit frequently on a working branch and squash on merge. This provides a
  granular local safety net during development and a clean history on
  `develop`.
- Never merge code that does not compile into `develop` or `main`. A broken
  integration branch blocks all subsequent work.

---

## 3. Commenting Standard

### 3.1 Single-line explanation uses single-line syntax

```typescript
// Convert the requested date to UTC before querying, since all timestamps
// are persisted in UTC per NFR-011.
const utcDate = zonedTimeToUtc(requestedDate, tenant.timezone);
```

### 3.2 Block explanation uses multi-line syntax

```typescript
/*
 * Computes bookable slots for a given service, staff member and date.
 *
 * Slots are derived at request time rather than stored, because a
 * materialised slot table would require regeneration on every change to
 * working hours, exceptions, service duration or booking policy, and would
 * be silently incorrect between regenerations.
 *
 * The computation proceeds in four stages:
 *   1. Resolve the effective working window from recurring rules
 *   2. Apply any date-specific exception, which overrides rather than merges
 *   3. Subtract existing non-cancelled appointments plus their buffers
 *   4. Discretise the remaining intervals at the configured granularity
 *
 * Implements: FR-022, FR-023
 * Business rules: BR-08, BR-09, BR-10
 */
```

### 3.3 Public interfaces use JSDoc

```typescript
/**
 * Retrieves available appointment slots for a service on a given date.
 *
 * @param serviceId - Identifier of the requested service
 * @param staffId   - Identifier of a specific staff member, or null to
 *                    evaluate all staff qualified for the service
 * @param date      - Target date in ISO 8601 format, interpreted in the
 *                    tenant's configured timezone
 * @returns Ordered array of available slots, each expressed in UTC
 * @throws  ServiceNotFoundError when the service does not exist or is
 *          inactive within the resolved tenant
 */
```

### 3.4 The governing principle

A comment explains **why**, not **what**. Code already states what it does. A
comment that restates the code adds maintenance burden without adding
information, and becomes actively harmful when the code changes and the
comment does not.

```typescript
// Incorrect. Restates the code and carries no information.
// Increment the counter by one
counter++;

// Correct. States a reason the code cannot express.
// Buffer is applied after the service rather than before, because cleanup
// is the constraining activity in this domain and applying it beforehand
// would incorrectly block the first slot of the day.
const reservedUntil = addMinutes(serviceEnd, service.bufferMinutes);
```

### 3.5 Requirement traceability in comments

Where a function implements a numbered requirement or enforces a numbered
business rule, cite the identifier. This is what allows the question "which
code implements FR-027" to be answered by searching rather than by reading.

---

## 4. Definition of Done

A unit of work is complete when all of the following hold.

1. The code compiles with the TypeScript compiler in strict mode.
2. Linting and formatting pass with no warnings.
3. The change has been manually exercised through the user interface or API.
4. Automated tests covering the change pass.
5. Comments explain non-obvious decisions and cite requirement identifiers.
6. The branch is merged into `develop` through a reviewed pull request.
7. Any affected documentation in `docs/` is updated in the same pull request.

Item 7 matters. Documentation stored outside the repository diverges from
reality within weeks. Documentation updated in a separate later commit
diverges within days.
