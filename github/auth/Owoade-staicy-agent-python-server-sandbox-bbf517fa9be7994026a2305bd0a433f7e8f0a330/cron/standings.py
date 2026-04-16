import requests
import uuid
from langchain_core.documents import Document 
from cache import redis_client

def fetch_teams( teams=[], team_ids=[] ):
    
    sportradar_url = f"https://api.sportradar.com/mlb/trial/v6/en/seasons/2025/REG/standings.json?api_key=jgZSh6T2kgcNJBCK2hGkLmScuMYlrj8jxNH9xzuh"

    try: 
        response = requests.get(url=sportradar_url);
        
        data = response.json()
        print(response.status_code)

        for league in data["league"]["season"]["leagues"]:
            
            league_name = league["name"]

            for division in league["divisions"]:

                division_name = division["name"];

                for team in division["teams"]: 
                    team["league_name"] = league_name
                    team["division_name"] = division_name
                    team_id = f"TEAM-{uuid.uuid4()}"
                    redis_client.sadd('TEAM-IDS', team_id)
                    teams.append(team)
                    team_ids.append(team_id)
        
        return teams, team_ids
    except Exception as e: 
        print(f"Error: {e}")


def fetch_and_transform_team_standings(): 

    teams, team_ids = fetch_teams()

    team_docs = []

    for team in teams: 

        team_standing = f"""
            Team Name: {team.get("name", "-")}
            Market: {team.get("market", "-")}
            Abbreviation: {team.get("abbr", "-")}
            Team ID: {team.get("id", "-")}
            Overall Wins: {team.get("win", "-")}
            Overall Losses: {team.get("loss", "-")}
            Win Percentage: {team.get("win_p", "-")}
            Home Wins: {team.get("home_win", "-")}
            Home Losses: {team.get("home_loss", "-")}
            Away Wins: {team.get("away_win", "-")}
            Away Losses: {team.get("away_loss", "-")}
            Last 10 Wins: {team.get("last_10_won", "-")}
            Last 10 Losses: {team.get("last_10_lost", "-")}
            Current Streak: {team.get("streak", "-")}
            Games Back from Division Leader: {team.get("games_back", "-")}
            Wild Card Games Back: {team.get("wild_card_back", "-")}
            Elimination Number: {team.get("elimination_number", "-")}
            American League Wins: {team.get("al_win", "-")}
            American League Losses: {team.get("al_loss", "-")}
            Central Division Wins: {team.get("c_win", "-")}
            Central Division Losses: {team.get("c_loss", "-")}
            West Division Wins: {team.get("w_win", "-")}
            West Division Losses: {team.get("w_loss", "-")}
            East Division Wins: {team.get("e_win", "-")}
            East Division Losses: {team.get("e_loss", "-")}
        """

        REDIS_KEY = f"TEAM-STANDING-{team['abbr']}"

        redis_client.set(REDIS_KEY, team_standing)
    
    redis_client.setex('TEAM-STANDING-TRACKER', 86400, "1")



    #     team_doc = Document(
    #         page_content = page_content,
    #         metadata = {
    #             "type": "TEAM STANDING"
    #         }
    #     )

    #     team_docs.append(team_doc);

    # return team_docs, team_ids

