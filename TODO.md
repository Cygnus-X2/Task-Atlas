# Task Atlas TODO

## Product Direction

Task Atlas should not become "just another priority table."

The real job to support is:

- keep track of multiple business areas without losing visibility
- separate operational work from change work
- protect weekly focus instead of reacting to whatever is loudest
- connect tactical tasks to larger goals
- schedule work against real calendar constraints
- keep task completion and execution truth inside the planner

The planner should be:

- simple enough to maintain daily
- structured enough to reduce clutter
- opinionated enough to create focus

## Core Principles

- Do not rely on vague manual priority fields like `Urgent` and `Important`
- Do not force one prioritization model to do every job
- Keep explicit fields small in number and high in signal
- Derive views like `Focus`, `Quick win`, and `Needs clarity` from structured data
- Make weekly planning a first-class workflow, not just a table sort
- Keep the planner as source of truth for task state and completion
- Treat the calendar as a planning constraint first, not as the task system

## Recommended Core Model

Replace the current emphasis on `Urgent` and `Important` with a stronger structure:

- `Task`
- `Status`
- `Area`
- `Mode`
- `Owner`
- `Effort`
- `Due`
- `Goal`
- `Notes`

Field intent:

- `Area`: where the work belongs, for example `Sales`, `Hiring`, `Finance`, `KPIs`, `Product`, `BU`
- `Mode`: `Run` or `Change`
- `Owner`: `Me` or `Delegate`
- `Effort`: `<5m`, `15m`, `30m`, `1h`, `2h+`
- `Due`: only when there is a real date
- `Goal`: optional strategic anchor

Why this is the better balance:

- `Area` keeps the portfolio visible
- `Mode` separates operational load from strategic change
- `Owner` makes delegation explicit instead of burying it inside priority logic
- `Effort` supports execution and scheduling
- `Goal` gives strategic context without turning every task into abstract "importance"

## Views To Derive

These should mostly be derived views, not extra manual fields:

- `Focus`
- `This week`
- `Quick wins`
- `Strategic`
- `Delegatable`
- `Needs clarity`
- `By area`
- `By goal`
- `Weekly review`

Design rule:

- explicit fields create structure
- derived views create prioritization

## Roadmap

### Phase 1: Fix The Model

- [ ] Remove or deprecate `Urgent` and `Important`
- [ ] Introduce `Area`
- [ ] Introduce `Mode` with `Run` / `Change`
- [ ] Introduce `Owner` with `Me` / `Delegate`
- [ ] Keep `Effort` as effort buckets
- [ ] Add optional `Goal` linkage
- [ ] Keep `Due`, `Status`, `Created`, and `Completed`
- [ ] Avoid reintroducing a generic manual `Prio` field

### Phase 2: Reduce Clutter

- [ ] Add a `Focus` view that shows a small, intentional set of work instead of the full backlog
- [ ] Add a `Needs clarity` view so underspecified tasks stop polluting planning
- [ ] Add a `Delegatable` view so handoff candidates are obvious
- [ ] Add a `Strategic` view based on `Mode = Change` and/or linked goals
- [ ] Add a `Quick wins` view based on short effort
- [ ] Let the user move between `Area`, `Goal`, and `Focus` views easily

### Phase 3: Weekly Planning

- [ ] Make weekly planning a dedicated mode, not just sorting
- [ ] Surface a weekly shortlist or commit list
- [ ] Encourage a deliberate mix of `Run` and `Change` work
- [ ] Let the user mark 1-3 weekly strategic commitments
- [ ] Distinguish `planned this week` from `scheduled on calendar`
- [ ] Build a weekly review that shows what moved, stalled, or was finished

### Phase 4: Goals And Breakdown

- [ ] Add lightweight goals as first-class objects
- [ ] Let tasks link to a goal
- [ ] Support goal-to-task breakdown
- [ ] Show why a task matters by showing its goal context
- [ ] Add a goal view that starts with outcomes and drills into tasks
- [ ] Make it easy to create concrete next actions from a goal

### Phase 5: Calendar-Aware Planning

- [ ] Add a right-side calendar planning panel
- [ ] Subscribe to Outlook calendar as read-only input
- [ ] Show existing Outlook events as blockers/constraints
- [ ] Let the planner project task blocks into free gaps
- [ ] Keep Task Atlas as source of truth for task completion
- [ ] Only consider write-back/sync to Outlook after read-only planning works well

### Phase 6: Activity And Review

- [ ] Track when work actually started
- [ ] Track last touched / updated timestamps
- [ ] Add lightweight activity history for important changes
- [ ] Add a "completed today / this week" review flow
- [ ] Distinguish planned work from actual work done

### Phase 7: UX And Reliability

- [ ] Continue improving keyboard-first editing
- [ ] Add stronger empty-state guidance
- [ ] Add clearer save and sync failure messaging
- [ ] Add protection against accidental full empty overwrites
- [ ] Add one-click backup/export before destructive bulk actions
- [ ] Add restore safety so stale browser state cannot overwrite imported data
- [ ] Add tests around empty DB state, imports, completion tracking, and team persistence

## Hard Questions To Keep Honest

- [ ] Are `Area` values disciplined enough, or are they becoming a mix of teams, themes, and responsibilities?
- [ ] Is `Mode = Run / Change` enough, or is some work still too ambiguous?
- [ ] Is `Owner = Me / Delegate` sufficient, or do we need richer ownership later?
- [ ] Is `Goal` optional enough to avoid metadata burden?
- [ ] Does the `Focus` view genuinely reduce clutter, or just hide backlog problems?
- [ ] Are calendar features supporting planning, or just adding integration complexity?

## Near-Term Sequence

- [ ] Rework the data model around `Area`, `Mode`, `Owner`, `Effort`, and `Goal`
- [ ] Build the first real `Focus` view
- [ ] Add `Delegatable`, `Strategic`, and `Needs clarity` derived views
- [ ] Add a weekly planning layer on top of the board
- [ ] Add goals after the new core model is stable
- [ ] Add read-only Outlook calendar subscription after weekly planning is working
