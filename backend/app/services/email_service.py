"""Transactional email helper with dev console fallback when SMTP is unconfigured."""

from email.message import EmailMessage
import smtplib
from app.config import settings


def send_email(to_email: str, subject: str, body_text: str) -> None:
    """Send an email via SMTP, or log to console in dev if SMTP_HOST is unset."""
    if not settings.SMTP_HOST:
        print(f"\n--- [DEV EMAIL] To: {to_email} | Subject: {subject} ---\n{body_text}\n--- [END DEV EMAIL] ---\n")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        print(f"SMTP send failed ({settings.SMTP_HOST}:{settings.SMTP_PORT}): {exc}")
        print(f"\n--- [FALLBACK DEV EMAIL] To: {to_email} | Subject: {subject} ---\n{body_text}\n--- [END] ---\n")


def send_invite_email(to_email: str, invitee_name: str, raw_token: str) -> None:
    link = f"{settings.APP_BASE_URL.rstrip('/')}/accept-invite?token={raw_token}"
    subject = "You're invited to AppSuite"
    body = (
        f"Hi {invitee_name or 'there'},\n\n"
        f"You have been invited to join AppSuite.\n"
        f"Click the link below to set your password and activate your account (expires in 72 hours):\n\n"
        f"{link}\n\n"
        f"If you did not expect this invitation, you can ignore this email.\n"
    )
    send_email(to_email, subject, body)


def send_password_reset_email(to_email: str, user_name: str, raw_token: str) -> None:
    link = f"{settings.APP_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"
    subject = "Reset your AppSuite password"
    body = (
        f"Hi {user_name or 'there'},\n\n"
        f"We received a request to reset your AppSuite password.\n"
        f"Click the link below to choose a new password (expires in 1 hour):\n\n"
        f"{link}\n\n"
        f"If you did not request a password reset, you can safely ignore this email.\n"
    )
    send_email(to_email, subject, body)
