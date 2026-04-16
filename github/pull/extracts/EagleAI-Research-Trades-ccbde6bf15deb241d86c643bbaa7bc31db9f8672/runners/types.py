from typing import TypedDict, List


class IUser(TypedDict):
    id: str
    username: str
    name: str
    url: str


class IPublicMetrics(TypedDict):
    retweet_count: int
    reply_count: int
    like_count: int
    quote_count: int
    bookmark_count: int
    impression_count: int


class IMentions(TypedDict):
    start: int
    end: int
    username: str
    id: int


class IAnnotations(TypedDict):
    start: int
    end: int
    username: str
    id: int


class IEntities(TypedDict, total=False):
    mentions: List[IMentions]
    annotations: List[IAnnotations]


class ITweet(TypedDict):
    public_metrics: IPublicMetrics
    author_id: int
    edit_history_tweet_ids: List[int]
    entities: IEntities
    id: int
    text: str
    created_at: str
