# Increment 1: Workspace and Tenancy Schema

**Project:** Parlour Booking System
**Phase:** 4, Implementation
**Increment:** 1 of n
**Branch:** `chore/initialise-workspace`
**Status:** Complete, merged to `develop`
**Date:** 1 August 2026

---

## Purpose of This Document

This is a working log rather than a specification. It records what was built,
why each decision was made, and what was learned along the way, including the
mistakes.

Recording mistakes is deliberate. A log that shows only the successful path
teaches less than one showing where the path was unclear, and the errors
encountered here are ones that recur.

---

## 1. Increment Objective

Establish the project skeleton and prove the toolchain works end to end,
while keeping business logic close to zero.

This addresses **RSK-05**, which identified the risk that learning
TypeScript, Prisma and PostgreSQL concurrently would stall delivery. The
mitigation was to make the first increment trivial in business logic so that
toolchain fluency is established before any difficult problem is attempted.

### Definition of Done

| Criterion | Status |
|---|---|
| npm workspace resolving three packages | Met |
| TypeScript configured in strict mode per NFR-012 | Met |
| PostgreSQL provisioned and reachable | Met |
| `btree_gist` extension confirmed available | Met |
| Three models migrated, migration committed | Met |
| Prisma Client generated outside the source tree | Met |
| No secret committed, per NFR-007 | Met |
| Merged to `develop` through a pull request | Met |

---

## 2. Environment

| Component | Version | Note |
|---|---|---|
| Node.js | 24.13.0 | Exceeds the `>=20.0.0` engine requirement |
| npm | 11.6.2 | Workspaces built in, no extra tooling |
| PostgreSQL | Neon, cloud | Chosen over local install |
| Prisma | 6.19.3 | Newer than the pinned 6.2.1; see section 6.2 |
| Shell | Git Bash | Preferred over PowerShell; see below |

### 2.1 Why Neon rather than a local PostgreSQL

Both were viable. Local teaches more about roles, permissions and connection
handling, and removes network latency from every query. Neon avoids Windows
installation friction and works from any machine.

Neon was chosen. The tradeoff accepted is that every query crosses the
network, which will be noticeable during development but is irrelevant to
correctness.

One consequence worth noting: Neon's free tier suspends the compute after a
period of inactivity, so the first query after a pause may take several
seconds. This is a cold start, not a defect.

### 2.2 Why Git Bash rather than PowerShell

Both work. Consistency matters more than the choice, because quoting rules
and path separators differ between them, and switching mid-task produces
confusing errors.

Git Bash was chosen because its command syntax matches what appears in
documentation, tutorials and deployment scripts, all of which assume a
Unix-like shell.

---

## 3. Repository Structure

The structure established in this increment:

```
parlour-booking-system/
├── apps/
│   └── api/
│       ├── prisma/
│       │   ├── migrations/
│       │   │   ├── 20260801142106_init_tenancy_and_identity/
│       │   │   │   └── migration.sql
│       │   │   └── migration_lock.toml
│       │   └── schema.prisma
│       ├── src/
│       ├── .env                    NOT committed
│       ├── .gitignore
│       ├── package.json
│       ├── prisma.config.ts
│       └── tsconfig.json
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── docs/
├── package.json
├── package-lock.json
└── tsconfig.base.json
```

`apps/web` was deliberately not created. Next.js scaffolds its own directory
structure, and hand-creating folders it expects to generate causes conflicts.

---

## 4. Step by Step

### 4.1 Workspace root

**What:** Replaced the `npm init -y` output with a workspace configuration.

```json
{
  "name": "parlour-booking-system",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20.0.0" }
}
```

**Why each field:**

`"private": true` prevents accidental publication to the npm registry. Every
application repository should carry it. Omitting it means a mistyped `npm
publish` can push proprietary code public.

`"workspaces"` is the line that creates the monorepo. npm reads these glob
patterns, locates a `package.json` in each matching directory, and treats
them as one linked project. Dependencies install once into a shared
`node_modules` at the root, and internal packages become importable without
publishing anything.

`"engines"` documents the required Node version. It does not enforce by
default, but it is what a deployment platform reads to select a runtime.

**Fields removed from the generated file and why:**

| Field | Reason |
|---|---|
| `main: "index.js"` | The root is a container, not a package with an entry point |
| `directories` | Legacy field, ignored by npm |
| `test` script | Placeholder that exits with an error. Real scripts come in Phase 5 |
| `type: "commonjs"` | Belongs on individual packages, which use `"module"` |

The `license` field was changed from the generated `ISC` to `MIT` to match
the actual `LICENSE` file. `npm init -y` defaults to ISC regardless of
repository contents, and a mismatch between the declared and actual licence
is a small thing that reads as carelessness.

### 4.2 The shared package

