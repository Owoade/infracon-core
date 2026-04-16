import os
import binascii
from Crypto.Cipher import AES


def decrypt(encrypted):
    try:
        secret = os.getenv("ENCRYPTION_KEY")
        if not secret:
            raise ValueError("ENCRYPTION_KEY environment variable is not set")

        key = secret.encode("utf-8").ljust(32, b"\0")[:32]
        ciphertext = binascii.unhexlify(encrypted)

        iv = key[: AES.block_size]

        cipher = AES.new(key, AES.MODE_CBC, iv)
        plaintext = cipher.decrypt(ciphertext)

        padding = plaintext[-1]
        if padding > AES.block_size:
            raise ValueError("invalid padding")

        plaintext = plaintext[:-padding]

        return plaintext.decode("utf-8")

    except Exception as e:
        raise Exception(f"Decryption error: {str(e)}")
