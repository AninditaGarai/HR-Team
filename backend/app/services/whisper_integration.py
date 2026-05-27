from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Optional

import requests


OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions"


def transcribe_with_openai(file_path: Path, model: str = "whisper-1") -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    with open(file_path, "rb") as fh:
        files = {"file": (file_path.name, fh)}
        data = {"model": model}
        headers = {"Authorization": f"Bearer {api_key}"}
        resp = requests.post(OPENAI_TRANSCRIPTION_URL, headers=headers, files=files, data=data, timeout=60)
        resp.raise_for_status()
        payload = resp.json()
        return payload.get("text", "")


def transcribe_audio_upload(uploaded_file) -> str:
    # `uploaded_file` is a Starlette UploadFile-like object
    suffix = Path(uploaded_file.filename or "").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = Path(tmp.name)
        content = uploaded_file.file.read()
        tmp.write(content)
        tmp.flush()

    try:
        # prefer OpenAI API if key is present
        if os.environ.get("OPENAI_API_KEY"):
            return transcribe_with_openai(tmp_path)
        # if no API key, raise informative error
        raise RuntimeError("No transcription backend available. Set OPENAI_API_KEY to use OpenAI Whisper API.")
    finally:
        try:
            tmp_path.unlink()
        except Exception:
            pass
