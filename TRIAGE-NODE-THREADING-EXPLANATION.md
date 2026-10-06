# Triage Node and Threading Explanation

This document explains the changes currently made to
`langgraph_bot/nodes/triage_node.py`. It starts with the basic Python concepts,
then explains the threading code line by line, and finally evaluates whether the
extra circuit-breaker logic is appropriate for this application.

No application code is changed by this document.

## 1. What the triage node does

The triage node is a gate at the beginning of the content-generation graph. Its
job is to decide whether a raw article is relevant enough to justify the more
expensive generation work.

At a high level, one item follows this path:

```text
raw article
    |
    v
triage node
    |
    +-- not relevant -------------------------------> stop
    |
    v
deduplication node
    |
    +-- duplicate ----------------------------------> stop
    |
    v
summary branch + description branch (parallel)
    |
    v
enrichment
    |
    v
database insertion
```

The triage call is useful because rejecting an unsuitable article early avoids
several later model calls, an embedding request, image generation, and a database
insert.

The node returns two important pieces of state:

```python
{
    "triage": {
        "is_it_relevant": True,
        "importance": 3,
        "reason": "The article describes a new developer tool.",
    },
    "should_process": True,
}
```

- `triage` records the model's decision and explanation.
- `should_process` controls whether the graph continues to expensive generation.

## 2. The original failure behavior

Before the current review fix, the model invocation was wrapped in a `try` and
`except` block:

```python
try:
    result = structured.invoke(...)
except Exception as error:
    logger.error("triage_node: call failed, passing item through: %s", error)
    return {
        "triage": {
            "is_it_relevant": True,
            "importance": MIN_IMPORTANCE,
            "reason": "triage unavailable, passed through",
        },
        "should_process": True,
    }
```

This is called **fail-open** behavior.

If triage cannot make a decision, the item is treated as relevant and allowed to
continue. The advantage is availability: a temporary triage-provider problem does
not stop content generation. The disadvantage is cost and quality: if triage is
down for a long time, every article reaches expensive generation, including
irrelevant articles that triage was meant to reject.

The original implementation made this decision independently for each item. A
failure for item A did not change how item B was handled.

## 3. What the review change added

The current change adds an in-memory circuit breaker:

```python
from threading import Lock

TRIAGE_FAILURE_THRESHOLD = 3

_failure_lock = Lock()
_consecutive_failures = 0
_circuit_open = False
```

It also adds three helper functions:

```python
def _is_circuit_open() -> bool:
    with _failure_lock:
        return _circuit_open


def _record_failure() -> tuple[int, bool]:
    global _circuit_open, _consecutive_failures
    with _failure_lock:
        _consecutive_failures += 1
        if _consecutive_failures >= TRIAGE_FAILURE_THRESHOLD:
            _circuit_open = True
        return _consecutive_failures, _circuit_open


def _record_success() -> None:
    global _circuit_open, _consecutive_failures
    with _failure_lock:
        _consecutive_failures = 0
        _circuit_open = False
```

The intended policy is:

1. The first triage failure passes its item through.
2. The second consecutive failure also passes its item through.
3. The third consecutive failure opens the circuit and raises an exception.
4. Once open, later items are rejected with an exception before calling triage.
5. Any successful triage call before the threshold resets the failure count to zero.

This changes the behavior from always fail-open to a mixture:

- failures below the threshold are fail-open;
- the threshold failure and all later calls are fail-closed by raising;
- the circuit stays open until the Python process restarts, because no request is
  allowed through to prove that the provider has recovered.

## 4. Python module-level state

These variables are declared outside every function:

```python
_failure_lock = Lock()
_consecutive_failures = 0
_circuit_open = False
```

They are therefore **module-level variables**. They are created when Python first
imports `triage_node.py` into a process.

Within one Python process, imports are cached in `sys.modules`. Importing the same
module again normally returns the existing module object instead of creating a new
copy. Consequently, every call to `triage_node()` in that process normally shares
the same counter, Boolean flag, and lock.

The leading underscore is a naming convention:

```python
_consecutive_failures
```

It means "internal implementation detail." It does not make the variable private
or prevent other modules from accessing it.

This state is only in memory:

