from agentschema.stateschema import State
from langchain_core.messages import HumanMessage
from langgraph.graph import START,StateGraph,END
from langgraph.prebuilt import ToolNode
from nodes.anode.agentnode import description_agent_node
from nodes.tnode.description_tool_node import arxiv_node,pdf_parsing_node,tavily_node
from nodes.load_data_node import load_data
from tools.tools import title_tool
import pprint
from pathlib import Path


desc = StateGraph(state_schema= State)
desc.add_node("load_data",load_data)
desc.add_node("description_agent",description_agent_node)
desc.add_node("arxiv_node",arxiv_node)
desc.add_node("parser_tool",pdf_parsing_node)
desc.add_node("tavily_tool",tavily_node)


desc.set_entry_point("load_data")
desc.add_edge("load_data","arxiv_node")
desc.add_edge("arxiv_node","parser_tool")
desc.add_edge("load_data","tavily_tool")
desc.add_edge("tavily_tool","description_agent")
desc.add_edge("parser_tool","description_agent")
desc.add_edge("description_agent",END)
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
