# The new SQL in `20260618121728_redesign_schema.sql`, line by line

This document explains the changes currently sitting in the working tree for
`supabase/migrations/20260618121728_redesign_schema.sql`. There are exactly two:

| Where | What | Lines |
| --- | --- | --- |
| Inside the existing `posts_v2` backfill | Two timestamp casts pinned to UTC | 88&ndash;97 |
| Appended at the end of the file | A new function, `public.pipeline_stats()` | 239&ndash;379 |

The second one is the complicated one, and it is the whole reason this document
exists. It is about 120 lines of SQL built out of five stacked sub-queries, and
if you have not met that shape before it looks far worse than it is.

No application code is changed by this document.

---

## Part 1 &mdash; Why this function exists at all

Start with the problem, because the SQL only makes sense as an answer to it.

The landing page makes a claim: **"we read N articles and kept M of them."**
To make that claim you have to count rows in `raw_api_data` &mdash; the table of
scraped articles.

But `raw_api_data` is a table the public must never read. It holds full scraped
article bodies, source URLs, and triage failure messages. So it has
**Row Level Security** turned on with **no read policy at all**.

Here is the part that surprises people, and it is the single most important fact
in this document:

> When RLS is on and no policy matches you, Postgres does not raise an error.
> It simply shows you zero rows. PostgREST then returns **HTTP 200**, with
> `data: []` and `error: null`.

That is *indistinguishable from an empty table*. Your code cannot tell "you are
not allowed to see this" apart from "there is nothing here".

```text
What the browser asked:   "how many rows in raw_api_data?"
What Postgres decided:    "you may see none of them"
What PostgREST replied:   200 OK, count = 0
What the old code logged: nothing. No error occurred.
What the page displayed:  "0 articles read"
```

The old `frontend/lib/pipeline-stats.ts` read `raw_api_data` directly and it
*worked* &mdash; but only because `frontend/.env` was handing it a key whose prefix is
`sb_secret_`. A secret key runs as the `service_role`, and **`service_role`
bypasses RLS entirely.** The counts were correct by accident, resting on a
misconfiguration that is itself a security bug.

So the moment that key is rotated to a proper publishable key &mdash; which is the
correct thing to do &mdash; every "articles read" number on the homepage silently
becomes 0, with nothing in any log to explain it.

**`pipeline_stats()` is the fix.** It is a small, sealed window into a table that
otherwise stays shut:

```text
  anon (public key)                                    raw_api_data
        |                                              (RLS on, no policy)
        |  cannot SELECT ------------------------------X  blocked
        |
        |  CAN execute ---> pipeline_stats() ---------->  allowed
                            (Security Definer,           (runs as the owner)
                             returns only totals)
                                  |
                                  v
                       {"articles_read": 6, "entries_kept": 2, ...}
```

The caller gets *aggregate numbers only*. No article body, no URL, no failure
message, not even a row count per source URL &mdash; nothing row-level can escape
through a function that only ever returns sums.

---

## Part 2 &mdash; The SQL ideas you need first

Six concepts. If you know all six, skip to Part 3.

### 2.1 A CTE (`With ... As (...)`) is a named temporary result

`With` lets you name a query and then use that name like a table. It is the SQL
equivalent of assigning to a variable to avoid writing one giant expression.

```sql
With big_customers As (
    Select * From customers Where spend > 1000
)
Select Count(*) From big_customers;
```

You can chain them, and each one may use the ones above it:

```sql
With a As ( ... ),
     b As ( Select * From a ... ),   -- b reads a
     c As ( Select * From b ... )    -- c reads b
Select * From c;
```

**That chain is the entire structure of `pipeline_stats()`.** Five links:

```text
cohort  ->  scored  ->  span  ->  edges  ->  buckets  ->  final JSON
  |           |           |         |           |
  drop        label       how       make        count rows
  junk        each row    wide is   the empty   into each
  rows        kept/judged the data? columns     column
```

Read it as five short, readable queries rather than one long one. Each step does
exactly one job.

### 2.2 `Count(*) Filter (Where ...)` counts a subset in the same pass

Normally counting two different things means two queries. `Filter` lets you
count several things at once over one scan:

