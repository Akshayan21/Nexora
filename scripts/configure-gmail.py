"""Prepare local Gmail settings without displaying or replacing Google credentials."""
from pathlib import Path
import re

from cryptography.fernet import Fernet

root = Path(__file__).resolve().parents[1]
path = root / ".env"
text = path.read_text() if path.exists() else (root / ".env.example").read_text()


def put(name, value):
    global text
    pattern = rf"(?m)^{name}=.*$"
    line = f"{name}={value}"
    text = re.sub(pattern, lambda _: line, text) if re.search(pattern, text) else text.rstrip() + "\n" + line + "\n"


match = re.search(r"(?m)^TOKEN_ENCRYPTION_KEY=(.*)$", text)
try:
    Fernet(match.group(1).strip().strip('\"\'').encode() if match else b"")
except ValueError:
    put("TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    print("Generated a local token encryption key.")

put("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/mailboxes/google/callback")
path.write_text(text)
print("Gmail callback configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET locally in .env.")
