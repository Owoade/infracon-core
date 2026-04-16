from llm import vectorstore
from .odds import fetch_transform_events_and_odds
from .standings import fetch_and_transform_team_standings
from cache import redis_client

def fetch_events_and_load_in_chroma():

    print("Fetching events and loading into chroma")

    event_ids = redis_client.smembers('EVENT-IDS');

    if len(event_ids) > 0:
        vectorstore.delete(ids=list(event_ids))
        [redis_client.srem("EVENT-IDS", event_id) for event_id in event_ids]

    print({"collection_count_after_del": vectorstore._chroma_collection})

    event_docs, event_ids = fetch_transform_events_and_odds()
    # print(event_ids)
    vectorstore.add_documents(documents=event_docs, ids=event_ids)
    print(vectorstore._collection.count())

def fetch_standings_and_load_into_chroma():

    print("Fetching standings and loading into chroma")

    team_ids = redis_client.smembers("TEAM-IDS")

    if len(team_ids) > 0:
        vectorstore.delete(ids=list(team_ids))
        [redis_client.srem("TEAM-IDS", team_id) for team_id in team_ids]

    fetch_and_transform_team_standings();