- it is lost when the process exits;
- it is reset when a new worker process starts;
- it is not stored in Supabase;
- it is not automatically shared with another Python process;
- it is not shared between separate machines or serverless invocations.

## 5. Threads from scratch

### 5.1 Process versus thread

A **process** is a running instance of a program with its own memory space. If two
Python worker processes import `triage_node.py`, each process gets its own copy of
the module-level variables.

A **thread** is an execution path inside a process. Multiple threads in the same
process share the process's memory. That means two threads can read and write the
same `_consecutive_failures` variable.

```text
Process A
  shared module memory
    _consecutive_failures
    _circuit_open
    _failure_lock

  Thread 1 -------- reads/writes shared module memory
  Thread 2 -------- reads/writes shared module memory

Process B
  separate module memory
    separate _consecutive_failures
    separate _circuit_open
    separate _failure_lock
```

A `threading.Lock` coordinates threads only inside the process containing that
lock. It cannot coordinate Process A with Process B.

### 5.2 Shared mutable state

`_consecutive_failures` and `_circuit_open` are shared mutable state:

- **shared** because all threads in the process can access them;
- **mutable** because their values change while the program runs.

Shared mutable state can cause bugs when multiple execution paths access it at the
same time.

### 5.3 Race conditions

A **race condition** occurs when the result depends on the timing or ordering of
concurrent operations.

Consider two threads incrementing a counter that currently contains `0`:

```python
_consecutive_failures += 1
```

Conceptually, an increment contains multiple steps:

1. Read the old value.
2. Add one.
3. Write the new value.

Without coordination, this can happen:

```text
Thread A reads 0
Thread B reads 0
Thread A calculates 1
Thread B calculates 1
Thread A writes 1
Thread B writes 1
```

Two failures occurred, but the final counter is `1`. This is called a **lost
update**.

Another race can occur between checking the counter, changing the circuit flag,
and returning both values. A caller could otherwise observe a counter and flag
that do not represent one consistent moment.

### 5.4 The Global Interpreter Lock is not enough

CPython has a Global Interpreter Lock, commonly called the GIL. The GIL prevents
multiple threads from executing Python bytecode at exactly the same instant in one
interpreter.

The GIL does not make a multi-step business operation atomic. Python can switch
threads between bytecode instructions, and C extensions or network operations may
release the GIL. Code should not depend on undocumented bytecode timing for
correctness.

The rule is straightforward: when correctness depends on reading and updating
shared state as one operation, use an explicit synchronization mechanism or avoid
the shared state.

### 5.5 Lock and mutual exclusion

`Lock()` creates a mutual-exclusion lock, also called a mutex:

```python
_failure_lock = Lock()
```

At most one thread can hold a particular lock at a time.

When Thread A holds the lock and Thread B tries to acquire it, Thread B waits until
Thread A releases it. This creates a **critical section**: a block of code that only
one thread may execute at a time.

```python
with _failure_lock:
    _consecutive_failures += 1
```

The `with` statement uses the lock as a context manager. It is approximately
equivalent to:

```python
_failure_lock.acquire()
try:
    _consecutive_failures += 1
finally:
    _failure_lock.release()
```

The `finally` behavior matters. The lock is released even if the code inside the
critical section raises an exception. This is safer than manually calling
`acquire()` and `release()` because a forgotten release can leave other threads
blocked forever.

### 5.6 What atomic means here

An operation is **atomic** from the perspective of other threads if they cannot
observe it half-completed.

The lock makes this complete state transition act as one protected operation:

```python
_consecutive_failures += 1
if _consecutive_failures >= TRIAGE_FAILURE_THRESHOLD:
    _circuit_open = True
return _consecutive_failures, _circuit_open
```

No other cooperating thread using `_failure_lock` can enter one of the other
protected sections until all of those lines finish.

The word "cooperating" is important. A lock does not automatically protect a
variable. Every code path that accesses the shared invariant must consistently use
the same lock.

### 5.7 Why the model call is outside the lock

The network request is intentionally not inside this block:

```python
with _failure_lock:
    result = structured.invoke(...)
```

Holding a lock during a slow network call would serialize every triage request in
that process. One thread could hold the lock for seconds while all other threads
waited, even though the model calls themselves do not need exclusive access to the
counter.

