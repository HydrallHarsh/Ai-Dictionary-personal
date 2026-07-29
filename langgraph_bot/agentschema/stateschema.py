from langgraph.graph.message import add_messages, BaseMessage
from langchain_core.documents import Document
import operator
from pydantic import HttpUrl
from typing import Annotated, TypedDict, List, Optional
# from typing_extensions import TypedDict

def replace_reducer(current: str, new: str) -> str:
    """
    Params: 
    current : current value of the field of the state.
    new : new value addded to the state by some other graph to the field.

    In Langgraph when we have to simultanously manipulate state, it cannot be done directly , 
    we have do append operation . if both operation takes place at same time it might be posible to override the current value with none, 
    to overcome this issue, this reducer fucntion is here.
    """
    if new is not None:
        return new
    if current is not None:
        return current
    return ""


def replace_dict_reducer(current: Optional[dict], new: Optional[dict]) -> dict:
    if new is not None:
        return new
    if current is not None:
        return current
    return {}


def replace_bytes_or_none_reducer(
    current: Optional[bytes], new: Optional[bytes]
) -> Optional[bytes]:
    if new is not None:
        return new
    if current is not None:
        return current
    return None


def replace_any_reducer(current, new):
    """Same last-write-wins semantics as `replace_reducer`, but for values where
    an empty string is the wrong default (bools, lists, floats, None-able dicts).

    `replace_reducer` returns `""` when both sides are None, which is fine for text
    but wrong for e.g. `should_process` (a bool) or `embedding` (a list of floats).
    """
    if new is not None:
        return new
    return current


def and_reducer(current: Optional[bool], new: Optional[bool]) -> bool:
    """Gate reducer for `should_process`: any node that says "stop" wins.

    Triage and dedup both write this key. With plain last-write-wins, a node that
    returns `should_process=True` after another returned `False` would silently
    re-open a gate that was already closed. AND-ing is the safe merge.
    """
    if current is None:
        return bool(new)
    if new is None:
        return bool(current)
    return bool(current) and bool(new)


class State(TypedDict):
    # If you want to keep history of strings, use operator.add
    # If you just want the current value, use 'overwrite'
    user_input: Annotated[str, replace_reducer] 
    slug: Annotated[str, replace_reducer]
    
    # Lists work perfectly with operator.add
    messages: Annotated[list[BaseMessage], add_messages]
    arxiv_urls: Annotated[List[HttpUrl], operator.add]
    documents: Annotated[List[Document], operator.add]
    # These also need reducers if multiple nodes update them at once
    topic: Annotated[Optional[str], replace_reducer]
    title: Annotated[Optional[str], replace_reducer]
    title_block: Annotated[Optional[dict], replace_dict_reducer]
    summary: Annotated[Optional[str], replace_reducer]
    description: Annotated[Optional[str], replace_reducer]
    
    data: Annotated[Optional[str], replace_reducer]
    tavily_search_result: Annotated[Optional[str], replace_reducer]
    code: Annotated[Optional[str], replace_reducer]
    generated_image: Annotated[Optional[bytes], replace_bytes_or_none_reducer]

    # --- Source provenance (plumbed in from raw_api_data by build_initial_state) ---
    # `name` was already being passed by main.py but was never declared here.
    name: Annotated[Optional[str], replace_reducer]
    source_url: Annotated[Optional[str], replace_reducer]
    raw_id: Annotated[Optional[str], replace_reducer]
    # Full article body when the feed shipped it (raw_api_data.content), else None.
    # The description node prefers this over the thin RSS blurb in `data`.
    content: Annotated[Optional[str], replace_reducer]

    # --- Triage gate (nodes/triage_node.py) ---
    triage: Annotated[Optional[dict], replace_dict_reducer]
    # AND-reduced: triage and dedup both write it, and "stop" must win. See and_reducer.
    should_process: Annotated[Optional[bool], and_reducer]

    # --- Semantic dedup (nodes/dedup_node.py) ---
    embedding: Annotated[Optional[list[float]], replace_any_reducer]
    is_duplicate: Annotated[Optional[bool], replace_any_reducer]
    duplicate_of: Annotated[Optional[dict], replace_dict_reducer]

    # --- Enrichment (nodes/enrich_node.py) — fills the flat posts columns ---
    difficulty: Annotated[Optional[str], replace_reducer]
    read_time: Annotated[Optional[str], replace_reducer]
    tags: Annotated[Optional[list[str]], replace_any_reducer]
