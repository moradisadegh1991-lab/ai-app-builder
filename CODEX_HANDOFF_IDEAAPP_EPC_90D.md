# Codex Handoff — 90-Day Revenue & Cost-Control Program

**Prepared:** 2026-11-17  
**Planning horizon:** 2026-11-17 → 2027-02-15 (90 days)  
**Language for user-facing reports and UI:** Persian (fa-IR), RTL  
**Primary repository:** https://github.com/moradisadegh1991-lab/ai-app-builder — default branch `main`  
**Secondary repository:** https://github.com/moradisadegh1991-lab/iso-weld-map-source — default branch `master`  
**Primary task now:** IdeaApp Builder commercial readiness and cost safety; EPC is a separate, lower-priority sales-demo stream.

## 1) Your role and rules

You are Codex, acting as staff full-stack engineer, AI-agent architect, security reviewer, FinOps analyst, product owner, and pragmatic technical cofounder. Execute actual coding, tests, and documentation in the checked-out repository as tools allow. Do not stop at giving high-level advice if implementation is possible. Use the repository's `AGENTS.md` and local conventions, if present.

**Crucial:** First inspect real current code. The technical information below is a working handoff from an earlier review, **not a guarantee that any feature passes tests or works in production**. Avoid creating parallel systems or refactoring unrelated code. Preserve all existing working flows and data; use small, reviewable migrations. Never push secrets, print API tokens, or expose connection strings in outputs. Do not modify production infrastructure, migrate production data, cancel paid services, merge to `main`/`master`, or deploy to production without explicit owner authorization. For a write-capable session, make a dedicated feature branch and commit tested changes if permitted; otherwise prepare patch/complete files and commands.

The owner prefers complete replacement files if requested: give **entire file content**, split into clearly numbered contiguous parts if long, never snippets presented as complete files. Codex should explain exact commands and paths and report actual test outcomes, without inventing green checks.

## 2) Commercial goal, finances, and constraints

**Non-negotiable 90-day outcome:** By 2027-02-15, IdeaApp Builder should have real paying customers and generate enough *monthly contribution margin* (revenue minus variable operating costs) to cover its attributable monthly fixed hosting/API/maintenance costs. It is **not** required to fund all EPC development costs immediately. EPC should have a credible engineering sales demo and a defined pilot offering to obtain contract opportunities.

Earlier combined spending reported by owner: **18,000,000 toman per month**, previously categorized as VPS **8,000,000**, AI API **4,000,000**, AI subscriptions **6,000,000**. These are self-reported high-level totals, **not** reconciled invoices. Later clarification of architecture: EPC is hosted on **Liara VPS**, IdeaApp Builder on **Vercel**, AI APIs purchased via **Liara AI**, owner uses **ChatGPT Plus** for development. A prior mention of two VPSs may reflect historic or additional services; DO NOT assume two VPSs still need billing/cancellation. Reconcile actual monthly charges before setting a savings figure.

Guiding principles:
- Keep one paid VPS if feasible based on measured RAM/CPU/disk and security; use current Liara VPS first as migration candidate. Do **not** assume a single 8GB VPS can safely host parallel, untrusted user-code builds.
- Prefer existing GitHub Actions for APK builds and tests, subject to minutes, costs and safe limits.
- Maintain ChatGPT Plus if useful; Plus and production API usage are separate bills.
- Avoid new paid subscriptions, self-hosted GPU, and unnecessary new agent frameworks until proven valuable.
- Do not buy annual infrastructure before baseline and functional tests.
- A successful Build should have logged cost, margin and a deliverable; a failed Build needs a bounded retry policy.
- Vercel commercial plan suitability must be checked before launch; do not assume Hobby is appropriate for a paid product.

**90-day rough milestones (targets, not forecasts):**
- Days 1–7: reliable end-to-end measured build, per-run spend controls, free-tier cost protection, baseline metrics.
- Days 8–21: landing/demo and payment path tested, approach 20 qualified prospects, target 2 paid pilots.
- Days 22–45: support early users, improve reliability, target >=5 cumulative paying customers.
- Days 46–70: standardized repeatable paid package, target >=10 cumulative paying customers.
- Days 71–90: 30-day contribution margin >= attributable monthly fixed IdeaApp operating costs; reassess the model if not achieved.

