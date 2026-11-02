"""Comprehensive pytest suite for Nano Banana Studio corporate Flask + SQLAlchemy + Alembic backend."""

from __future__ import annotations

import base64
import json
from pathlib import Path
import sys
import time

from alembic import command
from sqlalchemy import inspect

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app import create_app
from app.db.session import engine, get_alembic_config, run_migrations


app = create_app()
client = app.test_client()

_SAMPLE_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def _make_fake_google_jwt(claims: dict[str, object]) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(b"fake-signature-bytes").decode().rstrip("=")
    return f"{header}.{payload}.{signature}"


def test_alembic_migrations_upgrade_and_schema() -> None:
    """Verify Alembic migrations apply cleanly and create `users`, `conversations`, `conversation_turns`."""
    cfg = get_alembic_config()
    command.upgrade(cfg, "head")
    run_migrations("head")

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert {"users", "conversations", "conversation_turns", "alembic_version"} <= tables


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "nanobanana-interactive-backend"
    assert data["framework"] == "flask"
    assert data["orm"] == "sqlalchemy"
    assert data["migrations"] == "alembic"
    assert data["key_storage"] == "never_stored"
    assert data["auth_required"] is False
    assert data["default_dev_user_id"] == "usr_local_dev"
    assert data["bucket_provider"] == "rustfs"
    assert data["bucket_name"] == "nanobanana-images"
    assert response.headers.get("X-Key-Storage-Policy") == "never-stored-browser-only"


