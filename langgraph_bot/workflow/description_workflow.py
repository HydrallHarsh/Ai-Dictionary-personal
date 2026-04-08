import pprint

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode
from pathlib import Path

from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.nodes.anode.agentnode import (
    description_agent_node,
    summary_agent_node,
)
from langgraph_bot.nodes.load_data_node import load_data
from langgraph_bot.nodes.tnode.description_tool_node import (
    arxiv_node,
    pdf_parsing_node,
    tavily_node,
)
from langgraph_bot.tools.tools import title_tool

desc = StateGraph(state_schema=State)
# desc.set_entry_point(START)
desc.add_node("description_agent", description_agent_node)
desc.add_node("summary_agent", summary_agent_node)
# desc.add_node("arxiv_node", arxiv_node) # Need to remove this right now due to arxiv api "Rate Exceeded" error (Not our error but arxiv's). We can add it back once the issue is resolved.
desc.add_node("parser_tool", pdf_parsing_node)
desc.add_node("tavily_tool", tavily_node)


# desc.set_entry_point(START)
desc.add_edge(START, "parser_tool")  # directly to parser tool, skipping arxiv for now.
# desc.add_edge("arxiv_node", "parser_tool")
desc.add_edge("parser_tool", "tavily_tool")
desc.add_edge("tavily_tool", "summary_agent")
desc.add_edge("summary_agent", "description_agent")
desc.add_edge("description_agent", END)
g = desc.compile()


def write_description_graph_png() -> Path:
    """
    Write the compiled graph diagram to `langgraph_bot/agent_flow_diagrams/description.png`.

    - Ensures the output directory exists
    - Avoids filesystem side-effects at import time (caller opts in)
    """
    out_dir = Path(__file__).resolve().parents[1] / "agent_flow_diagrams"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "description.png"

    g.get_graph().draw_mermaid_png(output_file_path=str(out_path))
    return out_path
