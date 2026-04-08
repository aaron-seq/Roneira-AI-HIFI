"""
Helpers for locating and storing trained model artifacts.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def get_artifact_dir() -> Path:
    configured = os.getenv("ML_MODEL_DIR")
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else Path(__file__).resolve().parents[2] / path

    return Path(__file__).resolve().parents[2] / "artifacts" / "generated"


def ensure_artifact_dir() -> Path:
    path = get_artifact_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def artifact_path(filename: str) -> Path:
    return get_artifact_dir() / filename


def save_metadata(filename: str, payload: dict[str, Any]) -> Path:
    path = ensure_artifact_dir() / filename
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def load_metadata(filename: str) -> dict[str, Any]:
    path = artifact_path(filename)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))
