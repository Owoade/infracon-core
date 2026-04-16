from langchain_openai import ChatOpenAI
import openai
from langchain_core.tools import tool
from .vector_store import vectorstore
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from dotenv import load_dotenv
from .templates import system_prompt
import os

load_dotenv()

model = ChatOpenAI(model="gpt-4o-mini", temperature=1.0);

mongodb_client = MongoClient("mongodb://localhost:27017")
checkpointer = MongoDBSaver(mongodb_client)

@tool(response_format="content_and_artifact")
def retrieve(query: str) -> str:
    """Retrieve information related to a query from official website."""
    print("calling retriever")
    retrieved_docs = vectorstore.similarity_search(query, k=5)
    serialized = "\n\n".join(
        (
            f"Source: {doc.metadata}\n" f"Content: {doc.page_content}"
            for doc in retrieved_docs
        )
    )
    print(serialized)
    return serialized, retrieved_docs


tools = [retrieve]

langchain_agent_executor = create_react_agent(model, tools, checkpointer=checkpointer)

def call_agent( query, conversation_id ):

    config = {"configurable": {"thread_id": f"{conversation_id}"}}
     
    messages = langchain_agent_executor.invoke(
        {"messages": [("human", query), ("system", system_prompt)]}, config
    )

    return messages["messages"][-1].content

client = openai.OpenAI()

def call_llm( prompts ):

    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=prompts
    )

    return response.choices[0].message.content