## 3) Current architecture discovered previously: verify against source

`ai-app-builder` README and files were accessible in an earlier GitHub inspection. This is the known baseline:

- Next.js 16 App Router + TypeScript + React + Tailwind 4; Persian RTL interface.
- PostgreSQL + Drizzle; Vercel/Neon support and local PostgreSQL TCP support.
- Multi-agent code-generation architecture already documented in `docs/agentic-workflows.md`: Architect → Designer → Frontend and Backend in parallel → tool verification → Independent Reviewer → bounded Debugger loop.
- PostgreSQL queue, leases, checkpointing and workflow retries; a Worker may run in Vercel Workflow or a self-hosted Docker-backed worker.
- GitHub integration for private repos, commits, GitHub Actions to build Android APK; optional customer VPS deployment agent.
- AI gateway routing through Liara, per-role model/provider overrides, central keys versus user-owned (BYOK) keys.
- Existing token reservation/settlement and rolling 5-hour/weekly quotas; payments via Zarinpal and Stripe apparently have code paths, *not yet production verified*.
- Existing payment plans resemble $20 / $100 / $200 subscriptions rather than a validated local-market unit-economics offering.

**High-value known paths (re-open and verify):**
- `README.md`
- `docs/agentic-workflows.md`
- `package.json`
- `src/lib/billing/plans.ts`
- `src/lib/billing/payments.ts`
- `src/lib/billing/subscription.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/lib/workflows/budgets.ts`
- `src/lib/ai/index.ts`
- `src/lib/ai/liara-pricing.ts`
- `src/lib/ai/providers.ts`
- `src/lib/agents/` and related workflow code
- `src/lib/db/schema.ts`
- `src/lib/pipeline.ts`
- `drizzle/0007_atomic_usage_and_payments.sql` plus subsequent migrations
- `drizzle/all-in-one.sql` and Drizzle migration journal
- `scripts/agent-worker.ts`, `worker/`
- `src/app/pricing/page.tsx`
- `.github/workflows/`
- `.env.example` (read names only; do not reveal secret values)

**Existing identified risks to verify:**
1. In prior inspection, free plan in `src/lib/billing/plans.ts` had 100K tokens / 5h, 300K / week, 2 projects, APK/build allowed. These allowances may cause serious free-user spend. Check latest code before changing.
2. `src/lib/workflows/budgets.ts` enforced token counts, not a proven **atomic money-denominated limit** per user, project and job. Token counts do not reflect different model prices, provider exchange rate, retries, cached tokens or vision costs.
3. `src/lib/ai/liara-pricing.ts` had a catalog-price fetch, including USD-denominated rates, and optional administrator-configured IRT pricing. Distinguish price quotes from actual merchant invoices. Missing/unknown prices must not silently count as zero for platform-paid requests.
4. The README shows paid-plan checkout, but do not claim Zarinpal works end-to-end unless sandbox callback and double-post verification tests pass.
5. Self-hosted worker runs untrusted generated code in containers. Evaluate isolation, resource limits, network restrictions, secrets handling, filesystem boundaries, permissions and concurrent jobs before co-locating it with EPC data.

## 4) Immediate assignment: Sprint 1 (first 7 days) — implement and verify

### Step A — Repository audit, baseline and plan
1. Confirm repo/root, current branch, worktree cleanliness, latest commits and `AGENTS.md` guidance.
2. Map core workflows: signup → idea → spec → generation → code verification → GitHub push → APK build → delivery; signup → pricing → checkout → callback → entitlement; API usage → reservation → settlement → ledger.
3. Run existing `npm ci`, `npm run typecheck`, `npm test`, and sample checks if environment permits, **without triggering paid AI operations**. Record real outcomes, log blockers. Avoid installing globally or editing production config.
4. Produce `docs/90-day-readiness-audit.md` with architecture, code evidence, risks by P0/P1/P2, and a dependency-aware implementation plan. Track what is implemented, only documented, and unverified.

### Step B — Financial safety (P0)
Implement an incremental, backwards-compatible system that achieves all of the following:

