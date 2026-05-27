from __future__ import annotations

from collections import Counter, defaultdict
from csv import DictReader
from functools import lru_cache
from pathlib import Path
from typing import Iterable

DATASET_FILENAME = Path("archive (3)") / "Resume" / "Resume.csv"
STOPWORDS = {
    "a",
    "about",
    "after",
    "all",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "him",
    "his",
    "i",
    "in",
    "into",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "our",
    "she",
    "that",
    "the",
    "their",
    "them",
    "there",
    "they",
    "this",
    "to",
    "was",
    "we",
    "were",
    "with",
    "you",
    "your",
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def dataset_path() -> Path:
    return project_root() / DATASET_FILENAME


def tokenize(text: str) -> list[str]:
    cleaned = []
    current = []

    for character in text.lower():
      if character.isalnum() or character in {"+", "#", "."}:
            current.append(character)
      else:
            if current:
                token = "".join(current)
                if len(token) > 2 and token not in STOPWORDS:
                    cleaned.append(token)
                current = []

    if current:
        token = "".join(current)
        if len(token) > 2 and token not in STOPWORDS:
            cleaned.append(token)

    return cleaned


@lru_cache(maxsize=1)
def load_rows() -> list[dict[str, str]]:
    path = dataset_path()
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = DictReader(handle)
        return [row for row in reader]


@lru_cache(maxsize=1)
def category_counts() -> Counter[str]:
    counts: Counter[str] = Counter()
    for row in load_rows():
        category = (row.get("Category") or "").strip()
        if category:
            counts[category] += 1
    return counts


@lru_cache(maxsize=1)
def category_profiles() -> dict[str, Counter[str]]:
    profiles: dict[str, Counter[str]] = defaultdict(Counter)
    for row in load_rows():
        category = (row.get("Category") or "").strip()
        resume_text = (row.get("Resume_str") or "").strip()
        if not category or not resume_text:
            continue
        profiles[category].update(tokenize(resume_text))
    return dict(profiles)


@lru_cache(maxsize=1)
def top_keywords(limit: int = 6) -> list[tuple[str, list[str]]]:
    profiles = category_profiles()
    ranked: list[tuple[str, list[str]]] = []
    for category, profile in profiles.items():
        ranked.append(
            (
                category,
                [keyword for keyword, _ in profile.most_common(limit)],
            )
        )
    return sorted(ranked, key=lambda item: item[0].lower())


def all_categories() -> Iterable[str]:
    return category_counts().keys()