```sql
Select
    Count(*)                               As everything,   -- 10
    Count(*) Filter (Where status = 'ok')   As just_ok,      --  7
    Count(*) Filter (Where status = 'bad')  As just_bad      --  3
From jobs;
```

One trip through the table, three numbers. This is why the whole function is a
single round trip instead of the fifteen the old code made.

A related wrinkle: `Count(*)` counts *rows*, but `Count(some_column)` counts
rows where that column **is not NULL**. The function relies on that difference
at line 333 &mdash; see Part 3.6.

### 2.3 `Date_Trunc` rounds a timestamp down to a unit

```sql
Date_Trunc('month', '2026-09-17 13:45:00')  ->  2026-09-01 00:00:00
Date_Trunc('week',  '2026-09-17 13:45:00')  ->  2026-09-14 00:00:00
```

Postgres weeks start on **Monday**. 17 September 2026 is a Thursday, so its week
truncates back to Monday 14 September.

This is how a timestamp gets assigned to a column in the chart: every row in the
same week truncates to the same Monday, so grouping by that value groups by week.

### 2.4 `Generate_Series` manufactures the rows that *don't* exist

This is the trick that keeps idle weeks on the chart.

```sql
Generate_Series('2026-08-31'::timestamp, '2026-09-14'::timestamp, '1 week')
```

```text
2026-08-31
2026-09-07
2026-09-14
```

If you only `Group By` the data, a week with no activity produces no row, and the
chart just doesn't draw that column &mdash; which makes a gap in operations look
like continuous operation on a squashed axis. By generating **every** week edge
first and then `Left Join`ing the data onto it, an idle week is guaranteed to
appear with zeroes.

### 2.5 `Is Not Distinct From` is `=` that handles NULL sanely

In SQL, `NULL = NULL` is not true. It is **NULL**, which behaves as "unknown" and
is not true enough to pass a `Where` clause. This bites constantly:

```sql
NULL = NULL                     ->  NULL     (not true!)
NULL Is Not Distinct From NULL   ->  true
'a'  Is Not Distinct From NULL   ->  false
'a'  Is Not Distinct From 'a'    ->  true
```

`Is Not Distinct From` is "equal, and two NULLs count as equal". It always
returns true or false, never NULL. Part 3.2 shows the row this saves.

### 2.6 `At Time Zone` and why timestamps are a trap

Postgres has two timestamp types and they behave differently:

- `timestamptz` &mdash; a real instant. Stored as UTC, converted on display.
- `timestamp` &mdash; just a wall-clock reading. No zone. "3pm", somewhere.

`some_timestamptz At Time Zone 'UTC'` means **"give me the wall-clock reading
this instant has in UTC"**, and produces a plain `timestamp`. That is what the
function wants: a fixed wall clock so that bucket edges do not shift depending on
the `TimeZone` setting of whoever happens to be connected.

```text
stored instant:            2026-09-17 23:30:00+00
read with TimeZone=UTC:    2026-09-17 23:30  -> week of Sep 14
read with TimeZone=+05:30: 2026-09-18 05:00  -> week of Sep 14   (same here)

stored instant:            2026-09-13 23:30:00+00
read with TimeZone=UTC:    2026-09-13 23:30  -> week of Sep  7
read with TimeZone=+05:30: 2026-09-14 05:00  -> week of Sep 14   <-- DIFFERENT
```

Without pinning, the same database answers the same question differently
depending on the connection. Line 275 pins it.

---

## Part 3 &mdash; `pipeline_stats()`, line by line

Our worked example for the whole of Part 3. Seven rows in `raw_api_data`:

| id | status | last_error | source_name | created_at (UTC) |
| --- | --- | --- | --- | --- |
| `a1` | `succeeded` | NULL | TechCrunch | 2026-09-02 10:00 |
| `a2` | `failed` | model timeout | TechCrunch | 2026-09-03 11:00 |
| `a3` | `skipped` | not relevant | VentureBeat | 2026-09-04 09:00 |
| `a4` | `skipped` | **pre-queue backlog** | OldFeed | 2026-05-01 08:00 |
| `a5` | `pending` | NULL | VentureBeat | 2026-09-16 12:00 |
| `a6` | `succeeded` | NULL | HackerNews | 2026-09-17 13:00 |
| `a7` | `processing` | NULL | HackerNews | 2026-09-18 14:00 |

And three rows in `posts`:

| id | raw_item_id |
| --- | --- |
| `p1` | `a1` |
| `p2` | `a6` |
| `p3` | **NULL** (backfilled before the pipeline existed) |

Assume "now" is **19 September 2026**.

### 3.1 The function header (lines 261&ndash;267)

```sql
Create Or Replace Function public.pipeline_stats()
Returns jsonb
Language sql
Stable
Security Definer
Set search_path = ''
As $$
```

Line by line:

- **`Create Or Replace Function public.pipeline_stats()`** &mdash; empty parentheses:
  it takes no arguments. Nothing the caller sends can influence it, which is one
  less thing to validate. `Or Replace` makes re-running the migration safe.

- **`Returns jsonb`** &mdash; one JSON value, not a table of rows. Deliberate. A
  function returning rows invites someone to add a column later; a function
  returning a fixed JSON object of totals has an obvious, auditable shape. `jsonb`
  rather than `json` because it is the binary, validated form.

- **`Language sql`** &mdash; plain SQL, not `plpgsql`. No loops, no variables, no
  branching. The planner sees the whole thing as one query and can optimise
  across it. The two older functions in this file use `plpgsql` because they
  genuinely need procedural logic; this one does not.

- **`Stable`** &mdash; a promise: *"given the same database contents, I return the
  same answer, and I never write anything."* This lets Postgres call it once per
  query instead of once per row. (`Immutable` would be wrong &mdash; it reads tables.
  `Volatile` would be a missed optimisation.)

- **`Security Definer`** &mdash; **this is the important line.** By default a function
  runs with the *caller's* permissions, which for `anon` means RLS blocks it and
  it counts zero rows. `Security Definer` makes it run with the permissions of
  the user who **created** the function &mdash; the table owner, who is not subject to
  that RLS. This is precisely how the public gets a correct count of a table it
  cannot read.

- **`Set search_path = ''`** &mdash; the hardening that makes the line above safe.
  `search_path` is the list of schemas Postgres searches when you write an
  unqualified name like `posts`. A definer function with a loose search path is a
  classic privilege-escalation hole: if an attacker can create `posts` in a
  schema that gets searched first, **their** table gets read with the owner's
  rights. Emptying it means no unqualified name resolves at all, which is why
  every single reference inside the body is written out longhand as
  `public.raw_api_data`, `public.posts`. If you ever add a name to this function
  and forget the schema, it fails loudly at runtime &mdash; which is the behaviour you
  want from a guard.

  > The two older functions in this file use `Set search_path = public` instead.
  > That is not an inconsistency: they are granted to `service_role` only, so
  > only an already-trusted caller can reach them. This one is granted to `anon`,
  > so anyone on the internet with the publishable key can run it. Different
  > exposure, stricter setting.

- **`As $$`** &mdash; dollar quoting. The body is a string, and `$$` lets it contain
  single quotes (`'week'`, `'succeeded'`) without doubling every one of them.

### 3.2 `cohort` &mdash; throw out the rows that aren't real work (lines 268&ndash;286)

```sql
With cohort As (
    Select
        item.id,
        item.status,
        item.source_name,
        item.created_at At Time Zone 'UTC' As read_at
    From public.raw_api_data As item
    Where Not (
        item.status Is Not Distinct From 'skipped'
        And item.last_error Is Not Distinct From 'pre-queue backlog'
    )
),
```

**What it does:** picks the four columns that matter and drops one specific
category of row.

- **`item.created_at At Time Zone 'UTC' As read_at`** &mdash; converts the stored
  instant into a UTC wall clock and renames it `read_at`. Renaming matters for
  readability: from here on, every step talks about *when an article was read*,
  not about a column called `created_at` that could be confused with `posts.created_at`.

- **The `Where Not (...)`** &mdash; when the redesign introduced the triage queue, it
  had to do something with the articles already sitting in the table. It stamped
  every one of them `status = 'skipped'`, `last_error = 'pre-queue backlog'`, so
  the new worker loop would leave them alone.

  Those rows are **not throughput**. The pipeline never actually read or judged
  them; they were marked to be ignored. Counting them would inflate "articles
  read" with work that never happened. So: drop any row that is *both* `skipped`
  *and* stamped with that exact marker.

- **Why `Is Not Distinct From` instead of `=`** &mdash; this is the subtle one. Suppose
  a live row has `last_error = NULL` (normal: nothing has failed). With plain `=`:

  ```text
  status = 'skipped'                     ->  false
  last_error = 'pre-queue backlog'       ->  NULL     (because last_error is NULL)
  false And NULL                          ->  false
  Not false                               ->  true     -- row kept. Fine here.
  ```

  but now suppose `status` is NULL:

  ```text
  status = 'skipped'                     ->  NULL
  last_error = 'pre-queue backlog'       ->  NULL
  NULL And NULL                           ->  NULL
  Not NULL                                ->  NULL     -- not true!
  ```

  A `Where` clause keeps only rows where the condition is **true**. NULL is not
  true, so **a row with a NULL status would be silently dropped from every
  figure on the homepage.** With `Is Not Distinct From`, each comparison is always
  true or false, never NULL, and the row survives as it should.

**On our data:** `a4` is `skipped` + `pre-queue backlog`, so it goes. `a3` is
`skipped` but its error is `not relevant` &mdash; a real triage decision &mdash; so it
stays.

```text
cohort = a1, a2, a3, a5, a6, a7      (6 rows; a4 dropped)
```

### 3.3 `scored` &mdash; label each row "judged?" and "kept?" (lines 287&ndash;301)

```sql
scored As (
    Select
        cohort.read_at,
        cohort.source_name,
        (cohort.status In ('succeeded', 'skipped', 'failed')) As is_resolved,
        Exists (
            Select 1
            From public.posts As post
            Where post.raw_item_id = cohort.id
        ) As is_kept
    From cohort
),
```

**What it does:** attaches two true/false flags to every surviving row. This is
the step that encodes the two bugs the chart used to have.

- **`is_resolved`** &mdash; true when the status is one of the three *finished* states.
  The statuses that are **not** in that list are `pending` and `processing`:
  articles that have been read but **not yet judged**. They are in flight.

  This is the fix for the flat 0% months. The old chart computed
  `kept / read` &mdash; which treats an article still sitting in the queue as a
  *rejection*. During a big ingest, hundreds of items are queued before the bot
  reaches them, so the rate collapsed toward zero and the page reported that the
  filter was rejecting everything, when in fact nothing had been decided at all.
  The denominator is now the **decided** population.

- **`is_kept`** &mdash; true when some row in `posts` points back at this raw item.

  `Exists (Select 1 ...)` is the idiomatic "is there at least one?" test. It
  stops at the first match rather than counting all of them, and &mdash; importantly &mdash;
  it cannot duplicate the row the way a `Join` can. If two posts somehow pointed
  at one raw item, a join would count that article twice; `Exists` is still just
  true.

  This is also the fix for the **two-clocks** bug. The old code counted keeps by
  `posts.published_at` &mdash; the date an entry went *live*. So an article read in
  September and published in October landed in two different columns, and the
  bright "kept" segment was **not a subset of the column containing it**, which is
  the only thing that makes a part-to-whole bar chart mean anything. Nothing in
  the arithmetic even prevented a keep rate above 100%. Now a keep is credited
  through the foreign key to the bucket of **the raw item's own read time**.

  Notice the side effect on `p3`, the backfilled post with `raw_item_id = NULL`:
  `NULL = cohort.id` is never true, so `p3` matches nothing and is counted
  nowhere. Correct &mdash; it is an entry with no article behind it. Under the old
  arithmetic it was a keep against a read that never happened.

**On our data:**