The current code locks only the quick reads and writes to shared state. That is the
right locking scope if a shared circuit breaker is actually required.

## 6. The threading-related lines explained one by one

### `from threading import Lock`

```python
from threading import Lock
```

This imports Python's standard mutual-exclusion lock class. It does not create a
thread and does not make the graph concurrent. It only provides a tool for
coordinating threads that might already call this module concurrently.

### `TRIAGE_FAILURE_THRESHOLD = 3`

```python
TRIAGE_FAILURE_THRESHOLD = 3
```

This constant defines how many failures in a row are allowed before the circuit is
opened. Uppercase names conventionally represent configuration constants.

"Consecutive" means uninterrupted by success:

```text
failure, failure, success, failure
```

The final failure count is `1`, not `3`, because success reset the counter.

### `_failure_lock = Lock()`

```python
_failure_lock = Lock()
```

This creates one lock for the module. Every helper uses this same object. Creating
a new lock inside each helper call would not work because the callers would be
holding different locks and would not exclude one another.

### `_consecutive_failures = 0`

```python
_consecutive_failures = 0
```

This is the process-wide failure count. It is not attached to a raw item, graph
invocation, thread, provider request, or database record.

That scope is an important design choice: a failure while processing one article
changes the behavior of later articles handled by the same process.

### `_circuit_open = False`

```python
_circuit_open = False
```

This Boolean stores whether calls are currently forbidden:

- `False`: triage calls are allowed.
- `True`: `triage_node()` raises before contacting the provider.

### `_is_circuit_open()`

```python
def _is_circuit_open() -> bool:
    with _failure_lock:
        return _circuit_open
```

This function reads the shared flag while holding the lock. The lock ensures that
the read does not occur in the middle of another protected update.

There is still a check-then-act interval after the function returns:

```python
if _is_circuit_open():
    raise RuntimeError(...)

result = structured.invoke(...)
```

Another thread can open the circuit after the check but before this thread invokes
the model. Therefore this is not a strict guarantee that no new provider calls
start after opening. It is an advisory gate suitable for reducing future calls,
not a fully serialized circuit state machine.

Avoiding that interval would require reserving permission under the lock or using
a more complete circuit-breaker abstraction. That additional complexity is not
justified for the worker's current execution model.

### `global _circuit_open, _consecutive_failures`

```python
global _circuit_open, _consecutive_failures
```

Python decides whether a name inside a function is local by looking for assignment
to that name. Because `_record_failure()` and `_record_success()` assign new values,
Python would otherwise treat these names as local variables.

For example, without `global`:

```python
count = 0

def increment():
    count += 1
```

Python treats `count` inside `increment()` as local and raises
`UnboundLocalError`, because it tries to read that local variable before assigning
it.

`global count` tells Python that assignments should target the name in the module's
global namespace.

The statement is about Python name binding. It does not provide thread safety. The
lock provides thread safety.

### `_record_failure()`

```python
def _record_failure() -> tuple[int, bool]:
```

The return annotation says the function returns a two-element tuple containing an
integer and a Boolean, for example `(2, False)` or `(3, True)`.

```python
with _failure_lock:
```

Only one thread at a time may execute the protected failure-state update.

```python
_consecutive_failures += 1
```

Record the newly observed failure.

```python
if _consecutive_failures >= TRIAGE_FAILURE_THRESHOLD:
    _circuit_open = True
```

Open the circuit when the count reaches or exceeds the threshold. `>=` is used
instead of `==` so the invariant remains correct even if the count somehow grows
beyond three.

```python
return _consecutive_failures, _circuit_open
```

Return both values while still inside the critical section. This gives the caller
a consistent snapshot from the same update.

### `_record_success()`

```python
def _record_success() -> None:
```

The `-> None` annotation says the function performs a side effect and does not
return a meaningful value.

```python
with _failure_lock:
    _consecutive_failures = 0
    _circuit_open = False
```

A successful request ends a sequence of consecutive failures. Both pieces of
state are reset together under the same lock.

In the current implementation, this function cannot actually recover an already
open circuit. Once `_circuit_open` is true, the check at the beginning of
`triage_node()` raises before another model call can succeed. `_record_success()`
can only reset failures while the circuit is still closed.

