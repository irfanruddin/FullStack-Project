"""Sends emails. With no SMTP settings, the email is printed in the server console,
which is enough for development and the demo."""
import smtplib
from email.message import EmailMessage
from .config import settings


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        print(f"\n--- EMAIL (console) ---\nTo: {to}\nSubject: {subject}\n\n{body}\n-----------------------\n")
        return
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:  # never let a failed email break the request
        print(f"Email to {to} failed: {exc}")
