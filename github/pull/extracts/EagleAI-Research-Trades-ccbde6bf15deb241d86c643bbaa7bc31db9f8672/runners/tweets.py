import json
import logging
import os
from typing import List

import pymongo
import requests
from openai import OpenAI

from runners.types import ITweet, IUser

users: dict[str, IUser] = {
    "2207129125": {
        "id": "2207129125",
        "username": "Cointelegraph",
        "name": "Cointelegraph",
        "url": "https://t.co/td5A2zRaxE",
    },
    "1001490017917784064": {
        "id": "1001490017917784064",
        "username": "DTAPCAP",
        "name": "Dan Tapiero",
        "url": "https://t.co/HXg8FP3kxP",
    },
    "2800345565": {
        "id": "2800345565",
        "url": "https://t.co/PT2V74Luio",
        "name": "Grayscale",
        "username": "Grayscale",
    },
    "1399148563": {
        "id": "1399148563",
        "url": "https://t.co/1Vim26q40l",
        "name": "Kraken",
        "username": "krakenfx",
    },
    "1387497871751196672": {
        "id": "1387497871751196672",
        "url": "https://t.co/ySLskwm8Jg",
        "name": "Watcher.Guru",
        "username": "WatcherGuru",
    },
    "902926941413453824": {
        "id": "902926941413453824",
        "url": "https://t.co/zlvCSBI7R2",
        "name": "CZ 🔶 BNB",
        "username": "cz_binance",
    },
    "1022821051187822593": {
        "id": "1022821051187822593",
        "url": "https://t.co/Nhnbxcyx5A",
        "name": "glassnode",
        "username": "glassnode",
    },
    "412587524": {
        "id": "412587524",
        "url": "https://t.co/ziTRuMr0Gx",
        "name": "Messari",
        "username": "MessariCrypto",
    },
    "545445165": {
        "id": "545445165",
        "url": "https://t.co/NKl43QRWAI",
        "name": "Molly White",
        "username": "molly0xFFF",
    },
    "956155022957531137": {
        "id": "956155022957531137",
        "url": "https://t.co/qaOaslxs5y",
        "name": "CoinDesk Indices",
        "username": "CoinDeskMarkets",
    },
    "867328053416001536": {
        "id": "867328053416001536",
        "url": "https://t.co/SzNUlGqfnA",
        "name": "CoinMetrics.io",
        "username": "coinmetrics",
    },
}

openai_api_key = os.getenv("OPENAI_API_KEY")
mongo_uri = os.getenv("MONGO_URI")

mongo_client = pymongo.MongoClient(mongo_uri)
openai_client = OpenAI(api_key=openai_api_key)

openai_tools = [
    {
        "type": "function",
        "name": "get_tags",
        "description": "Gets and generates tags that apply to tweets. Should include at least one of breaking, macro, signal, regular. Should also include coin tweet is about where applicable e.g bitcoin, btc, solana, sol",
        "parameters": {
            "type": "object",
            "properties": {
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "an array of tags relating to tweet",
                },
            },
            "required": ["tags"],
        },
    },
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


def fetch_tweets():
    logging.info("Processing tweets...")

    query = "(" + " OR ".join(f"from:{id}" for id in users) + ")"

    url = "https://api.x.com/2/tweets/search/recent"
    token = os.getenv("X_API_KEY")

    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(
        url,
        params={
            "query": query,
            "tweet.fields": "article,attachments,author_id,created_at,entities,public_metrics",
        },
        headers=headers,
    )

    body = response.json()

    if "data" in body:
        data: List[ITweet] = body["data"]
        for tweet in data:
            try:
                input_list = [
                    {
                        "role": "user",
                        "content": f"Call get_tags() for this tweet {tweet}",
                    }
                ]

                response = openai_client.responses.create(
                    model="gpt-4.1-mini",
                    tools=openai_tools,
                    input=input_list,  # type: ignore
                )

                for item in response.output:
                    if item.type == "function_call":
                        if item.name == "get_tags":
                            tags: dict[str, List[str]] = json.loads(item.arguments)
                            db = mongo_client["snapshots"]
                            coll = db["tweets"]

                            exists = coll.find_one({"tweet_id": tweet.get("id")})

                            if exists:
                                continue

                            author_id = tweet.get("author_id", {})
                            author_name = users.get(str(author_id), {}).get("name")
                            author_url = users.get(str(author_id), {}).get("url")
                            author_username = users.get(str(author_id), {}).get(
                                "username"
                            )
                            created_at = tweet.get("created_at", {})
                            edit_history_tweet_ids = tweet.get(
                                "edit_history_tweet_ids", {}
                            )
                            entities = tweet.get("entities", {})
                            tweet_id = tweet.get("id", {})
                            public_metrics = tweet.get("public_metrics", {})
                            text = tweet.get("text", {})
                            tag = tags.get("tags")

                            created_tweet = {
                                "author": {
                                    "id": author_id,
                                    "name": author_name,
                                    "url": author_url,
                                    "username": author_username,
                                },
                                "created_at": created_at,
                                "edit_history_tweet_ids": edit_history_tweet_ids,
                                "entities": entities,
                                "tweet_id": tweet_id,
                                "public_metrics": public_metrics,
                                "text": text,
                                "tags": tag,
                            }

                            coll.insert_one(created_tweet)

            except Exception as e:
                logging.error(f"Error processing tweet: {e}")