This means the current circuit has only two practical recovery mechanisms:

1. restart the Python process; or
2. mutate/reset the module state from some other code.

A conventional circuit breaker normally has a **half-open** state after a timeout.
It permits a test request and closes the circuit if that request succeeds. The
current implementation has no timeout and no half-open state.

### The early open-circuit check

```python
if _is_circuit_open():
    logger.critical("triage_node: failure circuit is open; refusing generation")
    raise RuntimeError("triage unavailable after repeated failures")
```

This runs before the model invocation.

If the flag is open:

1. no triage provider call is made;
2. the node raises an exception;
3. LangGraph treats the node attempt as failed;
4. the node's retry policy may invoke it again;
5. every retry sees the same open flag and raises again;
6. after retries are exhausted, the graph invocation raises to `main.py`;
7. `main.py` marks the raw item as failed and continues its `for` loop.

The exception disrupts the current graph invocation, not necessarily the entire
worker run. `main.py` catches ordinary exceptions around each item. However, every
later item in the same process will encounter the same open circuit and fail too.

### The exception handler

```python
except Exception as error:
```

This catches exceptions raised by `structured.invoke()`, including provider,
network, parsing, and schema-validation failures represented as normal Python
exceptions.

```python
failure_count, circuit_open = _record_failure()
```

This is tuple unpacking. If `_record_failure()` returns `(2, False)`, Python assigns
`2` to `failure_count` and `False` to `circuit_open`.

```python
if circuit_open:
```

The threshold-reaching failure follows a different path from earlier failures.

```python
raise RuntimeError("triage failed repeatedly; generation halted") from error
```

This raises a new, domain-specific exception while preserving the original error
as its cause. Exception chaining with `from error` makes logs show both:

- what the provider or parser originally did wrong; and
- why this application decided to stop the graph.

For failures below the threshold, the handler returns a synthetic relevant result:

```python
return {
    "triage": {
        "is_it_relevant": True,
        "importance": MIN_IMPORTANCE,
        "reason": "triage unavailable, passed through",
    },
    "should_process": True,
}
```

Returning means the node completed successfully from LangGraph's perspective.
Because no exception escapes, LangGraph does not apply its node retry policy to
that failure.

### `_record_success()` after the `try` block

```python
_record_success()
```

This line runs only when `structured.invoke()` returned successfully. It is outside
the `try` block because only the provider invocation is intended to be caught by
the failure handler. It resets earlier transient failures before the successful
result is evaluated.

## 7. LangGraph concurrency is not the same as this lock

The graph contains parallel work, but its placement matters.

The current top-level order is:

```text
START -> triage -> dedup -> conditional gate
                              |
                              +-> summary branch -----+
                              |                        |
                              +-> description branch -+-> enrich -> END
```

Triage executes before the graph fans out into the summary and description
branches. The two generation branches may execute concurrently, but neither calls
`triage_node()`.

In `main.py`, claimed items are processed with a normal `for` loop:

```python
for post in claimed:
    result = mjorgraph.invoke(build_initial_state(post))
```

`mjorgraph.invoke()` is synchronous. The loop waits for the entire graph for one
item to complete before invoking the graph for the next item.

Therefore, in the worker's normal current path:

- item A's triage finishes before item B's triage begins;
- the summary and description branches can overlap for item A;
- that branch concurrency happens after triage;
- the triage counter is not normally being updated simultaneously by two items.

The lock would become relevant if the application later did one of these things:

- called `mjorgraph.invoke()` from multiple Python threads;
- used a threaded batch API that processes several graph invocations concurrently;
- served the graph from a threaded web server where requests share one process;
- called `triage_node()` directly from multiple threads.

The mere presence of parallel LangGraph branches does not by itself require a lock
around triage's global variables.

## 8. Multiple workers and database concurrency

The queue may still be processed by multiple workers, cron executions, containers,
or machines. That is process-level or distributed concurrency, not necessarily
thread concurrency.

The queue-claiming database function uses row locking and `SKIP LOCKED` so two
workers do not claim the same raw item. That is the correct layer for protecting
queue ownership across processes.

