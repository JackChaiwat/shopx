from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from app.api.v1.dependencies.auth import CurrentSeller, DBSession
from app.core.exceptions import BadRequestException
from app.models.models import HomepageSlide

router = APIRouter()


class HomepageSlideOut(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    imageUrl: str
    ctaText: Optional[str] = None
    ctaHref: Optional[str] = None
    sortOrder: int
    enabled: bool


class HomepageSlideIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subtitle: Optional[str] = None
    image_url: str = Field(min_length=8, max_length=2048)
    cta_text: Optional[str] = Field(default=None, max_length=100)
    cta_href: Optional[str] = Field(default=None, max_length=512)
    sort_order: int = 0
    is_enabled: bool = True


class HomepageSlidesUpdate(BaseModel):
    slides: List[HomepageSlideIn] = Field(default_factory=list, max_length=12)


def serialize_slide(slide: HomepageSlide) -> dict:
    return {
        "id": str(slide.id),
        "title": slide.title,
        "subtitle": slide.subtitle,
        "imageUrl": slide.image_url,
        "ctaText": slide.cta_text,
        "ctaHref": slide.cta_href,
        "sortOrder": slide.sort_order,
        "enabled": slide.is_enabled,
    }


def validate_slide_url(url: str) -> None:
    if not url.startswith(("http://", "https://")):
        raise BadRequestException("Slide image URL must start with http:// or https://")


@router.get("/slides")
async def list_homepage_slides(db: DBSession):
    result = await db.execute(
        select(HomepageSlide)
        .where(HomepageSlide.is_enabled.is_(True))
        .order_by(HomepageSlide.sort_order.asc(), HomepageSlide.created_at.asc())
    )
    return {"success": True, "data": [serialize_slide(slide) for slide in result.scalars().all()]}


@router.get("/slides/manage")
async def manage_homepage_slides(current_user: CurrentSeller, db: DBSession):
    result = await db.execute(
        select(HomepageSlide).order_by(HomepageSlide.sort_order.asc(), HomepageSlide.created_at.asc())
    )
    return {"success": True, "data": [serialize_slide(slide) for slide in result.scalars().all()]}


@router.put("/slides")
async def update_homepage_slides(payload: HomepageSlidesUpdate, current_user: CurrentSeller, db: DBSession):
    if not payload.slides:
        raise BadRequestException("At least one homepage slide is required")

    for slide in payload.slides:
        validate_slide_url(slide.image_url)

    await db.execute(delete(HomepageSlide))
    created = []

    for index, slide in enumerate(payload.slides):
        item = HomepageSlide(
            title=slide.title.strip(),
            subtitle=slide.subtitle.strip() if slide.subtitle else None,
            image_url=slide.image_url.strip(),
            cta_text=slide.cta_text.strip() if slide.cta_text else None,
            cta_href=slide.cta_href.strip() if slide.cta_href else None,
            sort_order=index,
            is_enabled=slide.is_enabled,
        )
        db.add(item)
        created.append(item)

    await db.commit()
    for item in created:
        await db.refresh(item)

    return {"success": True, "data": [serialize_slide(slide) for slide in created]}
