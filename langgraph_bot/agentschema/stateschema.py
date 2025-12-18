from typing import Annotated,TypedDict,List,Union,Optional
from langgraph.graph.message import add_messages,BaseMessage
# from typing_extensions import TypedDict



class State(TypedDict):
    user_input:Optional[Union[str,list]]
    messages:Annotated[list[BaseMessage], add_messages]
    data:Optional[str]
    topic:Optional[str]
    title:Optional[str]
    summary:Optional[str]
    code:Optional[str]

    
    

    
