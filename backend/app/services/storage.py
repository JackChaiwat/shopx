import io
import mimetypes
import uuid
from typing import Optional

import boto3
import structlog
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.exceptions import StorageException

logger = structlog.get_logger(__name__)


class StorageService:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=f"{'https' if settings.MINIO_USE_SSL else 'http'}://{settings.MINIO_ENDPOINT}",
                aws_access_key_id=settings.MINIO_ACCESS_KEY,
                aws_secret_access_key=settings.MINIO_SECRET_KEY,
                config=Config(signature_version="s3v4"),
                region_name="us-east-1",
            )
        return self._client

    async def initialize_buckets(self):
        """Create required buckets if they don't exist."""
        buckets = [
            settings.MINIO_BUCKET_PRODUCTS,
            settings.MINIO_BUCKET_AVATARS,
            settings.MINIO_BUCKET_CHAT,
        ]
        for bucket in buckets:
            try:
                self.client.head_bucket(Bucket=bucket)
            except ClientError:
                try:
                    self.client.create_bucket(Bucket=bucket)
                    logger.info("Bucket created", bucket=bucket)
                except ClientError as e:
                    logger.error("Failed to create bucket", bucket=bucket, error=str(e))

    async def upload_file(
        self,
        file_data: bytes,
        bucket: str,
        filename: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> str:
        """Upload file and return public URL."""
        if not filename:
            ext = mimetypes.guess_extension(content_type or "image/jpeg") or ".jpg"
            filename = f"{uuid.uuid4().hex}{ext}"

        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        try:
            self.client.put_object(
                Bucket=bucket,
                Key=filename,
                Body=io.BytesIO(file_data),
                ContentType=content_type,
            )
            return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{filename}"
        except ClientError as e:
            logger.error("Upload failed", bucket=bucket, error=str(e))
            raise StorageException(f"Failed to upload file: {str(e)}")

    async def delete_file(self, bucket: str, filename: str) -> bool:
        """Delete file from storage."""
        try:
            self.client.delete_object(Bucket=bucket, Key=filename)
            return True
        except ClientError as e:
            logger.error("Delete failed", bucket=bucket, filename=filename, error=str(e))
            return False

    def get_public_url(self, bucket: str, filename: str) -> str:
        return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{filename}"


storage_service = StorageService()