**Spend measurement / ledger**
- Store immutable per-provider-call metering or append-only ledger entries with job/run ID, user ID, project ID (when applicable), stage/agent role, gateway/provider/model, in/out tokens, additional billable categories if returned (cached/reasoning/image/tool), billable currency, rate snapshot/source, estimated versus invoiced cost distinction, timestamp, request status, and idempotency key. Never store prompts or secrets in cost logs unless truly necessary.
- Ensure each central-platform-key usage is attributed to the correct user/project/job. BYOK calls should not be mistakenly counted as platform financial cost.
- Handle unsupported/unknown or stale tariffs conservatively: block new centrally billed requests with an actionable message, or require administrator approval/explicit budget reserve. NEVER assume unpriced requests cost zero.
- Introduce conversion snapshot (e.g. USD → toman) only from configured trusted source or explicit admin setting, with date; do not hardcode a guessed exchange rate.
- Compute **cost per successful deliverable**, including failed/retried requests and build overhead. Expose data through admin-only reporting.

**Atomic limits and controls**
- Add hard daily/monthly limits per platform, user and project, per-job maximum cost, max concurrent generation, and low-balance warnings.
- Budget reserve must be atomic and safe under parallel jobs. Settle with actual provider token usage; handle timeout/unknown charges conservatively and idempotently. Note remote provider billing may still occur on a timeout.
- Existing rolling token limit remains as secondary guard; money budget is additional.
- Ensure the pipeline stops before exceeding maximum reservation threshold. Do not repeatedly call expensive models on exhausted budgets.
- Set prudent defaults via config (not invented tariffs); admin can control limits without code deploy if existing admin settings allow, or use validated env variables.

**Free tier / paid plans**
- Propose a cheap trial that allows **idea analysis + partial preview** but not unlimited code generation, APK builds, expensive agents, or premium models on central keys.
- Do not silently remove purchased entitlements from existing users. Provide migration and communication plan for policy changes.
- Keep BYOK supported, with fairness limits and safe compute quotas.
- Introduce credit-pack/pay-per-project economic design as a proposal first; implement only the minimal safe billing changes needed for first pilot users, reusing existing subscriptions and payments. Avoid building a second billing system if current design suffices.

### Step C — Tests and evidence (P0)
Add/extend automated tests proving:
- atomic reservation race safety and idempotent settlement;
- real cost across different models/rates and currency snapshot;
- invalid/unknown price fails closed for platform-funded usage;
- retries/timeouts and negative balance do not bypass limits;
- free-tier cannot incur uncontrolled premium-model/build expenditure;
- purchased user entitlements and BYOK behavior are preserved;
- payment verification handles duplicate callbacks without granting double credit;
- no real AI tokens or real payments are consumed in test suite.

Run and report: typecheck, unit/integration tests, migration checks on a disposable PostgreSQL test DB when feasible, lint if configured, Next.js build, plus offline sample verifier. If something requires external secrets/production, leave it untested with an explicit manual checklist. Do not claim success without execution evidence.

### Step D — Admin and user metrics (P1 only after P0)
Build the smallest viable admin view: paid orders, active customers, generation count, success/failure, average time-to-delivery, gross revenue, AI variable cost, per-order contribution margin and monthly break-even progress. Use role-based server authorization. Ensure financial numbers are reconciled versus gateway invoices; avoid presenting estimated AI cost as final billed cost.

## 5) Sales MVP — following sprint, not a reason to delay P0

Offer early **done-with-you** paid pilot app generation, not unlimited everything-for-everyone automation. Target pilot categories:
1. field service / daily inspection reports;
2. basic maintenance request / PM tracking;
3. appointment or order capture for small businesses.

Example **hypotheses to test**, not hardcoded live prices:
- simple template-based app: 699,000 toman;
- limited-scope custom MVP: 1,490,000 toman;
- custom B2B projects: starting around 4,900,000 toman (requires quote).

Define exact scope, revision quota, expected delivery, APK ownership and hosting/API exclusions before accepting money. Measure actual unit economics, payment conversion and time spent on manual QA. Goal: sell 2 pilot projects in 21 days, 10 cumulative customers in 70 days; if no one buys by day 21, revisit the offer instead of adding expensive features.

