from typing import Any, Dict, Optional


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, resource: str, identifier: Any = None):
        super().__init__(
            status_code=404,
            code="NOT_FOUND",
            message=f"{resource} not found",
            details={"resource": resource, "id": str(identifier) if identifier else None},
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(status_code=401, code="UNAUTHORIZED", message=message)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(status_code=403, code="FORBIDDEN", message=message)


class BadRequestException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(status_code=400, code="BAD_REQUEST", message=message, details=details)


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(status_code=409, code="CONFLICT", message=message)


class ValidationException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            status_code=422,
            code="VALIDATION_ERROR",
            message=message,
            details=details,
        )


class PaymentException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            status_code=402,
            code="PAYMENT_ERROR",
            message=message,
            details=details,
        )


class StorageException(AppException):
    def __init__(self, message: str):
        super().__init__(status_code=500, code="STORAGE_ERROR", message=message)


class RateLimitException(AppException):
    def __init__(self):
        super().__init__(
            status_code=429,
            code="RATE_LIMIT_EXCEEDED",
            message="Too many requests. Please try again later.",
        )
