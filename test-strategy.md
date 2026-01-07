# Rhombus AI – Test Strategy (Software Engineer – Test)

## Scope and assumptions
Rhombus AI is a production web app that creates data pipelines from user actions (AI-assisted and manual), runs transformations, previews results, and exports datasets. The highest-value regression coverage focuses on the workflows that produce (or fail to produce) correct outputs, not cosmetic UI behavior.

This strategy assumes:
- A user can create a project, upload CSV/XLSX, build/execute a pipeline, preview the final node, and download results.
- The free plan has limits (file size, total project data), so tests keep inputs small and predictable.

---

## 1. Top five regression risks (risk-based)

### 1) Data ingestion and file parsing (CSV/XLSX)
**Impact:** If ingestion breaks, users can’t start any workflow. Parsing bugs silently corrupt downstream results (wrong delimiter/encoding, mis-typed columns, header handling).  
**Why likely to regress:** Upload + parsing touches frontend, backend storage, and parsing libraries; changes here are frequent and high blast radius.  
**Best test layers:**
- API/network: verify upload request succeeds and returns a dataset identifier.
- UI E2E smoke: prove a real upload appears in the project and becomes selectable/usable.
- Data validation: validate schema/row count between input and output.

### 2) Pipeline execution orchestration (async runs, job state)
**Impact:** The core promise is “pipeline runs → output available”. If orchestration regresses, runs hang, misreport status, or produce stale outputs.  
**Why likely to regress:** Background jobs, queues, and status polling are classic sources of race conditions and partial failures.  
**Best test layers:**
- API/network: poll execution status transitions deterministically (queued → running → succeeded/failed).
- UI E2E: assert run completion by observing stable UI signals (not time-based sleeps).
- Flake controls: retries are not a fix; prefer polling a real “run complete” signal.

### 3) Transformation correctness (manual operators)
**Impact:** Users trust transformations to be correct (trim, dedupe, type coercion, missing-value handling). Wrong results are worse than failures because they look “successful”.  
**Why likely to regress:** Transform code evolves; edge cases appear with nulls, mixed types, locale formats, and quoting.  
**Best test layers:**
- Data validation script: assert deterministically on schema, row count, and specific columns after known transforms.
- API/network: validate export/download content type and “new output” is generated for a run.

### 4) Export / download reliability
**Impact:** Export is the “deliverable moment”. If download fails, users are blocked at the end of the workflow.  
**Why likely to regress:** Auth/session changes, signed URLs expiring, content-disposition headers, large file streaming.  
**Best test layers:**
- API/network: verify download endpoint returns expected status, headers, and non-empty body.
- UI E2E: assert that a user can trigger download from final node preview.

### 5) AI-assisted behavior (prompt → pipeline suggestion/build)
**Impact:** AI is a headline feature; failures degrade trust quickly (wrong transform, hallucinated steps, non-terminating runs).  
**Why likely to regress:** Model updates, prompt templates, safety filters, and tool-calling logic can change independently of UI.  
**Best test layers:**
- UI E2E “bounded assertion” smoke: validate the system produces *a pipeline* and runs to completion from a known prompt, without asserting exact cell-level output.
- Offline evaluation: separate from CI; run curated prompt suites and compare metrics rather than strict string matches.

---

## 2. Automation prioritization (what first vs not yet)

### Automate first (highest signal per maintenance cost)
1) **Happy-path pipeline E2E (one excellent test)**  
   - Login → create project → upload CSV → apply 2 deterministic transforms → run → preview → download.
   - Goal: prove end-to-end viability and catch major breakages quickly.

2) **API/network tests around auth + download**  
   - Auth/session is a common root cause for many failures (401s, CSRF, cookie changes).
   - Download tests give quick confidence without UI flake.

3) **Data correctness validation**  
   - Enforces “correct output” beyond “workflow completed”.
   - Keeps the test suite honest.

### Intentionally not automated yet (or automated later)
- **Pixel-perfect UI checks / layout assertions**: low value, high churn.
- **Deep AI semantic correctness** in CI: too probabilistic and fragile; better handled as separate evaluation runs with tolerant scoring.
- **Broad transformation matrix** (all transforms x all types): start with a small, representative set and expand based on incident history.

---

## 3. Test layering strategy

