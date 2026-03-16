# Planner Improvement TODO

## Prioritization Model

- [ ] Decide on the core planning model: `Urgent + Impact + Time` vs `Urgent + Important + Time`
- [ ] Replace the current smart ranking with a weekly-planning ranking, not just a next-task ranking
- [ ] Add derived buckets such as `Must`, `Strategic`, `Quick win`, and `Clarify`
- [ ] Make the smart mode explainable: show why a task is ranked high
- [ ] Tune the smart sort so short tasks are a tie-breaker, not the dominant signal

## Weekly Planning

- [ ] Add a dedicated weekly planning mode instead of overloading the normal table sort
- [ ] Surface a small "this week" shortlist or focus area
- [ ] Let the user identify 1-3 strategic tasks for the week
- [ ] Add a way to separate reactive work from strategic work
- [ ] Add a "needs clarification" bucket so vague tasks stop polluting execution planning
- [ ] Translate the weekly todo list into actual calendar blocks
- [ ] Add calendar integration so weekly plans can be mapped to time
- [ ] Add a "planned this week" vs "scheduled in calendar" distinction

## Goal Breakdown

- [ ] Add lightweight goal-to-task breakdown so weekly work ties back to larger outcomes
- [ ] Support parent goals with child tasks or milestones
- [ ] Show whether a task is strategic because it supports a current goal
- [ ] Add a weekly planning view that starts from goals and breaks down into executable tasks
- [ ] Make it easy to convert a goal into several concrete next actions

## Task Metadata

- [ ] Revisit whether `Important` should become `Impact`
- [ ] Keep `Urgent` only if it remains genuinely useful for execution pressure
- [ ] Decide whether `Time` should stay effort-based (`<5m`, `15m`, `30m`, `1h`, `2h+`)
- [ ] Add optional derived labels rather than adding too many manual fields
- [ ] Avoid reintroducing a manual `Prio` field
- [ ] Add an impact/effort matrix view or derived classification
- [ ] Decide whether `Impact` should replace `Important`

## Activity Tracking

- [ ] Track when work actually started, not only when the task was created
- [ ] Track last touched / last updated dates for better review
- [ ] Add simple activity history for status changes and major edits
- [ ] Add a weekly review view showing what moved, what stalled, and what was completed
- [ ] Distinguish between planned work and actual work done

## UX And Navigation

- [ ] Continue improving keyboard-first editing so the board feels spreadsheet-like
- [ ] Add predictable "move to next cell" behavior after committing an edit
- [ ] Add a visible empty-state row when there are no tasks
- [ ] Add clearer save/error feedback when API writes fail
- [ ] Improve mobile behavior for editing dropdown-heavy rows

## Structure And Views

- [ ] Consider a compact planning sidebar or right-side summary panel
- [ ] Add a quick-win view
- [ ] Add a strategic view
- [ ] Add a "no info" / underspecified view
- [ ] Consider a separate weekly review screen instead of putting every workflow into one table
- [ ] Add an impact/effort matrix view for portfolio-style prioritization
- [ ] Add a calendar-linked weekly planning view

## Reliability

- [ ] Add protection against accidental full empty overwrites
- [ ] Add a one-click backup/export before destructive bulk updates
- [ ] Add a restore flow from uploaded CSV without stale browser state overwriting it
- [ ] Add lightweight audit/history for major state changes
- [ ] Add tests around empty DB state, import, and team-order persistence

## API And Data Model

- [ ] Decide whether `/api/state` should carry more derived planner metadata
- [ ] Keep team order persistent and documented in the API contract
- [ ] Document the current keyboard workflow in the README
- [ ] Decide whether agent-facing docs should describe ranking semantics too
- [ ] Add a stable export format for planner state and future migrations

## Near-Term Recommended Sequence

- [ ] Rework smart sort into a weekly-planning priority model
- [ ] Add derived labels: `Strategic`, `Quick win`, `Clarify`
- [ ] Add empty-state + better save/error messaging
- [ ] Improve post-edit keyboard flow
- [ ] Add backup/restore safety before bigger planner changes
