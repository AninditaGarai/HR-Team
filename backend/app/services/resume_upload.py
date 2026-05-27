from __future__ import annotations

from pathlib import Path


def _read_docx(path: Path) -> str:
    from docx import Document

    document = Document(str(path))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    return "\n".join(paragraphs)


def _read_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
                extracted = page.extract_text() or ""
                if extracted.strip():
                        parts.append(extracted.strip())
    return "\n".join(parts)


def extract_resume_text_from_bytes(filename: str, file_bytes: bytes) -> str:
    suffix = Path(filename or "").suffix.lower()

    if suffix in {".txt", ".md", ".csv"}:
        return file_bytes.decode("utf-8", errors="ignore").strip()

    temp_path = Path.cwd() / f"._upload_{Path(filename or 'resume').stem}{suffix or '.bin'}"
    temp_path.write_bytes(file_bytes)
    try:
        if suffix == ".pdf":
            return _read_pdf(temp_path).strip()
        if suffix == ".docx":
            return _read_docx(temp_path).strip()
        return file_bytes.decode("utf-8", errors="ignore").strip()
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass