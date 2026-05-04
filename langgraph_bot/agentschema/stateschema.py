from langgraph.graph.message import add_messages, BaseMessage
from langchain_core.documents import Document
import operator
from pydantic import HttpUrl
from typing import Annotated, TypedDict, List, Union, Optional
# from typing_extensions import TypedDict

def overwrite(current: str, new: str) -> str:
    if current :
        return current
    return new


# class State(TypedDict):
#     user_input: Annotated[str, operator.add]
#     messages: Annotated[list[BaseMessage], add_messages]
#     slug:Annotated[str,operator.add]
#     data: Optional[str]
#     topic: Optional[str]
#     title: Optional[str]
#     summary: Optional[str]
#     description: Optional[str]
#     arxiv_urls: Annotated[List[HttpUrl], operator.add]  ##
#     documents: Annotated[
#         List[Document], operator.add
#     ]  ## pdf's pages will be stored here, pdfs will be fetched from the arxiv.
#     tavily_search_result: Optional[str]
    # code: Optional[str]

class State(TypedDict):
    # If you want to keep history of strings, use operator.add
    # If you just want the current value, use 'overwrite'
    user_input: Annotated[str, overwrite] 
    slug: Annotated[str, overwrite]
    
    # Lists work perfectly with operator.add
    messages: Annotated[list[BaseMessage], add_messages]
    arxiv_urls: Annotated[List[dict], operator.add]
    documents: Annotated[List[Document], operator.add]
    # These also need reducers if multiple nodes update them at once
    topic: Annotated[Optional[str], overwrite]
    title: Annotated[Optional[str], overwrite]
    summary: Annotated[Optional[str], overwrite]
    description: Annotated[Optional[str], overwrite]
    
    data: Annotated[Optional[str], overwrite]
    tavily_search_result: Annotated[Optional[str], overwrite]
    code: Annotated[Optional[str], overwrite]
