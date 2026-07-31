# Setup Guide

Repository and local environment setup, written for someone who has not
created a GitHub repository before. Follow the steps in order. Do not skip
ahead.

**Scope note:** this guide sets up the repository and the documentation only.
No application code, no Node.js, no database and no folder structure for the
application is created here. That work belongs to Phase 3 and Phase 4.

---

## Part 1: Install and Configure Git

### Step 1.1: Check whether Git is already installed

Open a terminal. On Windows, open **Git Bash** if it exists, otherwise open
**PowerShell**. Type:

```bash
git --version
```

If a version number appears, Git is installed and you may skip to step 1.3.
If you see an error, continue to step 1.2.

### Step 1.2: Install Git

Download from `https://git-scm.com/downloads` and run the installer.

Accept every default **except** these two screens:

| Screen | Choose |
|---|---|
| Choosing the default editor | Select your editor. Visual Studio Code if installed, otherwise leave as Vim and change it later |
| Adjusting the name of the initial branch | Select **Override the default branch name** and enter `main` |

The second choice matters. Git's historical default branch name was `master`
and GitHub's is `main`. Setting this now avoids a mismatch on your first push.

Close and reopen the terminal after installation, then verify:

```bash
git --version
```

### Step 1.3: Configure your identity

Git records an author name and email on every commit. Set them once, globally.

```bash
git config --global user.name "Ashish Niraula"
git config --global user.email "your.email@example.com"
```

Use the same email address you will register with GitHub. If they differ,
your commits will not be linked to your GitHub profile and will not appear on
your contribution graph.

### Step 1.4: Configure line endings

This step is specific to Windows and prevents a category of problem that is
tedious to fix later.

```bash
git config --global core.autocrlf true
```

Windows and Unix systems terminate lines differently. Without this setting,
files can appear entirely rewritten in a diff when nothing has actually
changed.

### Step 1.5: Set the default branch name

```bash
git config --global init.defaultBranch main
```

### Step 1.6: Verify the configuration

```bash
git config --global --list
```

You should see your name, email, `core.autocrlf` and `init.defaultBranch`.

---

## Part 2: Create the GitHub Repository

### Step 2.1: Create a GitHub account

If you do not have one, register at `https://github.com`. Use the same email
address configured in step 1.3.

Enable two-factor authentication when prompted. GitHub requires it, and
enabling it now is less disruptive than being forced to later.

### Step 2.2: Create the repository

1. Click the **plus** icon in the top right, then **New repository**
2. Complete the form:

| Field | Value |
|---|---|
| Repository name | `parlour-booking-system` |
| Description | Multi-tenant appointment booking platform for beauty parlours |
| Visibility | **Public** |
| Add a README file | **Leave unticked** |
| Add .gitignore | **None** |
| Choose a licence | **None** |

3. Click **Create repository**

The three "leave unticked" choices are deliberate. You already have a README,
a `.gitignore` and a `LICENSE` prepared. Letting GitHub create its own
versions would produce a conflict on your first push, which is a confusing
problem to encounter on day one.

### Step 2.3: Note the repository URL

After creation GitHub shows a page with setup instructions. Copy the HTTPS
URL, which looks like:

```
https://github.com/YOUR-USERNAME/parlour-booking-system.git
```

Keep this page open. You will need the URL in step 3.4.

---

## Part 3: Set Up the Local Repository

### Step 3.1: Choose a location

Create a folder for your projects if you do not have one. Avoid any folder
synchronised by OneDrive, Google Drive or Dropbox. Cloud synchronisation
tools conflict with Git and corrupt repositories.

```bash
# Windows, in Git Bash
mkdir -p /c/dev
cd /c/dev
```

```bash
# macOS or Linux
mkdir -p ~/dev
cd ~/dev
```

### Step 3.2: Place the project files

Download and extract the provided project files into this folder. When
complete, the structure should be exactly this:

```
/c/dev/parlour-booking-system/
|
+-- .gitignore
+-- CONTRIBUTING.md
+-- LICENSE
+-- README.md
|
+-- docs/
    +-- DECISION-LOG.md
    +-- SETUP-GUIDE.md
    |
    +-- 00-methodology/
    |   +-- sdlc-methodology.md
    |
    +-- 01-requirements/
    |   +-- SRS.md
    |
    +-- 02-analysis/
    |   +-- system-analysis.md
    |
    +-- 03-design/
    +-- 04-implementation/
    +-- 05-testing/
    +-- 06-deployment/
```

Navigate into it:

```bash
cd parlour-booking-system
```

Verify the contents. The `-a` flag is required to show `.gitignore`, because
files beginning with a full stop are hidden by default.

```bash
ls -a
```

You must see `.gitignore` in the output. If it is missing, the file was not
extracted correctly, and everything in Part 4 will behave incorrectly.

### Step 3.3: Initialise the repository

```bash
git init
```

This creates a hidden `.git` folder containing the entire version history.
Do not open it, modify it or delete it.

### Step 3.4: Connect to GitHub

Replace `YOUR-USERNAME` with your actual GitHub username.

```bash
git remote add origin https://github.com/YOUR-USERNAME/parlour-booking-system.git
```

Verify:

```bash
git remote -v
```

Two lines should appear, one marked `(fetch)` and one marked `(push)`.

`origin` is simply a conventional nickname for the primary remote repository.
It carries no special meaning beyond convention.

---

## Part 4: The First Commit

### Step 4.1: Inspect the current state

```bash
git status
```

Every file appears in red under "Untracked files". Git can see them but is
not yet tracking them.

**Confirm that no folder named `node_modules` and no file named `.env`
appears in this list.** Neither should exist yet, but forming the habit of
checking now is what prevents a credential leak later.