Deliver a clean RTL landing/pricing conversion funnel and two usable showcase apps only after P0 safeguards. A prospective customer should understand how it works, what is included, what is not included, and whether cloud hosting is extra. Do not promise guaranteed APK or one-click unlimited builds.

## 6) Deployment and infrastructure constraints

Current declared operational picture: EPC on Liara VPS, IdeaApp Builder on Vercel, AI via Liara gateway. The plan is to consider **one shared paid VPS**, not to rush a live migration.

Before infrastructure changes:
1. Gather Liara VPS specs, memory high water mark, disk, CPU and current EPC service topology.
2. Check Vercel plan and current app DB location, API routes, workflow/sandbox dependencies; moving the Next.js front-end does not automatically port Vercel Workflows/Sandbox.
3. Decide whether web app and core DB can safely co-locate while offloading APK builds to GitHub Actions. Do not run user-generated code in a privileged process next to EPC PostgreSQL.
4. Plan backups, restore drill, TLS, domains, environment variable transfer, rollback path and cutover checklist.
5. Produce comparison of retaining Vercel vs migrating, including Vercel Workflow/Sandbox rewrite cost, not just listed VPS price.
6. No destructive move until approved.

Potential stack: Nginx/Caddy, Docker Compose with separate isolated application services, PostgreSQL databases/roles, Redis if actually needed, GitHub Actions, existing AI gateway and metrics. Avoid introducing n8n, LiteLLM, additional databases, observability paid products or agents if an existing component handles the need. n8n can be used **later** for opt-in budget alerts and CRM if lightweight.

## 7) EPC parallel track (bounded effort)

Secondary repo `iso-weld-map-source`, branch `master`, currently hosted on Liara VPS. No unrelated major rewrite during IdeaApp revenue sprint.

Within 90 days, prepare one reproducible sales-demo flow:
**Upload isometric → extract BOM/welds → engineering review/correction → register → Excel/PDF export**, with traceable accuracy on a curated sample and human review for ambiguous engineering data. Offer a paid pilot around a limited set of 50–100 drawings after scoping. Keep engineering calculations deterministic and validated; AI output must not be silently accepted as approved engineering truth. Targets: 3 qualified customer conversations and at least 1 paid pilot request/quotation.

Do not commit EPC changes from within the IdeaApp repo. Keep work streams and feature branches separate.

## 8) Required Codex output / reporting format

At the end of each work session respond in Persian with:
1. **Current verified state:** branch, commit, source paths inspected, what works and what is only described in docs.
2. **Changes made:** complete list of changed files and the behavior they implement; any migrations and rollback instructions.
3. **Tests run:** exact commands and PASS/FAIL/NOT RUN, with concise failure details.
4. **Financial implication:** what expense is now measured/limited, and what is still unknown; do not claim a savings estimate without evidence.
5. **Security & deployment:** risks, secrets precautions, confirmation nothing live was changed unless authorized.
6. **Next smallest executable task:** keep focus on 90-day revenue goal.

**First Codex response should start by inspecting the repository and running offline baseline tests, not by installing a new agent framework or proposing a rewrite.** If execution tools are unavailable, produce a verified, actionable patch plan and complete files for manual replacement. Make the first PR limited to cost-control foundation and free-tier safety. No production deployment/merge without explicit owner approval.

## 9) One-message kickoff prompt to paste in Codex

> Read this handoff document as the project brief. Work in `moradisadegh1991-lab/ai-app-builder` on a new `feat/90day-revenue-sprint1` branch (choose a unique suffix if it exists). Inspect the actual repository, including AGENTS.md, before any edits. Run offline baseline checks and audit existing agent, billing, Liara gateway, usage and payment paths. Implement the smallest safe P0 changes for atomic **toman-denominated spend control** and cost-per-successful-build measurement without breaking existing workflows, purchased entitlements or BYOK. Add database migrations and tests; reduce unbounded free-plan spend. Reuse current multi-agent architecture and payments; do not create duplicative systems. Do not call live paid AI or payment APIs, do not print secrets, do not deploy, and do not merge to main. Finish with a Persian report of inspected paths, full changed-file list, test evidence, risks, and next step. If the working tree is dirty or key assumptions fail, preserve existing work and explain the blocker rather than overwriting.
