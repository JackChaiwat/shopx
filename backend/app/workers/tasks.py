import structlog
from celery import shared_task

from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="app.workers.tasks.send_email_task", bind=True, max_retries=3)
def send_email_task(self, to: str, subject: str, template: str, context: dict):
    """Send transactional email via SMTP."""
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from jinja2 import Environment, PackageLoader, select_autoescape

        from app.core.config import settings

        # Build email body from simple inline templates
        templates = {
            "email_verification": f"""
                <h2>Verify your email</h2>
                <p>Hi {context.get('name', '')},</p>
                <p>Click the link to verify your email:</p>
                <a href="{context.get('frontend_url', 'http://localhost')}/verify-email?token={context.get('token', '')}">Verify Email</a>
            """,
            "password_reset": f"""
                <h2>Reset your password</h2>
                <p>Hi {context.get('name', '')},</p>
                <p>Click the link to reset your password (expires in 1 hour):</p>
                <a href="{context.get('frontend_url', 'http://localhost')}/reset-password?token={context.get('token', '')}">Reset Password</a>
            """,
            "otp_verification": f"""
                <h2>Your ShopX verification code</h2>
                <p>Hi {context.get('name', '')},</p>
                <p>Use this code to verify your email:</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{context.get('otp', '')}</p>
                <p>This code expires in {context.get('expiry_minutes', 10)} minutes.</p>
            """,
            "otp_reset": f"""
                <h2>Your ShopX password reset code</h2>
                <p>Hi {context.get('name', '')},</p>
                <p>Use this code to reset your password:</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{context.get('otp', '')}</p>
                <p>This code expires in {context.get('expiry_minutes', 10)} minutes.</p>
            """,
            "order_confirmation": f"""
                <h2>Order Confirmed</h2>
                <p>Hi {context.get('name', '')},</p>
                <p>Your order #{context.get('order_number', '')} has been confirmed.</p>
                <p>Total: {context.get('total', '')}</p>
            """,
        }

        body = templates.get(template, f"<p>{subject}</p>")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(body, "html"))

        if settings.SMTP_HOST:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, to, msg.as_string())

        logger.info("Email sent", to=to, subject=subject)

    except Exception as exc:
        logger.error("Email send failed", to=to, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.workers.tasks.send_notification_task", bind=True, max_retries=3)
def send_notification_task(self, user_id: str, notification_type: str, title: str, body: str, metadata: dict = None):
    """Create in-app notification and optionally push."""
    try:
        import asyncio
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
        from app.core.config import settings
        from app.models.models import Notification, NotificationType

        async def _create():
            engine = create_async_engine(settings.DATABASE_URL)
            Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            async with Session() as session:
                import uuid
                notif = Notification(
                    user_id=uuid.UUID(user_id),
                    type=NotificationType(notification_type),
                    title=title,
                    body=body,
                    notif_metadata=metadata,
                )
                session.add(notif)
                await session.commit()
            await engine.dispose()

        asyncio.run(_create())
        logger.info("Notification created", user_id=user_id, type=notification_type)

    except Exception as exc:
        logger.error("Notification task failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.workers.tasks.process_order_task")
def process_order_task(order_id: str):
    """Post-payment order processing."""
    logger.info("Processing order", order_id=order_id)


@celery_app.task(name="app.workers.tasks.expire_flash_sales")
def expire_flash_sales():
    """Deactivate expired flash sales."""
    logger.info("Checking for expired flash sales")


@celery_app.task(name="app.workers.tasks.cleanup_expired_carts")
def cleanup_expired_carts():
    """Remove cart items for deleted products."""
    logger.info("Cleaning up expired cart items")


@celery_app.task(name="app.workers.tasks.cancel_expired_promptpay_orders")
def cancel_expired_promptpay_orders():
    """Cancel PromptPay orders whose payment window has expired."""
    try:
        import asyncio

        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
        from sqlalchemy.orm import selectinload

        from app.api.v1.endpoints.payments import expire_promptpay_payment_if_needed
        from app.core.config import settings
        from app.models.models import Order, Payment, PaymentMethod, PaymentStatus

        async def _cancel_expired():
            engine = create_async_engine(settings.DATABASE_URL)
            Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            async with Session() as session:
                result = await session.execute(
                    select(Payment)
                    .options(selectinload(Payment.order).selectinload(Order.items))
                    .where(
                        Payment.method == PaymentMethod.PROMPTPAY,
                        Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
                    )
                )
                cancelled = 0
                for payment in result.scalars().all():
                    if await expire_promptpay_payment_if_needed(payment, payment.order, session):
                        cancelled += 1
                if cancelled:
                    await session.commit()
            await engine.dispose()
            return cancelled

        cancelled_count = asyncio.run(_cancel_expired())
        logger.info("Expired PromptPay orders cancelled", count=cancelled_count)

    except Exception as exc:
        logger.error("PromptPay expiry task failed", error=str(exc))
        raise
