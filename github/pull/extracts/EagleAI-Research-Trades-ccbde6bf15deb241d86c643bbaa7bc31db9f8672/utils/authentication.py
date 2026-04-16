import os
import jwt
from utils.types import IUser


class Authentication:
    def __init__(self) -> None:
        pass

    def validate(self, token) -> IUser | None:
        try:
            secret = os.getenv("JWT_SECRET")

            payload = jwt.decode(token, secret, algorithms=["HS256"])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except Exception as e:
            return None


authentication = Authentication()
