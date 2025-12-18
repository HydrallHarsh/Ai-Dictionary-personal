from agentschema.stateschema import State
from langchain_core.messages import ToolMessage
from tools.tools import title_tool


def update_title_node(state:State):
    
    for msg in reversed(state['messages']):
        if isinstance(msg,ToolMessage) and msg.name == "title_tool":
             return {
                "title": msg.content
                }
    return {}
            


   
