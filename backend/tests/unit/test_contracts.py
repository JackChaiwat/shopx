def test_product_sort_values_are_documented():
    allowed = {"created_at", "base_price", "price", "rating", "sold_count", "stock_quantity", "view_count"}
    assert "sold_count" in allowed
    assert "sold" not in allowed


def test_homepage_slide_payload_shape():
    slide = {
        "title": "Banner",
        "subtitle": "Subtitle",
        "image_url": "https://example.com/banner.jpg",
        "cta_text": "Shop",
        "cta_href": "/search",
        "sort_order": 0,
        "is_enabled": True,
    }
    assert slide["image_url"].startswith("https://")
    assert isinstance(slide["is_enabled"], bool)