**What:** Created `packages/shared` with Zod as its only dependency.

**Why it exists:** NFR-004 requires payload validation at the API boundary.
NFR-015 forbids duplicated logic. Together these imply that a validation
schema must be written once and used by both the API and the web form.

That is only possible if both can import the same file, which is the primary
justification for the monorepo. In separate repositories, the schema would be
defined twice and would drift.

**The boundary rule:** nothing in `shared` may import Prisma or any
server-only dependency. Its contents are bundled into the browser, so a
database import would either fail the build or leak server code to the
client.

**On the `@parlour/` scope:** the prefix groups internal packages and removes
ambiguity. `@parlour/shared` is unmistakably local; a bare `shared` could
collide with a published package.

**On `main` pointing at TypeScript source:**

```json
{ "main": "./src/index.ts", "types": "./src/index.ts" }
```

Both point at source rather than compiled output. This works because
consuming applications compile it as part of their own build. It removes a
build step and means changes are picked up immediately during development.

**On the placeholder file:**

```typescript
export {};
```

An otherwise empty `.ts` file is treated by TypeScript as a script rather
than a module, which changes how its scope behaves. `export {}` marks it as a
module. It is removed once real exports exist.

### 4.3 The API package

**What:** Created `apps/api/package.json` with runtime and development
dependencies separated.

**The dependency split, and why it matters:**

| Type | Contents | Rationale |
|---|---|---|
| `dependencies` | `express`, `zod`, `@prisma/client`, `@parlour/shared` | Required at runtime in production |
| `devDependencies` | `typescript`, `tsx`, `prisma`, `@types/*` | Required only to develop and build |

TypeScript compiles to JavaScript and is not present at runtime, so it is a
development dependency. Express is executed at runtime, so it is not.

Getting this wrong inflates production install size and, in the opposite
direction, breaks the build.

**The Prisma split specifically.** `prisma` is the CLI used to generate and
migrate, so it is a development dependency. `@prisma/client` is the generated
client imported by application code, so it is a runtime dependency.
Transposing these is a common error that breaks production deployments while
working perfectly in development.

**On `@types/*` packages.** Express and Node are written in JavaScript and
carry no type information. These packages supply TypeScript definitions
separately, maintained by the DefinitelyTyped project. Prisma and Zod are
written in TypeScript and ship their own types, which is why neither needs an
`@types` entry.

**On `tsx`.** It executes TypeScript directly without a separate compilation
step, and `tsx watch` restarts on file change. It has largely replaced the
older `ts-node` plus `nodemon` combination in current practice.

**On `"@parlour/shared": "*"`.** The asterisk means "whatever version exists
in this workspace". npm links the local directory rather than downloading
anything from the registry.

### 4.4 TypeScript configuration

**What:** A base configuration at the root, extended by each package.

**Why split rather than one file:** the API targets Node and the web
application will target the browser, so their `lib` and `module` settings
differ. Shared settings live in the base; package-specific ones override.

**The settings that matter:**

**`"strict": true`** is required by NFR-012 and is the single most consequential
line in the file. It enables a family of checks, the most significant being
`strictNullChecks`, under which `null` and `undefined` are no longer
assignable to every type.

Without it, this compiles and crashes at runtime:

```typescript
const user = await findUser(id);   // may return null
console.log(user.name);            // crash if null
```

With it, that is a compile error, caught while typing.

Enabling strict on an existing codebase is painful, which is why it is
enabled before any code exists.

**`"noUncheckedIndexedAccess": true`** goes beyond strict. It gives `array[0]`
the type `T | undefined` rather than `T`, because index 0 may not exist.

This is initially irritating and catches real defects. It will matter
particularly in the availability code, which indexes into arrays of time
slots where an empty result is a legitimate outcome.

**`"forceConsistentCasingInFileNames": true`** matters specifically on Windows.
Windows filesystems are case-insensitive, so `import "./userService"`
resolves even when the file is named `UserService.ts`. Linux servers are
case-sensitive and the import fails in production. This setting turns the
mismatch into a local compile error.

This is a defect the developer has encountered before on a previous project,
which is why it is enabled explicitly rather than left to default.

**`"skipLibCheck": true`** skips type checking inside `node_modules`. Project
code remains fully checked. It reduces compile time substantially and avoids
errors in third-party definitions that cannot be fixed locally.

### 4.5 Database provisioning

**What:** Created a Neon project, obtained the connection string, and placed
it in `apps/api/.env`.

**The security requirement.** NFR-007 states that no secret, credential or
connection string may be committed to version control under any
circumstance.

This was verified rather than assumed:

```bash
git check-ignore -v apps/api/.env
# apps/api/.gitignore:3:.env      apps/api/.env
```

