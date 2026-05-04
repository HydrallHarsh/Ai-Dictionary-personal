from langgraph.graph import END, START, StateGraph
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.workflow.workflow import graph
from langgraph_bot.workflow.description_workflow import g
from pathlib import Path

completegraph = StateGraph(state_schema=State)
completegraph.add_node("description_node",g)
completegraph.add_node("summary_node",graph)

completegraph.add_edge(START,"summary_node")
completegraph.add_edge(START,"description_node")
completegraph.add_edge("summary_node",END)
completegraph.add_edge("description_node",END)

mjorgraph = completegraph.compile()

out_dir = Path(__file__).resolve().parents[1] / "agent_flow_diagrams"

out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / "completegraph.png"

mjorgraph.get_graph().draw_mermaid_png(output_file_path=str(out_path))

