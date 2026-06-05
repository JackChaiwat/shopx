from fastapi import APIRouter, File, UploadFile

from app.api.v1.dependencies.auth import CurrentActiveUser, DBSession
from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.services.storage import storage_service

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/image")
async def upload_image(
    current_user: CurrentActiveUser,
    file: UploadFile = File(...),
    bucket: str = "product-images",
):
    if file.content_type not in ALLOWED_TYPES:
        raise BadRequestException("Only JPEG, PNG, WebP and GIF images allowed")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise BadRequestException("File must be under 10MB")

    allowed_buckets = {
        settings.MINIO_BUCKET_PRODUCTS,
        settings.MINIO_BUCKET_AVATARS,
        settings.MINIO_BUCKET_CHAT,
    }
    if bucket not in allowed_buckets:
        raise BadRequestException("Invalid bucket")

    url = await storage_service.upload_file(
        file_data=data,
        bucket=bucket,
        content_type=file.content_type,
    )
    return {"success": True, "data": {"url": url}}