| row | read_at | source | is_resolved | is_kept | why |
| --- | --- | --- | --- | --- | --- |
| `a1` | Sep 2 | TechCrunch | **true** | **true** | succeeded, and `p1` points at it |
| `a2` | Sep 3 | TechCrunch | **true** | false | failed is a decision |
| `a3` | Sep 4 | VentureBeat | **true** | false | skipped is a decision |
| `a5` | Sep 16 | VentureBeat | false | false | pending &mdash; still queued |
| `a6` | Sep 17 | HackerNews | **true** | **true** | succeeded, and `p2` points at it |
| `a7` | Sep 18 | HackerNews | false | false | processing &mdash; mid-flight |

### 3.4 `span` &mdash; how much history is there, and how wide should a column be? (lines 302&ndash;315)

```sql
span As (
    Select
        Min(scored.read_at) As first_read,
        Max(scored.read_at) As last_read,
        Case
            When Max(scored.read_at) - Min(scored.read_at) < Interval '70 days'
                Then 'week'
            Else 'month'
        End As granularity
    From scored
),
```

**What it does:** collapses everything to a single row holding the earliest read,
the latest read, and one word: `week` or `month`.

- **No `Group By`** &mdash; an aggregate with no grouping returns exactly one row over
  the whole input. `span` is a one-row, three-column table.

- **The `Case`** &mdash; picks the column width from the amount of history.
  70 days is ten weeks. Under that, buckets are weeks; past it, calendar months.

  Why bother: a *monthly* axis over three weeks of operation draws **one column**
  and calls it a trend. A *weekly* axis over two years draws **104** columns and
  is unreadable. Neither is a chart. The width has to follow the data.

- **Why this is decided here and not in TypeScript** &mdash; the word is returned to
  the client as `granularity`, and the component uses it to choose its heading
  ("Read vs. kept, by week"), its column labels, and its table header. One
  decision, made once, travelling with the data it describes. If the threshold
  lived in both places they would eventually disagree, and the chart would label
  weekly columns as months.

**On our data:** first read Sep 2, last read Sep 18 &rarr; 16 days &rarr; under 70 &rarr;

```text
first_read = 2026-09-02 10:00
last_read  = 2026-09-18 14:00
granularity = 'week'
```

### 3.5 `edges` &mdash; manufacture every column, including the empty ones (lines 316&ndash;326)

```sql
edges As (
    Select
        span.granularity,
        Generate_Series(
            Date_Trunc(span.granularity, span.first_read),
            Date_Trunc(span.granularity, span.last_read),
            ('1 ' || span.granularity)::interval
        ) As bucket_start
    From span
    Where span.first_read Is Not Null
),
```

**What it does:** turns "Sep 2 to Sep 18, weekly" into the explicit list of
column start dates.

- **`Date_Trunc(span.granularity, ...)`** &mdash; note the unit is a *column value*,
  not a literal. The same line truncates to weeks or to months depending on what
  `span` decided. One expression, both modes.

- **`('1 ' || span.granularity)::interval`** &mdash; string concatenation building the
  step size. `'1 ' || 'week'` is the text `'1 week'`, and `::interval` casts it to
  a real interval. This is why `granularity` is spelled exactly `week` / `month`:
  the words are also valid interval units, so one value does double duty as the
  truncation unit and the step.

- **`Where span.first_read Is Not Null`** &mdash; the empty-table guard. If
  `raw_api_data` has no qualifying rows, `Min()` returns NULL, and
  `Generate_Series(NULL, NULL, ...)` would error. This produces zero rows
  instead, and the function returns `[]` for buckets rather than failing.

**On our data:** Sep 2 2026 is a Wednesday, so it truncates to Monday Aug 31.
Sep 18 is a Friday, truncating to Monday Sep 14.

```text
Generate_Series(2026-08-31, 2026-09-14, '1 week'):

  2026-08-31    <- Aug 31 - Sep 6
  2026-09-07    <- Sep 7 - Sep 13   (nothing happened this week)
  2026-09-14    <- Sep 14 - Sep 20
```

Three columns &mdash; **including the middle one, where nothing happened.** That is
the entire point of this step.

### 3.6 `buckets` &mdash; drop the data into the columns (lines 327&ndash;339)