The output names the ignoring file and the matching pattern, which is
definitive. Prisma had created its own `.gitignore` inside `apps/api`
containing an `.env` entry.

**Why verification matters more than the rule.** A credential committed once
remains in Git history permanently, even if a subsequent commit removes the
file. Recovery requires rewriting history, which is disruptive and easily
done incorrectly. The correct response to an exposed credential is to rotate
it first and clean history second, because a rotated credential is harmless
wherever it appears.

### 4.6 Extension verification

**What:** Confirmed `btree_gist` is available on Neon before writing any
schema.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
```

**Why this was checked first.** FR-027 requires that no staff member holds two
overlapping appointments, enforced at the database layer. The mechanism
chosen in Phase 3 is a PostgreSQL exclusion constraint, which requires
`btree_gist` for GiST index support over scalar types.

Had the extension been unavailable, the concurrency approach would have
needed redesign. Discovering that after building the schema would have been
expensive; discovering it before costs one query.

**Generalisable principle:** verify infrastructure assumptions before building
on them. The check took thirty seconds and retired the largest remaining
technical unknown in the stack.

### 4.7 First migration

**What:** Three models, `Tenant`, `User` and `Membership`, migrated to Neon.

**Why only three.** The full data model has fifteen models. Migrating all of
them at once would mean a large first migration where any error is difficult
to isolate. Three establishes the pipeline and proves it works.

These three specifically because they are the tenancy and identity core that
everything else depends upon.

**The command:**

```bash
npx prisma migrate dev --name init_tenancy_and_identity
```

`migrate dev` performs four operations: it compares the schema to the
database, generates SQL for the difference, applies it, and regenerates the
Prisma Client.

**The generated SQL, and what it teaches.** Reading
`migration.sql` against `schema.prisma` is the most efficient way to
understand Prisma, because it shows the mapping directly.

| Prisma | SQL | Note |
|---|---|---|
| `@@map("tenants")` | `CREATE TABLE "tenants"` | Singular PascalCase model, plural snake_case table |
| `enum Role` | `CREATE TYPE "Role" AS ENUM` | A real PostgreSQL type, not a string with a check |
| `@unique` | `CREATE UNIQUE INDEX` | Enforces a rule |
| `@@index` | `CREATE INDEX` | Only accelerates lookups |
| `@relation` | `ADD CONSTRAINT ... FOREIGN KEY` | Defaults to `ON DELETE RESTRICT` |

**`memberships_userId_key` is UNIQUE**, which is OPD-04 enforced by the
database. A person cannot hold two memberships, so working at two parlours
requires two accounts. That was the accepted edge case.

**`ON DELETE RESTRICT`** was Prisma's default and happens to align with
NFR-010. A tenant cannot be deleted while memberships reference it; the
database refuses.

### 4.8 A deferred issue

The generated SQL produced `TIMESTAMP(3)`, which is timestamp **without** time
zone.

The design requires `timestamptz`, and the exclusion constraint uses
`tstzrange`, which operates on timezone-aware timestamps. When the
`Appointment` model is added, its time fields need an explicit annotation:

```prisma
startAt DateTime @db.Timestamptz(3)
```

This is recorded here so it is not discovered during the booking increment.
It is not a problem in the current three models, none of which participate in
time comparison.

---

## 5. Files Committed

Twelve files, 2,255 insertions.

| File | Purpose |
|---|---|
| `package.json` | Workspace root |
| `package-lock.json` | Exact dependency versions |
| `tsconfig.base.json` | Shared TypeScript configuration |
| `apps/api/package.json` | API package manifest |
| `apps/api/tsconfig.json` | API TypeScript configuration |
| `apps/api/.gitignore` | Created by Prisma; ignores `.env` |
| `apps/api/prisma.config.ts` | Prisma datasource configuration |
| `apps/api/prisma/schema.prisma` | Data model source of truth |
| `apps/api/prisma/migrations/.../migration.sql` | Generated SQL |
| `apps/api/prisma/migrations/migration_lock.toml` | Records the database provider |
| `packages/shared/package.json` | Shared package manifest |
| `packages/shared/src/index.ts` | Shared package entry point |

### 5.1 On committing package-lock.json

`package-lock.json` records the exact resolved version of every package in
the dependency tree. Committing it means anyone cloning the repository
installs precisely what the developer has, rather than whatever is newest at
the time.

It must never be added to `.gitignore`. Omitting it is a common error that
produces the "works on my machine" class of defect.

### 5.2 On committing migrations

Migration files are committed and are never edited after being applied. Each
environment replays the identical sequence, which is what keeps development,
staging and production schemas identical.

Editing an applied migration causes environments to diverge silently. If a
migration is wrong, the correction is a new migration, not a modification of
the old one.

---

## 6. Errors Encountered

Recorded because each is likely to recur.

### 6.1 Empty package.json

**Symptom:**

```
npm error code EJSONPARSE
npm error JSON.parse Invalid package.json: Unexpected end of JSON input
  while parsing empty string