The Python `Lock` in `triage_node.py` does not help with this scenario:

```text
Worker process A: circuit count = 2
Worker process B: circuit count = 0
```

Each process has separate memory and a separate lock. If a provider is failing for
both workers, each worker independently reaches its own threshold.

A truly shared circuit breaker across workers would require shared state such as a
database row, Redis, or provider-aware infrastructure. That would be a much larger
design and is probably unnecessary here.

## 9. Interaction with LangGraph retries

The graph registers triage with:

```python
_RETRY = RetryPolicy(max_attempts=3)
completegraph.add_node("triage", triage_node, retry_policy=_RETRY)
```

Retries happen only when the node raises an exception that LangGraph considers
retryable. A returned dictionary is a successful node result, even if it describes
an internal provider failure.

This produces an important distinction:

### Failure below the circuit threshold

```text
provider fails
-> triage catches the exception
-> triage returns should_process=True
-> LangGraph sees success
-> no graph-level retry
-> expensive generation continues
```

### Failure that opens the circuit

```text
provider fails
-> triage catches the exception
-> counter reaches threshold
-> triage raises RuntimeError
-> LangGraph retries the node
-> retry sees open circuit and raises before provider call
-> retries are exhausted
-> current graph invocation fails
```

The provider model itself is also configured with `max_retries=2`. Depending on
the library's retry semantics, one call to `structured.invoke()` may already make
multiple provider attempts before it finally raises to `triage_node()`.

Therefore there are potentially three different levels:

1. provider-client retries inside the model wrapper;
2. the circuit's process-wide failure count;
3. LangGraph node retries after an exception escapes the node.

Layering retry mechanisms can make behavior harder to predict. For example, a
single visible `_record_failure()` may represent several network attempts already
performed by the model client.

## 10. Concrete timelines

### Timeline A: isolated temporary failure

```text
Item 1: triage fails
        count becomes 1
        item is passed through

Item 2: triage succeeds
        count resets to 0
        normal relevance decision is used
```

No circuit opens.

### Timeline B: three different items fail

```text
Item 1: failure -> count 1 -> passed through
Item 2: failure -> count 2 -> passed through
Item 3: failure -> count 3 -> circuit opens -> graph raises
Item 4: circuit already open -> graph raises without a provider call
Item 5: circuit already open -> graph raises without a provider call
```

The worker's item-level `try/except` means it can continue iterating, but all later
items fail until the process ends or the state is reset.

### Timeline C: one item plus retries

The exact count depends on where an exception is caught.

For the first two recorded failures, `triage_node()` returns a dictionary, so the
LangGraph retry policy is not triggered. If the third recorded failure raises,
LangGraph retries, but the retries immediately fail at the open-circuit check and
do not increase the counter further.

### Timeline D: hypothetical concurrent calls

Suppose three threads call triage at nearly the same time while the circuit is
closed. All three can pass `_is_circuit_open()` before any model result is known.
If all three provider calls fail, `_record_failure()` serializes their counter
updates:

```text
Thread A records count 1 and passes its item through
Thread B records count 2 and passes its item through
Thread C records count 3, opens the circuit, and raises
```

The lock prevents lost counter updates. It does not cancel the calls that were
already in flight.

## 11. Is the current solution overkill?

For the present architecture, probably yes.

The lock itself is small and technically valid, but it exists to protect global
state that the current synchronous worker normally accesses from only one triage
call at a time. More importantly, the global circuit introduces behavior that is
broader than the original problem:

- a failure for one item affects unrelated later items;
- the circuit cannot recover automatically;
- the lock does not coordinate separate worker processes;
- LangGraph and the provider client already have retry mechanisms;
- the circuit mixes fail-open and fail-closed policies;
- later items fail even if the provider has recovered;
- more state and branches make testing and reasoning harder.

The main concern in the review was reasonable: silently passing every item through
during a prolonged outage can waste money and produce poor content. A process-wide
permanent circuit is not the only way to solve that problem.

## 12. Simpler behavior choices

There are three clear policies. The best one depends on product priorities.

### Option A: fail open per item