### Step 4.2: Stage the files

```bash
git add .
```

The full stop means "everything in the current folder and below". Files
matching a pattern in `.gitignore` are excluded automatically.

### Step 4.3: Verify what was staged

```bash
git status
```

Files now appear in green under "Changes to be committed". Read the list.
Everything you intend to commit should be present, and nothing you do not
intend to commit should be.

This verification step takes three seconds and prevents the single most
common beginner mistake, which is committing something that should never
enter version control.

### Step 4.4: Create the commit

The commit message follows the Conventional Commits format defined in
`CONTRIBUTING.md`.

```bash
git commit -m "chore(config): initialise repository with project documentation

Adds repository scaffolding comprising README, licence, gitignore and
contributing standards, together with Phase 1 and Phase 2 documentation.

Phase 1 output covers scope, sixty functional requirements, twenty-eight
non-functional requirements, the actor model, assumptions, constraints and
the risk register, and records resolution of OPD-01 through OPD-07.

Phase 2 output covers the use case model, the eighteen-entity domain model,
the entity relationship diagram, the appointment lifecycle state model, the
availability computation model and the business rules catalogue."
```

A commit message spanning several lines is entered by including the line
breaks inside the quotation marks, exactly as shown. The terminal will show a
continuation prompt until you type the closing quotation mark.

### Step 4.5: Push to GitHub

```bash
git push -u origin main
```

You will be prompted to authenticate. A browser window may open, or you may
be asked for a personal access token. If a password prompt appears, note that
GitHub no longer accepts account passwords over HTTPS. Generate a personal
access token instead:

1. GitHub, then **Settings**, then **Developer settings**
2. **Personal access tokens**, then **Tokens (classic)**
3. **Generate new token**, select the `repo` scope
4. Copy the token and use it in place of the password

Store the token somewhere safe. GitHub will not show it again.

The `-u` flag sets `origin/main` as the upstream branch for `main`. After
this first push, plain `git push` is sufficient.

### Step 4.6: Verify

Refresh the repository page on GitHub. Your files should be visible and the
README should render below the file listing.

---

## Part 5: Create the Develop Branch

Per `CONTRIBUTING.md`, `main` holds production-ready code only, and `develop`
is the integration branch where all work lands first.

```bash
git checkout -b develop
git push -u origin develop
```

`git checkout -b` creates a branch and switches to it in one command.

Confirm which branch you are on:

```bash
git branch
```

An asterisk marks the current branch. From this point forward, all working
branches are created from `develop`, never from `main`.

---

## Part 6: Configure Branch Protection

Branch protection prevents accidental damage to your permanent branches. It
is configured on GitHub, not locally.

1. On the repository page, click **Settings**
2. Click **Branches** in the left sidebar
3. Click **Add branch protection rule**

Create one rule for each permanent branch.

### Rule for `main`

| Setting | Value |
|---|---|
| Branch name pattern | `main` |
| Require a pull request before merging | Ticked |
| Require approvals | **Unticked**. As a solo developer you cannot approve your own pull request |
| Do not allow bypassing the above settings | Unticked for now. Tick it once you have a collaborator |
| Allow force pushes | Unticked |
| Allow deletions | Unticked |

Click **Create**.

### Rule for `develop`

Repeat with the branch name pattern `develop` and identical settings.

### Set the default branch

1. **Settings**, then **General**
2. Under **Default branch**, click the switch icon
3. Change from `main` to `develop`

This means anyone visiting the repository sees `develop` first, and new pull
requests target `develop` by default, which is correct for your workflow.

---

## Part 7: Daily Workflow

This is the loop you will repeat for every unit of work from now on.

```bash
# 1. Start from a current develop
git checkout develop
git pull

# 2. Create a working branch
git checkout -b feature/short-description

# 3. Do the work, committing as you go
git add .
git commit -m "feat(scope): describe the change in imperative mood"

# 4. Push the branch
git push -u origin feature/short-description

# 5. Open a pull request into develop on GitHub

# 6. READ THE COMPLETE DIFF before merging

# 7. Merge with squash, delete the remote branch on GitHub

# 8. Clean up locally
git checkout develop
git pull
git branch -d feature/short-description
```

**Step 6 is not optional and is not ceremonial.** Reading your own diff
before merging catches a consistent proportion of defects and is one of the
highest-value habits available to a developer.

---

## Part 8: Recovering From Common Mistakes

### I committed but have not pushed, and the message is wrong

```bash
git commit --amend -m "correct message here"
```

### I committed but have not pushed, and I want to undo the commit entirely

```bash
# Keeps your file changes, undoes the commit
git reset --soft HEAD~1
```

### I staged a file by mistake and have not committed

```bash
git restore --staged path/to/file
```

### I am on the wrong branch and have uncommitted work

```bash
git stash
git checkout correct-branch
git stash pop
```

### I committed a secret

Stop. Do not simply delete the file and commit again. The secret remains in
history and is retrievable by anyone with repository access.

1. Immediately revoke and regenerate the exposed credential at its source
2. Then deal with the history

Revoking first matters more than cleaning the history, because a revoked
credential is harmless regardless of where it appears.

---

## Part 9: What Comes Next

Phase 3, System Design, produces:

- The application folder structure, with architectural layering
- The physical database schema in Prisma
- The API contract with versioning
- The authorisation model
- The concurrency mechanism discharging FR-027

Only after Phase 3 is complete does Phase 4 begin, at which point Node.js,
PostgreSQL, Next.js and the application folder structure are created.

**Do not install Node.js or PostgreSQL yet.** Installing tools before knowing
what you are building with them produces configuration you will discard.
