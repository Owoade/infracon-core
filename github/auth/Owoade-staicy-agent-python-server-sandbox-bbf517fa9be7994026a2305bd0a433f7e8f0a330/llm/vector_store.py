from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-base-en-v1.5", model_kwargs={"device": "cpu"}
)

vectorstore = Chroma(
    collection_name="staicy",
    embedding_function=embeddings,
    persist_directory="./staicy-events-db",
)
