import socketio
import eventlet
import schedule
from cron import fetch_standings_and_load_into_chroma, fetch_events_and_load_in_chroma
from handlers.socket import authenticate_client, handle_chat

# create a Socket.IO server
sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

schedule.every(24).hours.do(fetch_standings_and_load_into_chroma)
schedule.every(30).minutes.do(fetch_events_and_load_in_chroma)

client_dict = {}

# handle connection event
@sio.event
def connect(sid, environ):
    print(f"Client connected: {sid}", environ)
    authenticate_client(sid, environ, client_dict, sio)

# handle message event
@sio.event
def message(sid, data):
    print(f"Message from {sid}: {data}")

# handle disconnect event
@sio.event
def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
def connection_error(sid, error):
    print(f"Client error: {sid}, error: {error}")

@sio.event
def chat(sid, data):
    handle_chat(sio, client_dict, sid, data)

def run_schedule():
    while True:
        schedule.run_pending()
        eventlet.sleep(1)  # Ensure the event loop can continue without blocking


# run the server
if __name__ == '__main__':
    # Run scheduler in a green thread and start the Socket.IO server
    eventlet.spawn(run_schedule)
    print("Socket.IO server is running on http://localhost:8080")
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 8080)), app)