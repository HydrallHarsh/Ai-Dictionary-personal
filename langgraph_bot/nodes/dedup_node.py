"""Semantic dedup — don't write a second post about the same release.

Runs after triage (so we only embed items that survived the cheap filter) and before
generation (so a duplicate costs one embedding call, not a whole post). The embedding
computed here is also what gets persisted to `posts.embedding`, which powers the
"related posts" feature on the frontend.

Note: the vector describes the **source blurb** (title + description), not the
finished post. That's deliberate — we need it before generation to dedup — but it
means "related posts" is blurb-similarity. See Plan.md Step 3.5.
"""

import logging

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from backend.db.client import supabase
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.utils.ratelimit import gemini_embed_limiter

logger = logging.getLogger(__name__)

# Can be tuned based on results
MATCH_THRESHOLD = 0.92

# Must match the vector(768) column in the posts table.
#
# `models/text-embedding-004` is retired (404 NOT_FOUND on embedContent). Its successor
# defaults to 3072 dims, so `output_dimensionality=768` is load-bearing — without it
# every insert fails on the vector(768) column. Truncated outputs aren't unit-normalized,
# which is fine here: match_posts uses cosine distance (`<=>` / vector_cosine_ops), and
# cosine is scale-invariant.
EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIMENSIONS = 768

_embedder: GoogleGenerativeAIEmbeddings | None = None


def _get_embedder() -> GoogleGenerativeAIEmbeddings:
    """Build the embedder on first use, not at import.

    Constructing it at module level made a missing GOOGLE_API_KEY an *import* error,
    which took the whole graph down (nothing could even be compiled or drawn). Lazily
    it becomes a per-item failure that dedup_node fails open on.
    """
    global _embedder
    if _embedder is None:
        _embedder = GoogleGenerativeAIEmbeddings(
            model=EMBED_MODEL,
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBED_DIMENSIONS,
        )
    return _embedder


def get_embedding(text: str) -> list[float]:
    """Embed text as a 768-float vector, respecting the Gemini per-minute cap.

    The limiter is the tightest gate in the pipeline (free tier defaults to 5/min),
    so this call is where a run spends most of its waiting.
    """
    embedder = _get_embedder()
    gemini_embed_limiter.acquire()
    return embedder.embed_query(text)


def dedup_node(state: State) -> dict:
    if not state.get("should_process"):
        return {}  

    text = f"{state.get('topic') or ''}. {state.get('data') or ''}".strip()
    if not text or text == ".":
        logger.warning("dedup_node: nothing to embed, skipping dedup check")
        return {}

    try:
        embedding = get_embedding(text)
    except Exception as e:
        
        logger.error("dedup_node: embedding failed, skipping dedup check: %s", e)
        return {}

    try:
        result = supabase.rpc(
            "match_posts",
            {
                "query_embedding": embedding,
                "match_threshold": MATCH_THRESHOLD,
                "match_count": 1,
            },
        ).execute()
        matches = result.data or []
    except Exception as e:
        logger.error("dedup_node: match_posts RPC failed: %s", e)
        return {"embedding": embedding}

    is_duplicate = len(matches) > 0
    if is_duplicate:
        logger.info(
            "dedup: '%s' duplicates existing post '%s' (similarity %.3f)",
            (state.get("topic") or "")[:60],
            matches[0].get("slug"),
            matches[0].get("similarity", 0.0),
        )

    return {
        "embedding": embedding,
        "is_duplicate": is_duplicate,
        "duplicate_of": matches[0] if is_duplicate else None,
        # AND-reduced with triage's value — see and_reducer in stateschema.
        "should_process": not is_duplicate,
    }
