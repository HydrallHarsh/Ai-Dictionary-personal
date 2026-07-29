"""Shared rate limiters — one bucket per API key, for every provider.

Every key in this pipeline is on a free tier, and a single item makes ~6 provider calls
across two *concurrent* subgraph branches. So the gate has to sit at the call site, not
in main.py's loop: a loop-level `time.sleep()` never sees a burst that happens inside
one item.

There is no custom limiter class here on purpose. LangChain's `InMemoryRateLimiter` is
a `BaseRateLimiter`, which means the same object works both ways with no adapter:

    ChatGroq(..., rate_limiter=limiter)   # LangChain calls .acquire() before each call
    limiter.acquire()                     # manual, for the Gemini/Pollinations clients
                                          # that take no limiter argument

It is thread-safe, and `max_bucket_size=1` means no burst allowance — a burst allowance
is exactly what earns a 429. Calls come out evenly spaced at `rpm/60` per second.

This module's real job is *sharing*: limiting only works if every caller on a key goes
through the same object, so they are all created here and imported everywhere else.

(Its bucket starts empty, so the first call on each limiter waits one interval — about
20s total at process start. Irrelevant for a daily cron run; don't "fix" it by raising
max_bucket_size, which would let a burst through on every idle gap, not just the first.)
 - written by AI 
""" 

from langchain_core.rate_limiters import InMemoryRateLimiter

# Free-tier limits, can be changed accordingly
GROQ_RPM = 25
GEMINI_EMBED_RPM = 5
POLLINATIONS_RPM = 10


def _limiter(rpm: float) -> InMemoryRateLimiter:
    return InMemoryRateLimiter(
        requests_per_second=rpm / 60.0,
        check_every_n_seconds=0.5,
        max_bucket_size=1,
    )


gemini_embed_limiter = _limiter(GEMINI_EMBED_RPM)
pollinations_limiter = _limiter(POLLINATIONS_RPM)

# work: models sharing a key share a bucket (so they throttle each other, as they must),
# models on different keys don't (so each key gets its own budget). Nothing outside this
# function has to know how many keys exist.
_groq_limiters: dict[str, InMemoryRateLimiter] = {}


def groq_limiter(api_key: str) -> InMemoryRateLimiter:
    return _groq_limiters.setdefault(api_key, _limiter(GROQ_RPM))
