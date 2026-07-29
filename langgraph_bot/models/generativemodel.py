import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_groq import ChatGroq

from langgraph_bot.utils.ratelimit import groq_limiter

# Pinned to the real file rather than bare `load_dotenv()`: python-dotenv searches
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# --- Groq keys -------------------------------------------------------------------
# Free Groq accounts are per-key rate limited, so more keys is more throughput. Set as
# many of these as you have; unset ones are simply ignored, and with a single key
# everything below shares one bucket exactly as it did before.
GROQ_KEYS = [
    key
    for key in (
        os.getenv("GROQ_API_KEY"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_3"),
        os.getenv("GROQ_API_KEY_4"),
    )
    if key
]


def _groq(model: str, key_index: int, **kwargs) -> ChatGroq:
    """A ChatGroq bound to key `key_index` (mod however many keys exist).

    The `% len` is the whole rotation scheme: with 1 key every role lands on key 0,
    with 4 keys the four roles land on four different keys, and 2 or 3 keys degrade
    sensibly in between. `groq_limiter(key)` is memoised per key, so instances that
    end up on the same key automatically share one per-minute budget.
    """
    key = GROQ_KEYS[key_index % len(GROQ_KEYS)] if GROQ_KEYS else None
    return ChatGroq(
        model=model,
        api_key=key,
        rate_limiter=groq_limiter(key or ""),
        **kwargs,
    )


# --- Models ----------------------------------------------------------------------
# Still needs work and experimentation , need to check for better models
# Will also experiment with agentrouter for later
triagemodel = _groq("openai/gpt-oss-120b", 0, temperature=0, max_retries=2)

# Workhorse for the title/slug tools and the title_block node.
groqmodel = _groq("llama-3.3-70b-versatile", 1, temperature=0.7, max_retries=2)

summarymodel = _groq("llama-3.3-70b-versatile", 2, temperature=0.7, max_retries=2)
descriptionmodel = _groq("llama-3.3-70b-versatile", 3, temperature=0.7, max_retries=2)

# Reasoning model for the (currently unwired) coding agent.
codemodel = _groq(
    "qwen/qwen3.6-27b", 0, temperature=0.7, reasoning_format="parsed", max_retries=3
)
