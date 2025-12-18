from agentschema.stateschema import State
from langchain_core.messages import HumanMessage
from langgraph.graph import START,StateGraph,END
from langgraph.prebuilt import ToolNode
from nodes.anode.agentnode import summary_agent_node
from nodes.tnode.title_node import update_title_node
from nodes.load_data_node import load_data
from tools.tools import title_tool
import pprint

graph_builder = StateGraph(state_schema= State)
graph_builder.add_node("load_data",load_data)
graph_builder.add_node("summary_agent",summary_agent_node)
graph_builder.add_node("title_tool_node",ToolNode([title_tool]))
graph_builder.add_node("title_update",update_title_node)

graph_builder.set_entry_point("load_data")
graph_builder.add_edge("load_data","summary_agent")
graph_builder.add_edge("summary_agent","title_tool_node")
graph_builder.add_edge("title_tool_node","title_update")
graph_builder.add_edge("title_update",END)
graph = graph_builder.compile()


inputs = {
    "messages": [
        HumanMessage(
            content="use appropriate agents to summarize the content  given in the agent state."
        )
    ]
}

final_state =graph.invoke(inputs)

graph.get_graph().draw_mermaid_png(output_file_path='./summaryagent.png')