def test_cors_headers() -> None:
    response = client.options(
        "/api/interactive/analyze",
        headers={
            "Origin": "http://localhost:18080",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == "*"


def test_bootstrap_endpoint() -> None:
    response = client.get("/api/bootstrap")
    assert response.status_code == 200
    data = response.get_json()

    assert "style_presets" in data
    assert "modifier_categories" in data
    assert "interactive_workflow_steps" in data
    assert "quick_iteration_chips" in data
    assert data["auth_required"] is False
    assert data["default_dev_user_id"] == "usr_local_dev"
    assert data["security_policy"]["key_storage"] == "never_stored"
    assert data["security_policy"]["framework"] == "flask"
    assert data["security_policy"]["orm"] == "sqlalchemy"
    assert data["security_policy"]["migrations"] == "alembic"
    assert data["security_policy"]["bucket_provider"] == "rustfs"
    assert data["security_policy"]["google_auth_supported"] is True
    assert data["security_policy"]["facebook_auth_supported"] is True

    presets = data["style_presets"]
    assert len(presets) >= 6
    preset_ids = {p["id"] for p in presets}
    assert {"editorial-anime", "analog-35mm", "neo-brutalist", "cyberpunk-3d"} <= preset_ids

    categories = data["modifier_categories"]
    assert len(categories) == 5
    assert {c["id"] for c in categories} == {"lighting", "camera", "composition", "palette", "mood"}

    steps = data["interactive_workflow_steps"]
    assert len(steps) == 4
    assert [s["step"] for s in steps] == [1, 2, 3, 4]


def test_interactive_analyze_minimal_and_enriched() -> None:
    res_min = client.post(
        "/api/interactive/analyze",
        json={
            "idea": "Uma exploradora futurista",
            "style_id": "editorial-anime",
            "modifiers": [],
            "step": 1,
        },
    )
    assert res_min.status_code == 200
    data_min = res_min.get_json()

    assert 15 <= data_min["completeness_score"] <= 100
    assert len(data_min["guided_questions"]) == 3
    assert len(data_min["variations"]) == 3
    assert "Uma exploradora futurista" in data_min["master_prompt"]

    res_rich = client.post(
        "/api/interactive/analyze",
        json={
            "idea": (
                "Uma exploradora futurista caminhando em uma rua ensolarada de Tóquio "
                "com iluminação golden hour e lente 35mm dramática"
            ),
            "style_id": "editorial-anime",
            "modifiers": ["golden-hour", "lens-35mm", "rule-of-thirds"],
            "step": 2,
        },
    )
    assert res_rich.status_code == 200
    data_rich = res_rich.get_json()
    assert data_rich["completeness_score"] > data_min["completeness_score"]


def test_interactive_refine_endpoint() -> None:
    response = client.post(
        "/api/interactive/refine",
        json={
            "current_prompt": "Editorial anime explorer character in a sunlit urban street, 35mm lens",
            "instruction": "Mude o fundo para uma rua em Tóquio à noite com luz de neon amarelo",
            "style_id": "editorial-anime",
            "modifiers": ["acid-rim"],
        },
    )
    assert response.status_code == 200
    data = response.get_json()

    assert "Tóquio" in data["refined_prompt"]
    assert "Keep the exact character identity" in data["edit_instruction"]
    assert len(data["next_suggestions"]) == 4


def test_google_auth_dev_and_jwt_upsert() -> None:
    res_dev = client.post(
        "/api/auth/google",
        json={
            "dev_profile": {
                "name": "Vitor Vieira",
                "email": "vitor.dev@google.com",
                "picture": "https://example.com/avatar.png",
            }
        },
    )
    assert res_dev.status_code == 200
    dev_data = res_dev.get_json()
    assert dev_data["authenticated"] is True
    assert dev_data["provider"] == "google"
    assert dev_data["auth_mode"] == "google_dev_handshake"
    assert dev_data["key_storage"] == "never_stored"
    assert dev_data["user"]["email"] == "vitor.dev@google.com"
    assert dev_data["user"]["provider"] == "google"
    assert dev_data["user"]["id"].startswith("usr_")

    valid_jwt = _make_fake_google_jwt(
        {
            "iss": "https://accounts.google.com",
            "sub": "10987654321000",
            "email": "ana.editorial@google.com",
            "name": "Ana Editorial",
            "picture": "https://example.com/ana.png",
            "email_verified": True,
            "exp": int(time.time()) + 3600,
        }
    )
    res_jwt = client.post("/api/auth/google", json={"credential": valid_jwt})
    assert res_jwt.status_code == 200
    jwt_data = res_jwt.get_json()
    assert jwt_data["authenticated"] is True
    assert jwt_data["auth_mode"] == "google_jwt"
    assert jwt_data["user"]["google_sub"] == "10987654321000"
    assert jwt_data["user"]["email"] == "ana.editorial@google.com"

    bad_jwt = _make_fake_google_jwt(
        {
            "iss": "https://evil.example.com",
            "sub": "999",
            "email": "hacker@example.com",
        }
    )
    res_bad = client.post("/api/auth/google", json={"credential": bad_jwt})
    assert res_bad.status_code == 401


def test_facebook_auth_and_conversation_persistence() -> None:
    res_fb = client.post(
        "/api/auth/facebook",
        json={
            "access_token": "EAABsbCS1iHgBO_sample_fb_token",
            "user_id": "fb_987654321",
            "dev_profile": {
                "name": "Marina Social",
                "email": "marina.fb@facebook.com",
                "picture": "https://example.com/marina.png",
            },
        },
    )
    assert res_fb.status_code == 200
    fb_data = res_fb.get_json()
    assert fb_data["authenticated"] is True
    assert fb_data["provider"] == "facebook"
    assert fb_data["auth_mode"] == "facebook_oauth"
    assert fb_data["key_storage"] == "never_stored"
    assert fb_data["user"]["provider"] == "facebook"
    assert fb_data["user"]["email"] == "marina.fb@facebook.com"

    fb_user_id = fb_data["user"]["id"]
    turn_res = client.post(
        "/api/conversations/new/turns",
        json={
            "user_id": fb_user_id,
            "raw_idea": "Retrato cyberpunk Facebook",
            "master_prompt": "Cyberpunk portrait for Facebook authenticated user",
            "image_data_url": _SAMPLE_PNG_DATA_URL,
        },
    )
    assert turn_res.status_code == 200
    assert turn_res.get_json()["user_id"] == fb_user_id


def test_local_dev_instance_no_login_required() -> None:
    conv_res = client.post(
        "/api/conversations",
        json={"title": "Sessão Local Sem Login", "style_id": "editorial-anime"},
    )
    assert conv_res.status_code == 200
    conv = conv_res.get_json()
    assert conv["user_id"] == "usr_local_dev"

    turn_res = client.post(
        f"/api/conversations/{conv['id']}/turns",
        json={
            "raw_idea": "Cena criada em instância local sem login",
            "master_prompt": "Local dev instance prompt saved directly to PostgreSQL and RustFS",
            "image_data_url": _SAMPLE_PNG_DATA_URL,
        },
    )
    assert turn_res.status_code == 200
    turn = turn_res.get_json()
    assert turn["user_id"] == "usr_local_dev"
    assert turn["bucket_provider"] == "rustfs"

    list_res = client.get("/api/conversations")
    assert list_res.status_code == 200
    assert list_res.get_json()["user_id"] == "usr_local_dev"

    gallery_res = client.get("/api/users/usr_local_dev/gallery")
    assert gallery_res.status_code == 200
    assert gallery_res.get_json()["total"] >= 1


def test_conversations_turns_rustfs_bucket_and_gallery() -> None:
    auth_res = client.post(
        "/api/auth/google",
        json={"dev_profile": {"name": "Criadora Studio", "email": "criadora@google.com"}},
    )
    assert auth_res.status_code == 200
    user_id = auth_res.get_json()["user"]["id"]

    conv_res = client.post(
        "/api/conversations",
        json={
            "user_id": user_id,
            "title": "Exploradora em Tóquio",
            "style_id": "editorial-anime",
        },
    )
    assert conv_res.status_code == 200
    conv_data = conv_res.get_json()
    conv_id = conv_data["id"]
    assert conv_data["user_id"] == user_id
    assert conv_data["turn_count"] == 0

    turn1_res = client.post(
        f"/api/conversations/{conv_id}/turns",
        json={
            "user_id": user_id,
            "role": "assistant",
            "raw_idea": "Uma exploradora futurista em uma rua ensolarada",
            "master_prompt": "Editorial anime illustration of a futuristic explorer on a sunlit street",
            "style_id": "editorial-anime",
            "modifiers": ["golden-hour", "lens-35mm"],
            "completeness_score": 88,
            "analysis": {"detected_dimensions": ["subject", "lighting", "camera"]},
            "image_data_url": _SAMPLE_PNG_DATA_URL,
            "aspect_ratio": "3:4",
            "model_used": "gemini-2.5-flash-image",
        },
    )
    assert turn1_res.status_code == 200
    turn1 = turn1_res.get_json()
    assert turn1["turn_number"] == 1
    assert turn1["bucket_provider"] == "rustfs"
    assert turn1["storage_status"] == "saved_postgres_and_rustfs"
    assert turn1["image_bucket_key"].startswith("nanobanana-images/")
    assert turn1["image_url"].endswith(".png")

    turn2_res = client.post(
        f"/api/conversations/{conv_id}/turns",
        json={
            "user_id": user_id,
            "role": "assistant",
            "raw_idea": "Mudar horário para noite neon",
            "master_prompt": "Editorial anime explorer at night in Tokyo with neon rain reflections",
            "edit_instruction": "Keep character identity and transform street to nocturnal neon rain",
            "style_id": "editorial-anime",
            "modifiers": ["neon-rain"],
            "completeness_score": 95,
            "image_data_url": _SAMPLE_PNG_DATA_URL,
            "aspect_ratio": "3:4",
            "model_used": "gemini-2.5-flash-image",
        },
    )
    assert turn2_res.status_code == 200
    turn2 = turn2_res.get_json()
    assert turn2["turn_number"] == 2

    list_res = client.get(f"/api/conversations?user_id={user_id}")
    assert list_res.status_code == 200
    list_data = list_res.get_json()
    assert list_data["bucket_provider"] == "rustfs"
    matching = [c for c in list_data["conversations"] if c["id"] == conv_id]
    assert len(matching) == 1
    assert matching[0]["turn_count"] == 2
    assert matching[0]["preview_image_url"] == turn2["image_url"]

    detail_res = client.get(f"/api/conversations/{conv_id}?user_id={user_id}")
    assert detail_res.status_code == 200
    detail = detail_res.get_json()
    assert len(detail["turns"]) == 2
    assert [t["turn_number"] for t in detail["turns"]] == [1, 2]

    gallery_res = client.get(f"/api/users/{user_id}/gallery")
    assert gallery_res.status_code == 200
    gallery = gallery_res.get_json()
    assert gallery["bucket_provider"] == "rustfs"
    assert gallery["bucket_name"] == "nanobanana-images"
    assert gallery["total"] >= 2
    assert any(item["turn_id"] == turn1["id"] for item in gallery["items"])

    bucket_path = f"/api/bucket/{turn1['image_bucket_key']}"
    img_res = client.get(bucket_path)
    assert img_res.status_code == 200
    assert img_res.headers.get("Content-Type") == "image/png"
    assert img_res.headers.get("X-Bucket-Provider") == "rustfs"
    assert img_res.data.startswith(b"\x89PNG")

    # Test publishing turn1 to the Public Community Gallery (/api/gallery/public)
    pub_res = client.post(
        f"/api/turns/{turn1['id']}/publish",
        json={"is_published": True},
    )
    assert pub_res.status_code == 200
    assert pub_res.get_json()["is_published"] is True

    public_gallery_res = client.get("/api/gallery/public")
    assert public_gallery_res.status_code == 200
    public_gallery = public_gallery_res.get_json()
    assert public_gallery["total"] >= 6
    assert any(item["turn_id"] == turn1["id"] for item in public_gallery["items"])


def test_zero_storage_rejects_x_goog_api_key_header() -> None:
    fake_secret = "AIzaSyFakeKeyThatMustNeverBeStoredOrEchoed999"
    response = client.post(
        "/api/interactive/analyze",
        headers={"x-goog-api-key": fake_secret},
        json={"idea": "Retrato anime"},
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body["key_storage"] == "never_stored"
    assert body["error_code"] == "API_KEY_REJECTED_ZERO_STORAGE"
    assert fake_secret not in response.get_data(as_text=True)


def test_zero_storage_rejects_api_key_in_json_body() -> None:
    fake_secret = "my-super-secret-user-key-12345"
    response = client.post(
        "/api/interactive/refine",
        json={
            "current_prompt": "Retrato anime",
            "instruction": "Mais dramático",
            "api_key": fake_secret,
        },
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body["key_storage"] == "never_stored"
    assert fake_secret not in response.get_data(as_text=True)


def test_zero_storage_rejects_raw_gemini_key_in_prompt_or_query() -> None:
    raw_gemini_key = "AIzaSyD9876543210abcdefGHIJKLMN"
    res_query = client.get(f"/api/bootstrap?api_key={raw_gemini_key}")
    assert res_query.status_code == 400
    assert raw_gemini_key not in res_query.get_data(as_text=True)

    res_body = client.post(
        "/api/interactive/analyze",
        json={"idea": f"Use key {raw_gemini_key} to generate"},
    )
    assert res_body.status_code == 400
    assert raw_gemini_key not in res_body.get_data(as_text=True)
