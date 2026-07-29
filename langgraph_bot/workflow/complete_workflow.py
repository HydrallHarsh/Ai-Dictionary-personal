"""Top-level graph: cheap gates first, then the two generation subgraphs, then enrich.

    START
      → triage          (1 Groq call — is this worth writing about?)
      → dedup           (1 Gemini embedding — have we already covered it?)
      → [gate]          ── skip ──────────────────────────────────► END
           └─ continue ─┬─► summary_node      (subgraph, workflow.py)
                        └─► description_node  (subgraph, description_workflow.py)
                            both join at ↓
      → enrich          (0 LLM calls — maps title_block onto the posts columns)
      → END

The two generation subgraphs are unchanged and still run in parallel; the work here
was *gating* them, not rebuilding them. Their internals:

- `summary_node`     = generate_title_block → slug_node → summary_agent → image_generation_node
- `description_node` = parser_tool → tavily_tool → description_agent

`enrich` has to be top-level (not inside a subgraph) because it reads `title_block`
from the summary branch and `description` from the description branch.
"""

from pathlib import Path

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.nodes.dedup_node import dedup_node
from langgraph_bot.nodes.enrich_node import enrich_node
from langgraph_bot.nodes.triage_node import triage_node
from langgraph_bot.workflow.description_workflow import g
from langgraph_bot.workflow.workflow import graph

_RETRY = RetryPolicy(max_attempts=3)


def should_continue(state: State) -> list[str] | str:
    if state.get("should_process"):
        return ["description_node", "summary_node"]
    return END


completegraph = StateGraph(state_schema=State)

# Cheap gates, before any expensive generation.
completegraph.add_node("triage", triage_node, retry_policy=_RETRY)
completegraph.add_node("dedup", dedup_node, retry_policy=_RETRY)

# Expensive generation: the two existing compiled subgraphs, used as nodes.
completegraph.add_node("description_node", g)
completegraph.add_node("summary_node", graph)

completegraph.add_node("enrich", enrich_node)

completegraph.add_edge(START, "triage")
completegraph.add_edge("triage", "dedup")

completegraph.add_conditional_edges(
    "dedup",
    should_continue,
    ["description_node", "summary_node", END],
)

# Both branches join at enrich; the state reducers handle the concurrent writes.
completegraph.add_edge("description_node", "enrich")
completegraph.add_edge("summary_node", "enrich")
completegraph.add_edge("enrich", END)

mjorgraph = completegraph.compile()


def write_complete_graph_png() -> Path:
    """
        Write the compiled graph diagram to `langgraph_bot/agent_flow_diagrams/completegraph.png`.
        Ensures the output directory exists
    """
    out_dir = Path(__file__).resolve().parents[1] / "agent_flow_diagrams"

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "completegraph.png"

    mjorgraph.get_graph().draw_mermaid_png(output_file_path=str(out_path))
    return out_path
