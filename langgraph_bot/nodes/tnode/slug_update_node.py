from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.tools.tools import slug_tool



def slug_node(state:State):
    slug_res = slug_tool.invoke({"posttitle":state['title']})
    return {"slug":slug_res}