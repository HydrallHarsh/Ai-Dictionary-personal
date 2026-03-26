from langgraph.graph.message import add_messages, BaseMessage
from langchain_core.documents import Document
import operator
from pydantic import HttpUrl
from typing import Annotated, TypedDict, List, Union, Optional
# from typing_extensions import TypedDict


class State(TypedDict):
    user_input: Optional[Union[str, list]]
    messages: Annotated[list[BaseMessage], add_messages]
    data: Optional[str]
    topic: Optional[str]
    title: Optional[str]
    summary: Optional[str]
    description: Optional[str]
    arxiv_urls: Annotated[List[HttpUrl], operator.add]  ##
    documents: Annotated[
        List[Document], operator.add
    ]  ## pdf's pages will be stored here, pdfs will be fetched from the arxiv.
    tavily_search_result: Optional[str]
    code: Optional[str]
