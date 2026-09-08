"""Passwords, and the single rule about them: never store the real one.

Hashing is deliberately one-way. Given the hash you cannot get the password
back, which is exactly the point. At login you hash what the person typed and
compare the hashes, so your database never holds anything worth stealing.
"""

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    """Turn a password into something safe to store."""
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Does this password match the stored hash?"""
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError):
        return False