```sql
buckets As (
    Select
        edges.bucket_start,
        edges.granularity,
        Count(scored.read_at) As n_read,
        Count(*) Filter (Where scored.is_kept) As n_kept,
        Count(*) Filter (Where scored.is_resolved) As n_resolved
    From edges
    Left Join scored
        On Date_Trunc(edges.granularity, scored.read_at) = edges.bucket_start
    Group By edges.bucket_start, edges.granularity
)
```

**What it does:** for each generated edge, counts the rows that fall in it.

- **`Left Join`, not `Join`** &mdash; this is what preserves the empty week. A plain
  (inner) join drops any edge with no matching rows. `Left Join` keeps every edge
  and fills the missing side with NULLs.

- **The join condition** &mdash; "truncate this row's read time and see if it equals
  this edge". Every row in the same week truncates to the same Monday, so this
  assigns each row to exactly one column.

- **`Count(scored.read_at)`, not `Count(*)`** &mdash; and this is the one line in the
  function where getting it wrong would be invisible. For the empty week, the
  `Left Join` produces **one row** whose `scored` columns are all NULL. `Count(*)`
  counts rows, so it would report **1 article read** in a week where nothing
  happened. `Count(column)` skips NULLs, so it correctly reports **0**.

  ```text
  the empty-week row after the Left Join:
    bucket_start = 2026-09-07,  read_at = NULL,  is_kept = NULL,  is_resolved = NULL

    Count(*)                -> 1   <-- wrong: counts the placeholder row
    Count(scored.read_at)   -> 0   <-- right: no actual data
  ```

  The two `Filter` counts are safe either way, because `Where NULL` is not true
  and so matches nothing.

- **`Group By edges.bucket_start, edges.granularity`** &mdash; one output row per
  column. `granularity` is in the `Group By` only because it is selected and SQL
  requires every non-aggregated column to be grouped; it is the same value on
  every row.

**On our data:**

| bucket_start | rows landing here | n_read | n_kept | n_resolved |
| --- | --- | --- | --- | --- |
| 2026-08-31 | a1, a2, a3 | 3 | 1 | 3 |
| 2026-09-07 | *(none)* | **0** | 0 | 0 |
| 2026-09-14 | a5, a6, a7 | 3 | 1 | **1** |

Look hard at that last row, because it is the bug this whole redesign was about.
Three articles were read. Only **one** has actually been judged. The old chart
divided 1 by 3 and drew **33%**. The honest reading is "of the one article we have
decided on, we kept it" &mdash; and since the week is still in progress, the honest
display is **no percentage at all**.

### 3.7 The final `Select` &mdash; assemble the JSON (lines 341&ndash;376)

```sql
Select jsonb_build_object(
    'articles_read', (Select Count(*) From scored),
    'entries_kept',  (Select Count(*) Filter (Where scored.is_kept) From scored),
    'resolved',      (Select Count(*) Filter (Where scored.is_resolved) From scored),
    'sources',       (Select Count(Distinct scored.source_name) From scored),
    'first_run', (
        Select To_Char(span.first_read, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') From span
    ),
    'last_run', (
        Select To_Char(span.last_read, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') From span
    ),
    'granularity', (Select span.granularity From span),
    'buckets', Coalesce(
        (
            Select jsonb_agg(
                jsonb_build_object(
                    'start', To_Char(buckets.bucket_start, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                    'read', buckets.n_read,
                    'kept', buckets.n_kept,
                    'resolved', buckets.n_resolved,
                    'partial', (
                        buckets.bucket_start + ('1 ' || buckets.granularity)::interval
                    ) > (Now() At Time Zone 'UTC')
                )
                Order By buckets.bucket_start
            )
            From buckets
        ),
        '[]'::jsonb
    )
);
```

- **`jsonb_build_object('key', value, 'key', value, ...)`** &mdash; alternating keys and
  values. Here `Count(*)` *is* right (unlike 3.6) because `scored` is real data,
  not a left-joined placeholder.

- **`Count(Distinct scored.source_name)`** &mdash; counts how many different publications
  appear, not how many rows. Our three sources appear across six rows &rarr; **3**.

