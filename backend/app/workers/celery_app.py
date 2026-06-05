from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "ecommerce",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Bangkok",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.send_email_task": {"queue": "emails"},
        "app.workers.tasks.send_notification_task": {"queue": "notifications"},
        "app.workers.tasks.process_order_task": {"queue": "default"},
        "app.workers.tasks.cancel_expired_promptpay_orders": {"queue": "default"},
    },
    beat_schedule={
        "expire-flash-sales": {
            "task": "app.workers.tasks.expire_flash_sales",
            "schedule": crontab(minute="*/5"),
        },
        "cleanup-expired-carts": {
            "task": "app.workers.tasks.cleanup_expired_carts",
            "schedule": crontab(hour="2", minute="0"),
        },
        "cancel-expired-promptpay-orders": {
            "task": "app.workers.tasks.cancel_expired_promptpay_orders",
            "schedule": crontab(minute="*/1"),
        },
    },
)
