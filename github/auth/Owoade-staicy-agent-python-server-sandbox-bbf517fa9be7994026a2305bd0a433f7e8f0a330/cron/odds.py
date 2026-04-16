from langchain_core.documents import Document 
import requests
import json
import uuid
from cache import redis_client
import moment
from .standings import fetch_and_transform_team_standings

def fetch_events_and_odds(cursor=None, events=[], event_ids=[]): 

    url = "https://api.sportsgameodds.com/v2/events"

    params = {
        "leagueID": "MLB",
        "startsAfter": moment.now().format("YYYY-MM-DD"),
        "startsBefore": moment.now().add("days", 1).format("YYYY-MM-DD")
    }

    print(params['startsAfter'], params['startsBefore'])

    if cursor is not None: 
        params["cursor"] = cursor

    headers = {
        "x-api-key": "8ee41aa10925f41489e02f1f1099b7b4"
    }

    print("🚀 Starting request...")

    try:
        response = requests.get(url=url, params=params, headers=headers)
        print("✅ Request made")
        print("➡️ Status Code:", response.status_code)
        print("📄 Raw text (first 300 chars):", response.text[:300])

        data = response.json()
        for event in data['data']:
            event_id = f"EVENT-{str(uuid.uuid4())}"
            redis_client.sadd('EVENT-IDS', event_id)
            events.append(event)
            event_ids.append(event_id)
        
        if "nextCursor" in data: 
            return fetch_events_and_odds(data['nextCursor'], events=events, event_ids=event_ids);

        return events, event_ids

    except json.JSONDecodeError as decode_error:
        print("❌ Failed to parse JSON!")
        print("🧾 Raw response text:")
        print(response.text)
        print("🐞 JSON error:", decode_error)


def fetch_transform_events_and_odds( no_of_recursive_calls_left = 1 ):

    event_docs = []
    events, event_ids = fetch_events_and_odds()

    TEAM_STANDINGS_ARE_NOT_PRESENT_IN_REDIS = redis_client.get('TEAM-STANDING-TRACKER') is None

    THIS_FUNCTION_CAN_BE_CALLED_RECURSIVELY = TEAM_STANDINGS_ARE_NOT_PRESENT_IN_REDIS and no_of_recursive_calls_left > 0

    if THIS_FUNCTION_CAN_BE_CALLED_RECURSIVELY :
        no_of_recursive_calls_left -= 1
        fetch_and_transform_team_standings()
        return fetch_transform_events_and_odds(no_of_recursive_calls_left)
        

    for event in events:

        home_team_short_name = event['teams']['home']['names']['short']
        away_team_short_name = event['teams']['away']['names']['short']

        home_team_standing = redis_client.get(f"TEAM-STANDING-{home_team_short_name}")
        away_team_standing = redis_client.get(f"TEAM-STANDING-{away_team_short_name}")
        
        page_content = f"""
            TYPE: EVENT/GAME

            HOME TEAM NAME FULL: {event['teams']['home']['names']['long']}
            HOME TEAM NAME SHORT: {event['teams']['home']['names']['short']}
            HOME TEAM NAME MEDIUM: {event['teams']['home']['names']['medium']}

            AWAY TEAM NAME FULL: {event['teams']['away']['names']['long']}
            AWAY TEAM NAME SHORT: {event['teams']['away']['names']['short']}
            AWAY TEAM NAME MEDIUM: {event['teams']['away']['names']['medium']}

            GAME DATE: {event["status"]["startsAt"]}

            TEAM STANDING

            TEAM_NAME: {event['teams']['home']['names']['long']}
            STANDING: {home_team_standing}

            TEAM_NAME: {event['teams']['away']['names']['long']}
            STANDING: {away_team_standing}

            ODDS: 
            1. points-home-game-ml-home
                Market: Moneyline
                Book Odds: {event.get('odds', {}).get('points-away-game-ml-home', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-away-game-ml-home', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-away-game-ml-home', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-away-game-ml-home', {}).get('closeBookOdds', '-')}

            2: points-away-game-ml-away
                Market: Moneyline
                Book Odds: {event.get('odds', {}).get('points-away-game-ml-away', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-away-game-ml-away', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-away-game-ml-away', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-away-game-ml-away', {}).get('closeBookOdds', '-')}

            3. points-all-game-ou-over
                Market: Over/Under 
                Book Odds: {event.get('odds', {}).get('points-all-game-ou-over', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-all-game-ou-over', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-all-game-ou-over', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-all-game-ou-over', {}).get('closeBookOdds', '-')}

            4. points-all-game-ou-under
                Market: Over/Under 
                Book Odds: {event.get('odds', {}).get('points-all-game-ou-under', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-all-game-ou-under', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-all-game-ou-under', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-all-game-ou-under', {}).get('closeBookOdds', '-')}

            
            5. points-home-game-sp-home
                Market: Spread 
                Book Odds: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('closeBookOdds', '-')}
                Close Fair Spread: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('closeFairSpread', '-')}
                Close Book Spread: {event.get('odds', {}).get('points-home-game-sp-home', {}).get('closeBookSpread', '-')}
            
        6. points-home-game-sp-away
                Market: Spread 
                Book Odds: {event.get('odds', {}).get('points-home-game-sp-away', {}).get('bookOdds', '-')}
                Fair Odds: {event.get('odds', {}).get('points-home-game-sp-away', {}).get('fairOdds', '-')}
                Close Fair Odds: {event.get('odds', {}).get('points-home-game-sp-away', {}).get('closeFairOdds', '-')}
                Close Book Odds: {event.get('odds', {}).get('points-home-game-sp-away', {}).get('closeBookOdds', '-')}
                Close Fair Spread: {event.get('odds', {}).get('points-home-game-sp-away', {}).get('closeFairSpread', '-')}
        """

        event_doc = Document(
            page_content=page_content,
            metadata={
                "type": "EVENT/GAME"
            }
        )

        event_docs.append(event_doc)

    return event_docs, event_ids