```

**Cause:** a `package.json` file had been created but its content was never
saved.

**Diagnosis:** `cat` each `package.json` in turn. The one printing nothing is
the culprit.

**Lesson:** "Unexpected end of JSON input while parsing empty string" always
means an empty file, not malformed content. The two errors read similarly and
have different causes.

### 6.2 Prisma version drift

**Symptom:** `prisma init` generated a `prisma.config.ts` file and a
generator block using `provider = "prisma-client"` with an `output` path
inside the source tree. None of this matched the expected 6.2.1 layout.

**Cause:** `npx` fetched the latest Prisma, 6.19.3, rather than the version
pinned in `package.json`.

**Resolution:** the generator was changed to `prisma-client-js`, which is the
stable generator matching the installed `@prisma/client`, and the `output`
line was removed so the client generates to the default location in
`node_modules`.

**Why the output path mattered.** Generating into `src/generated/prisma`
places machine-generated code inside the source tree, where it lands in Git
and appears in every diff. Generated artifacts belong in `node_modules`.

**Lesson:** `npx <tool> init` runs the latest published version regardless of
what the project declares. Verify generated configuration against what the
project actually expects rather than assuming it matches.

### 6.3 Wrong file extension

**Symptom:** `packages/shared/src/index.js` was staged rather than
`index.ts`.

**Impact, had it been committed:** `package.json` declares `"main":
"./src/index.ts"`, so the file would not have resolved. It would also have
been excluded from type checking entirely.

**Resolution:**

```bash
git rm --cached packages/shared/src/index.js
mv packages/shared/src/index.js packages/shared/src/index.ts
git add packages/shared/src/index.ts
```

`git rm --cached` unstages without deleting the file from disk.

**Lesson:** this is exactly what the pull request diff review is for. Reading
`git status` before committing caught it in seconds; discovering it later
would have meant debugging a module resolution failure.

### 6.4 Deleting a branch before its pull request merged

**Symptom:** `git pull` reported "Already up to date" immediately after an
apparent merge, and the newly added files were absent from the working
directory.

**Cause:** the local branch was deleted while the pull request was still open
on GitHub. `git branch -d` permitted the deletion because the branch matched
its remote counterpart, not because it had reached `develop`.

**Resolution:** the commit was still present on the remote branch. Merging
the pull request and pulling again restored everything. No work was lost.

**Lesson, and it is the most useful one in this section:** `git pull`
reporting "Already up to date" immediately after a merge means the merge did
not happen. Treat that message as a signal to stop and check rather than as
confirmation.

The correct order is: merge the pull request on GitHub, pull and confirm
files arrive, then delete the local branch.

---

## 7. Version Control

**Branch:** `chore/initialise-workspace`
**Commit:** `chore(config): initialise workspace and tenancy schema`
**Merge:** squash, into `develop`, via pull request

The `chore` type was correct here. This increment added tooling and
configuration but no user-visible functionality, which is precisely what
`chore` denotes. A `feat` commit would have been inaccurate.

### 7.1 On the two-step merge

Each change requires a local commit and push, then a merge on GitHub, then a
pull to bring the merge back. The friction is real and has two causes: branch
protection on `develop` requiring a pull request, and the absence of the
GitHub CLI.

The workflow was retained deliberately rather than simplified by removing
branch protection. Pull request review is a professional habit worth
building, and it is how the wrong file extension in section 6.3 was caught.

Installing the GitHub CLI would reduce this to a single command while
preserving the discipline:

```bash
gh pr create --fill && gh pr merge --squash --delete-branch
```

This is recommended before the increments involving application code, where
diffs become large enough that review genuinely matters.

---

## 8. Carried Forward

| Item | Detail |
|---|---|
| `@db.Timestamptz` | Required on `Appointment` time fields. See 4.8 |
| Exclusion constraint | Written by hand into a migration when `Appointment` is added |
| Row Level Security | SRS 8.2 layer 4, added alongside the tenant-scoped models |
| Remaining twelve models | Added incrementally, not in one migration |
| GitHub CLI | Recommended before code increments begin |
| UC-36 open questions | Customer notification on expiry, and whether the expiry clock is bounded by appointment start |

---

## 9. Next Increment

**Increment 2: Express server foundation**

Scope:

- Environment configuration with startup validation
- Express server with a health endpoint
- Error handling middleware and the `ApiError` type
- The response envelope from the API contract
- Confirmation that the three-layer structure works end to end

Still deliberately trivial in business logic. The purpose is to establish the
layering pattern that every subsequent module follows, and to write the first
substantial TypeScript in the project.