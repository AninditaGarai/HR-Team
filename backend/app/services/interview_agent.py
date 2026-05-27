from __future__ import annotations

from random import choice
from typing import List

TEMPLATES = {
    "python": [
        "Explain how you would profile a slow Python application.",
        "Describe the Global Interpreter Lock (GIL) and its implications for multithreaded programs.",
        "How would you manage dependencies and environments across multiple services?",
    ],
    "ml": [
        "Walk me through an ML project you've built from data ingestion to deployment.",
        "How do you validate a model's performance and prevent data leakage?",
        "Describe a time you improved model generalization — what techniques did you try?",
    ],
    "sql": [
        "Explain how you would optimize a slow SQL query on a large table.",
        "How do you design indexes for reporting workloads?",
    ],
    "default": [
        "Tell me about a project you're proud of and the specific technical choices you made.",
        "Describe a difficult bug you diagnosed — how did you approach it?",
    ],
}


def normalize_keyword(k: str) -> str:
    return "".join(ch for ch in k.lower() if ch.isalnum())


def pick_theme_from_keywords(keywords: List[str]) -> str:
    for kw in (normalize_keyword(k) for k in keywords):
        if "python" in kw or "django" in kw or "flask" in kw:
            return "python"
        if "machine" in kw or "ml" in kw or "learning" in kw:
            return "ml"
        if "sql" in kw or "query" in kw or "database" in kw:
            return "sql"
    return "default"


def generate_interview(category: str | None = None, keywords: List[str] | None = None) -> dict:
    keywords = keywords or []
    theme = (category or "").lower() or pick_theme_from_keywords(keywords)
    if theme not in TEMPLATES:
        theme = pick_theme_from_keywords(keywords)

    question = choice(TEMPLATES.get(theme, TEMPLATES["default"]))

    follow_ups: List[str] = []
    if keywords:
        follow_ups.append(
            f"You mentioned {', '.join(keywords[:3])}. Can you explain your contributions related to these?"
        )

    if theme == "python":
        follow_ups.append("How would you improve performance in a CPU-bound Python workload?")
    if theme == "ml":
        follow_ups.append("Which evaluation metrics would you choose for this problem and why?")
    if theme == "sql":
        follow_ups.append("How would you approach schema changes for a table with millions of rows?")

    if not follow_ups:
        follow_ups.append("Can you expand on that?")

    return {"question": question, "followUps": follow_ups}
