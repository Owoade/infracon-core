from dotenv import load_dotenv
import os
import jwt

load_dotenv()

SECRET_KEY = os.getenv('JWT_SECRET_KEY');

def decode_jwt(token):
    print({"token": token})
    try:
        decoded_payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"]);
        return decoded_payload
    except jwt.ExpiredSignatureError:
        print("Token has expired.")
        return None
    except jwt.InvalidTokenError:
        print("Invalid token.")
        return None
    
def encode_jwt(payload):
    print({"key": type(SECRET_KEY)})
    token = token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token;