```python
except Exception as error:
    logger.warning("triage failed; passing item through: %s", error)
    return {
        "triage": {
            "is_it_relevant": True,
            "importance": MIN_IMPORTANCE,
            "reason": f"triage unavailable: {type(error).__name__}",
        },
        "should_process": True,
    }
```

Advantages:

- content generation remains available;
- no shared state;
- one item's failure cannot poison later items;
- simple to understand.

Disadvantages:

- irrelevant content can pass through;
- expensive calls continue during a provider outage;
- returning means the graph-level retry does not run.

### Option B: fail closed by skipping only the affected item

```python
except Exception as error:
    logger.warning("triage failed; skipping item: %s", error)
    return {
        "triage": {
            "is_it_relevant": False,
            "importance": 0,
            "reason": f"triage unavailable: {type(error).__name__}",
        },
        "should_process": False,
    }
```

Advantages:

- no expensive generation without a valid triage decision;
- one item's failure does not affect later items;
- no lock, counter, or circuit state;
- the worker continues normally;
- behavior matches the principle "if the gate cannot validate the item, do not
  publish it."

Disadvantages:

- a relevant item can be marked skipped because of a temporary provider failure;
- returning means the graph-level retry does not run;
- retrying the item later requires queue/status policy outside this node.

This is the simplest choice if avoiding unvalidated generation matters more than
processing every item immediately.

### Option C: raise and let retries handle the affected item

```python
except Exception:
    logger.exception("triage failed")
    raise
```

Advantages:

- LangGraph can apply its retry policy;
- provider failures are represented as failures, not relevance decisions;
- no shared global circuit state;
- only the current item is affected.

Disadvantages:

- after retries are exhausted, the current graph invocation fails;
- `main.py` marks the item failed rather than skipped;
- later retry behavior depends on the queue's status and retry policy;
- layered provider and graph retries can increase latency and request volume.

This is semantically clean when infrastructure failure should be distinguishable
from "article is irrelevant."

## 13. Recommended design for the current worker

The simplest design consistent with protecting content quality is Option B:
fail closed for only the affected item by returning `should_process=False`.

That policy says:

```text
We could not validate this item, so do not spend money generating or publish it.
Continue processing unrelated items because they may triage successfully.
```

It removes:

```python
from threading import Lock
TRIAGE_FAILURE_THRESHOLD
_failure_lock
_consecutive_failures
_circuit_open
_is_circuit_open()
_record_failure()
_record_success()
```

It also avoids pretending that a provider error means the article is genuinely
irrelevant. The reason field can explicitly say that triage was unavailable, and
`main.py` can store that reason when it marks the item skipped.

There is one product decision to make: should an infrastructure failure be
`skipped` permanently, or should it be `failed` so the queue may retry it later?

- Return `should_process=False` for a skip.
- Raise an exception for a failure/retry path.

That status decision is more important than adding a thread lock.

## 14. Summary of the concepts

- A process has its own memory; threads inside a process share that memory.
- Module-level variables are shared by calls and threads in one Python process.
- A race condition occurs when concurrent timing changes the result.
- `Lock` provides mutual exclusion for cooperating threads in one process.
- `with lock:` safely acquires and releases the lock around a critical section.
- `global` changes Python name binding; it does not provide synchronization.
- The GIL is not a substitute for protecting multi-step shared-state invariants.
- The current LangGraph runs triage before its parallel branches.
- `main.py` invokes one complete item graph at a time in a synchronous loop.
- The lock does not coordinate multiple processes, containers, or machines.
- Returning from an exception handler prevents LangGraph's node retry from running.
- Raising lets retries run but fails the current item if retries are exhausted.
- The current open circuit has no timeout or half-open recovery path.
- A per-item fail-open, fail-closed, or raise policy is simpler and has fewer
  cross-item side effects than the current process-wide circuit breaker.

## 15. Final conclusion

The added lock is correct for protecting the counter and Boolean from concurrent
threads. The issue is not that the lock is written incorrectly. The issue is that
the current worker does not normally call triage concurrently, and the protected
global circuit creates process-wide behavior that is difficult to recover from.

For this application, it is easier to reason about each raw item independently:
make one triage decision, handle that item's failure according to an explicit
policy, and continue the worker loop without allowing one article's failure to
change all later articles.