### UI end-to-end (Playwright)
**Purpose:** Catch integration failures between frontend + backend that real users feel:
- navigation, auth, upload, pipeline run, preview, download.
**Design principles:**
- Use role/text selectors or data-testid (prefer data-testid if available).
- Replace sleeps with explicit waits for UI conditions (status changes, element visible, network idle when appropriate).
- Keep the number of E2E tests small and high value.

### API / network-level tests
**Purpose:** Fast feedback for:
- auth/session correctness,
- upload endpoints,
- run status polling,
- download endpoints,
- negative/error cases.
**Approach:**
- Use black-box observed endpoints (captured via Playwright tracing/HAR).
- Assert status codes, required fields, and non-empty payloads.
- Avoid coupling to internal DB or hidden implementation.

### Data validation (Python)
**Purpose:** Prove transformation correctness deterministically.
- Validate schema and row counts.
- Validate deterministic rules (e.g., trimmed whitespace, duplicates removed, date parse success rate).
- Define tolerances where needed (e.g., for imputation if a transform is non-deterministic).

---

## 4. Regression strategy (what runs when)

### On every pull request (fast gate)
- Lint + typecheck
- API tests (auth + at least one negative test)
- 1 UI smoke E2E test (headless)
- Upload/download sanity + small data validation

### Nightly
- Full UI regression set (still small; maybe 3–6 tests max)
- Broader API matrix
- Larger data-validation set (more columns/types, boundary cases)
- Flake detection runs (repeat key tests N times and track variance)

### Pre-release / release block
- Full PR suite + nightly suite
- Run with “release-like” config (prod parity env vars, stricter logging/artifacts)
- No quarantined tests allowed to block release unless promoted back to active

---

## 5. Testing AI-driven behavior (keeping it stable)

### What I assert (stable)
- A pipeline is created (node(s) appear / run exists).
- Execution reaches a terminal state (succeeded/failed) within a bounded time.
- Output is downloadable and non-empty.
- Output schema contains expected columns when the prompt explicitly requests stable structural changes (e.g., “remove empty rows”, “trim whitespace”).

### What I avoid asserting
- Exact natural language wording in AI responses.
- Exact ordering/structure of generated steps (models change).
- Exact row-by-row values unless the operation is strictly deterministic.

### How to keep it bounded
- Use a small, curated input dataset.
- Use prompts with narrow intent and unambiguous outcomes.
- Allow limited tolerance checks (e.g., “>= 95% dates parsed”), and treat the rest as evaluation rather than CI gating.

---

## 6. Flaky test analysis (common causes + mitigation)

### Likely flake sources in this system
- **Async pipeline execution**: variable run times; status polling changes.
- **Eventual consistency**: uploaded dataset visible after a short delay.
- **AI variability**: different step plans, slightly different outputs.
- **Download timing**: signed URLs, delayed file availability.
- **Selector instability**: dynamic DOM, canvas nodes.

### Detecting flakiness over time
- Track pass rate per test (CI history) and “re-run needed” counts.
- Nightly “repeat runs” for smoke tests (e.g., run the same test 5 times).
- Log timing metrics (upload duration, run duration) and flag regressions.

### Reducing / eliminating flake
- Prefer API polling for “run complete” rather than UI spinners.
- Use deterministic manual transforms for CI-gating E2E.
- Use Playwright tracing + screenshots + console/network logs for diagnosis.
- Quarantine truly flaky tests behind a tag, fix root cause, then re-enable.

## 7. Demo and execution notes (take-home submission)

### Demo video scope

Demo Video.mov included in Git Repo

The demo video walks through the UI automation structure (test flow, selectors/waits, and artifact generation). The API/network test scripts are included in the repository and follow the same black-box contract approach described above, however I did not execute them during the recording due to intermittent instability observed in the Rhombus AI environment while running automated flows.

### Data validation status
The data validation script is included and ready to run against the input CSV and the downloaded output. During execution, the automation was not consistently able to download the transformed output CSV from the AI prompt flow (download action intermittently did not produce a file event). As a result, the validation step could not be demonstrated end-to-end in the video.

### Completion and next steps
All required deliverables are provided in the repository (test strategy, UI automation suite, API/network test suite, CI design, and data validation script). If you would like, I can:
- run the API and data-validation steps live in a follow-up session once the environment is stable, or
- adapt the UI test to use a fully manual transformation path (more deterministic) so the download step consistently produces an artifact for validation.

I’m happy to clarify any design decisions or walk through the implementation details.