- **`To_Char(..., 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`** &mdash; formatting the timestamps
  by hand rather than letting `jsonb` render them. Two reasons:

  1. `jsonb`'s own timestamp rendering follows the session's `DateStyle` setting,
     so the same database could emit `2026-09-02 10:00:00` or `09/02/2026`
     depending on who connected. The client has to parse these.
  2. The values are plain `timestamp` (we stripped the zone back in `cohort`), so
     nothing would mark them as UTC. The `"T"` and `"Z"` are quoted *literals*
     inside the format string, producing the ISO 8601 shape JavaScript's
     `new Date()` reads unambiguously as UTC. `.US` is microseconds.

- **`jsonb_agg(... Order By ...)`** &mdash; folds the bucket rows into a JSON array.
  The `Order By` **inside** the aggregate is what guarantees chronological order;
  without it, row order is whatever the planner felt like, and the chart's
  columns could come back shuffled. (The TypeScript sorts them again on arrival,
  defensively, but the contract is set here.)

- **`'partial'`** &mdash; "is this column's window still open?" Add one unit to the
  start to get the *end*, and compare to now:

  ```text
  bucket 2026-08-31 + 1 week = 2026-09-07  >  2026-09-19 ?  no   -> closed
  bucket 2026-09-07 + 1 week = 2026-09-14  >  2026-09-19 ?  no   -> closed
  bucket 2026-09-14 + 1 week = 2026-09-21  >  2026-09-19 ?  YES  -> partial
  ```

  `Now() At Time Zone 'UTC'` for the same reason as line 275 &mdash; comparing against
  a UTC wall clock, not the connection's local one. The frontend draws a partial
  column at 60% opacity, labels it "(in progress)", and leaves it out of the
  caption's endpoints, because a week that is two days old always looks like a
  collapse in throughput next to finished ones.

- **`Coalesce(..., '[]'::jsonb)`** &mdash; the empty-database guard. `jsonb_agg` over
  zero rows returns **NULL**, not an empty array. Without this, `buckets` would be
  `null` in the JSON and the client would need a separate check for it. The
  function always returns an array, possibly empty. **A fixed shape is one fewer
  branch in every consumer.**

**The complete output for our example:**

```json
{
  "articles_read": 6,
  "entries_kept": 2,
  "resolved": 4,
  "sources": 3,
  "first_run": "2026-09-02T10:00:00.000000Z",
  "last_run": "2026-09-18T14:00:00.000000Z",
  "granularity": "week",
  "buckets": [
    { "start": "2026-08-31T00:00:00Z", "read": 3, "kept": 1, "resolved": 3, "partial": false },
    { "start": "2026-09-07T00:00:00Z", "read": 0, "kept": 0, "resolved": 0, "partial": false },
    { "start": "2026-09-14T00:00:00Z", "read": 3, "kept": 1, "resolved": 1, "partial": true  }
  ]
}
```

And what the page draws from it:

```text
  week of Aug 31   3 read, 1 kept   -> "33% kept"   (1 of 3 decided)
  week of Sep  7   0 read           -> empty column, no label
  week of Sep 14   3 read, 1 kept   -> "(in progress)", no rate shown
```

### 3.8 The grants (lines 378&ndash;379)

```sql
Revoke All On Function public.pipeline_stats() From Public;
Grant Execute On Function public.pipeline_stats() To anon, authenticated, service_role;
```

**Revoke before grant, in that order, and it matters.**

Postgres grants `EXECUTE` on new functions to the pseudo-role `PUBLIC`
**automatically**. `PUBLIC` means *every* role, now and in future &mdash; including
roles nobody has created yet. So a freshly created function is already wide open,
and a `Grant` alone would be decoration on top of a permission that was never
removed.

Line 378 strips that default. Line 379 then hands `EXECUTE` to exactly three
named roles:

| role | who that is |
| --- | --- |
| `anon` | an unauthenticated visitor &mdash; the landing page |
| `authenticated` | a logged-in user |
| `service_role` | the backend pipeline |

The result is a function whose access list is written down rather than inherited.
And `EXECUTE` is *all* any of them get &mdash; none of these roles can
`SELECT` from `raw_api_data`. They can ask the question; they cannot read the
table the answer came from.

---

## Part 4 &mdash; The other change: two casts pinned to UTC (lines 88&ndash;97)

This one is two lines of actual SQL, but it is the same class of bug as everything
above, so it is worth understanding.

