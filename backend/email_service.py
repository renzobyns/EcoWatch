import resend
import os
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "EcoWatch SJDM <onboarding@resend.dev>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

def send_verification_email(to_email: str, full_name: str, token: str):
    """Send account verification email with a confirm link."""
    verify_url = f"{FRONTEND_URL}/auth/verify?token={token}"
    
    # 🌟 Option B (Terminal Logging): Print the link so developers can verify easily
    # even if Resend restricts sending to unverified Sandbox domains.
    print(f"\n[{'='*40}]")
    print(f"📧 EMAIL VERIFICATION LINK FOR: {to_email}")
    print(f"🔗 URL: {verify_url}")
    print(f"[{'='*40}]\n")
    
    if not resend.api_key:
        print("⚠️ Warning: RESEND_API_KEY is not set. Skipping actual email dispatch.")
        return

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": to_email,
            "subject": "Verify your EcoWatch SJDM account",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #059669; text-align: center;">Welcome to EcoWatch SJDM!</h2>
                <p>Hi <b>{full_name}</b>,</p>
                <p>Thank you for registering. Please click the button below to verify your email address and activate your account.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verify_url}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
                </div>
                <p style="color: #6b7280; font-size: 12px; text-align: center;">If you didn't create this account, you can safely ignore this email.</p>
            </div>
            """
        })
    except Exception as e:
        print(f"⚠️ Failed to send verification email via Resend: {e}")


def send_password_reset_email(to_email: str, full_name: str, token: str):
    """Send password reset email with a reset link."""
    reset_url = f"{FRONTEND_URL}/auth/reset?token={token}"
    
    # 🌟 Option B (Terminal Logging)
    print(f"\n[{'='*40}]")
    print(f"📧 PASSWORD RESET LINK FOR: {to_email}")
    print(f"🔗 URL: {reset_url}")
    print(f"[{'='*40}]\n")
    
    if not resend.api_key:
        print("⚠️ Warning: RESEND_API_KEY is not set. Skipping actual email dispatch.")
        return

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": to_email,
            "subject": "Reset your EcoWatch SJDM password",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #059669; text-align: center;">Password Reset</h2>
                <p>Hi <b>{full_name}</b>,</p>
                <p>We received a request to reset your password. Click the button below to choose a new password.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="color: #6b7280; font-size: 12px; text-align: center;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            """
        })
    except Exception as e:
        print(f"⚠️ Failed to send password reset email via Resend: {e}")
