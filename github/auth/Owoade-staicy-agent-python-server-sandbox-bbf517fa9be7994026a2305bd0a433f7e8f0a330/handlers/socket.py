from urllib.parse import parse_qs
from lib.jwt import decode_jwt
from sqlalchemy.orm import sessionmaker
from db import engine
from sqlalchemy import text
from llm.agent import call_agent, call_llm
from llm.templates import system_prompt_for_getting_conversation_title

def authenticate_client( sid, environ, client_dict, sio ):
    query_string = environ.get("QUERY_STRING")
    params = parse_qs(query_string)

    params = {key: value[0] for key, value in params.items()};

    if params['token'] is None:
        sio.disconnect(sid)

    token = params['token'];

    decoded_token = decode_jwt(token);

    if decoded_token is None:
        sio.disconnect(sid)
    
    client_dict[sid] = decoded_token

    print(decoded_token)

    sio.emit('message', 'Welcome!', to=sid)

    return decode_jwt


def handle_chat(sio, client_dict, sid, data):

    if client_dict[sid] is None:
        sio.disconnect(sid)

    Session = sessionmaker(bind=engine)
    session = Session()

    client = client_dict.get(sid, None)

    conversation_id = data.get('id', None)

    print(client)

    if client is None:
        return sio.disconnect(sio)

    if conversation_id is None:

        result = session.execute(
            text("""INSERT INTO conversations ("userId", title) VALUES (:user_id, :title) RETURNING id"""),
            {"user_id": client['id'], "title": ""}
        )

        conversation_id = result.scalar()  # Gets the first column of the first row
        print(f"Inserted conversation ID: {conversation_id}")

        session.commit()

    else:

        result = session.execute(
            text("""SELECT id FROM conversations where id=:id AND "userId"=:user_id"""),
            {"user_id": str(client['id']), "id": conversation_id }
        )

        session.close()

        if result.scalar() is None:
            print("Invalid Conversation id")
            return sio.disconnect(sid)
    
    response = call_agent(data['message'], conversation_id)

    payload = {
        "id": conversation_id,
        "message": response,
        "sender": "agent"
    }

    sio.emit("chat", payload, to=sid)

    Session = sessionmaker(bind=engine)
    session = Session()

    session.execute(
        text("""INSERT INTO messages ("conversationId", text, sender) VALUES (:conversation_id, :text, :sender)"""),
        { "conversation_id": conversation_id, "text": data['message'], "sender": "user" }
    )

    session.execute(
        text("""INSERT INTO messages ("conversationId", text, sender) VALUES (:conversation_id, :text, :sender)"""),
        { "conversation_id": conversation_id, "text": response, "sender": "agent" }
    )

    if data.get('id', None) is None:

        conversation_title = call_llm([
            { "role": "system", "content": system_prompt_for_getting_conversation_title },
            { "role": "user", "content": data['message'] }
        ])

        session.execute(
            text("UPDATE conversations SET title=:title WHERE id=:id"),
            {"id": conversation_id, "title": conversation_title}
        )
    
    session.commit()

    print(data)



    