```sql
    p.upload_date At Time Zone 'UTC',
    Coalesce(p.approveddate, p.upload_date) At Time Zone 'UTC'
```

**The situation.** The old schema declared these columns as

```sql
"upload_date"   timestamp without time zone default now(),
"approveddate"  timestamp without time zone default now(),
```

&mdash; naked wall-clock readings with no zone. The new `posts_v2` table declares
`created_at` and `published_at` as **`timestamptz`**. So this insert converts a
zone-less value into a zoned one.

**The problem.** Postgres has to guess what zone the naked value was in, and the
guess it makes is *the `TimeZone` setting of whoever is running the migration*.

```text
stored value (no zone):  2026-04-23 00:00:00

applied with TimeZone = UTC         ->  2026-04-23T00:00:00Z  -> renders "April 23"
applied with TimeZone = Asia/Kolkata ->  2026-04-22T18:30:00Z  -> renders "April 22"
```

**The same migration, applied from a different laptop, files the article on a
different day.** And because this is a backfill that runs once, whichever answer
you get is baked in permanently.

**The fix.** `At Time Zone 'UTC'` states the interpretation instead of inheriting
it. UTC is the correct reading here for two independent reasons: the pipeline
wrote these values with `now()` on a naive column under Supabase's default UTC,
and the frontend has always formatted them with `timeZone: "UTC"` on the way out.
Now the conversion produces the same instant no matter where it runs.

> This is the same bug a CodeRabbit review on PR 118 raised against the
> *frontend* &mdash; a zone-less timestamp parsed in the server's local zone and then
> rendered as UTC. The schema change above moves those columns to `timestamptz`,
> which eliminates it at render time, because Postgres then sends an explicit
> offset. What was left was this one-time conversion, which is where the
> ambiguity actually survived.

---

## Part 5 &mdash; What was deleted on the TypeScript side

Context for why the SQL is worth its length. The old `pipeline-stats.ts` issued
**5 + 2&times;N** requests &mdash; four or five all-time counts, plus a read count and a
keep count for every month on the chart. Twelve months meant twenty-nine round
trips, every one of them a separate network call, and each one silently returning
zero if the key ever changed.

It is now **one** `rpc("pipeline_stats")` call, and the file that handles it is
178 lines instead of 223 &mdash; almost all of what remains being the four narrowing
helpers that validate the JSON on arrival, because `Returns jsonb` types as
`Json` in the generated types and the client should not trust its shape blindly.

| | before | after |
| --- | --- | --- |
| Round trips to build the chart | 5 + 2&times;N | **1** |
| Tables the browser's key must read | `raw_api_data`, `posts` | **none** |
| Behaviour under a correct publishable key | silently reports 0 | correct |
| Failure mode if the grant is wrong | none &mdash; looks like an empty table | a loud `42501` |

That last row is the real prize. The old design's failure mode was *a plausible
wrong answer*. The new one's is an error message.

---

## Part 6 &mdash; Trying it yourself

Local stack only &mdash; this migration has **not** been applied to production, so
production does not have this function yet.

```bash
# Docker must be running first.
supabase start

# The function, as the table owner:
psql -At -c "Select public.pipeline_stats()" \
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

The more interesting test is the one that proves the seam actually seals. With a
real **publishable** (not secret) key:

```bash
# Direct read of the protected table -> 200 OK, and zero rows. No error.
curl -s -I "http://127.0.0.1:54321/rest/v1/raw_api_data?select=id" \
  -H "apikey: <publishable key>" -H "Prefer: count=exact"
#   HTTP/1.1 200 OK
#   content-range: */0          <- allowed to ask, shown nothing

# The function -> the real numbers.
curl -s "http://127.0.0.1:54321/rest/v1/rpc/pipeline_stats" \
  -X POST -H "apikey: <publishable key>" -H "Content-Type: application/json" -d '{}'
#   {"sources":5,"resolved":27,"articles_read":27, ...}
```

Those two commands together are the whole design: the table stays shut, the
totals come out, and the thing that lets that happen is one `Security Definer`
function with an emptied `search_path` and a hand-written grant list.
