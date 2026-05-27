from __future__ import annotations

from dataclasses import dataclass
import re


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})"
)
EXPERIENCE_RE = re.compile(r"\b\d{1,2}(?:\.\d+)?\+?\s*(?:years?|yrs?)\b", re.IGNORECASE)

SKILL_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    ("python", ("python",)),
    ("sql", ("sql",)),
    ("postgresql", ("postgresql", "postgres")),
    ("mysql", ("mysql",)),
    ("mongodb", ("mongodb",)),
    ("fastapi", ("fastapi",)),
    ("django", ("django",)),
    ("flask", ("flask",)),
    ("machine learning", ("machine learning", "ml")),
    ("deep learning", ("deep learning",)),
    ("data analysis", ("data analysis",)),
    ("data visualization", ("data visualization", "tableau", "power bi")),
    ("pandas", ("pandas",)),
    ("numpy", ("numpy",)),
    ("scikit-learn", ("scikit-learn", "sklearn")),
    ("nlp", ("nlp", "natural language processing")),
    ("aws", ("aws", "amazon web services")),
    ("azure", ("azure",)),
    ("gcp", ("gcp", "google cloud")),
    ("docker", ("docker",)),
    ("kubernetes", ("kubernetes",)),
    ("git", ("git", "github", "gitlab")),
    ("javascript", ("javascript", "js")),
    ("typescript", ("typescript", "ts")),
    ("react", ("react",)),
    ("next.js", ("next.js", "nextjs")),
    ("node.js", ("node.js", "nodejs", "node")),
    ("communication", ("communication",)),
    ("leadership", ("leadership",)),
    ("project management", ("project management",)),
]

DEGREE_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    ("bachelor's degree", ("bachelor", "b.sc", "b.tech", "be ", "b.e ", "bca", "bba")),
    ("master's degree", ("master", "m.sc", "m.tech", "mba", "mca", "m.e ")),
    ("phd", ("phd", "doctorate")),
    ("associate degree", ("associate",)),
]

TITLE_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    ("python engineer", ("python engineer", "senior python engineer")),
    ("data engineer", ("data engineer",)),
    ("software engineer", ("software engineer", "software developer", "backend developer", "frontend developer")),
    ("data analyst", ("data analyst", "business analyst", "bi analyst")),
    ("data scientist", ("data scientist", "machine learning engineer", "ml engineer")),
    ("devops engineer", ("devops engineer", "site reliability engineer", "sre")),
    ("product manager", ("product manager", "product owner")),
    ("project manager", ("project manager", "program manager")),
    ("hr specialist", ("hr specialist", "hr manager", "recruiter")),
    ("sales executive", ("sales executive", "business development", "account manager")),
]


@dataclass(slots=True)
class ResumeExtraction:
    emails: list[str]
    phone_numbers: list[str]
    years_of_experience: str | None
    skills: list[str]
    education: list[str]
    job_titles: list[str]
    source_text: str


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _find_aliases(text: str, aliases: list[tuple[str, tuple[str, ...]]]) -> list[str]:
    normalized = _normalize_text(text)
    matches: list[str] = []

    for label, patterns in aliases:
        for pattern in patterns:
            if pattern in normalized:
                matches.append(label)
                break

    return matches


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for item in items:
        cleaned = item.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        ordered.append(cleaned)

    return ordered


def _extract_experience(text: str) -> str | None:
    matches = EXPERIENCE_RE.findall(text)
    if matches:
        return matches[0]

    fallback = re.search(r"\bexperience\b.{0,40}?\b(\d{1,2}(?:\.\d+)?\+?)\s*(?:years?|yrs?)", text, re.IGNORECASE)
    if fallback:
        return f"{fallback.group(1)} years"

    return None


def extract_resume_profile(text: str) -> ResumeExtraction:
    emails = _unique(EMAIL_RE.findall(text))
    phone_numbers = _unique(PHONE_RE.findall(text))
    skills = _unique(_find_aliases(text, SKILL_ALIASES))
    education = _unique(_find_aliases(text, DEGREE_ALIASES))
    job_titles = _unique(_find_aliases(text, TITLE_ALIASES))
    years_of_experience = _extract_experience(text)

    return ResumeExtraction(
        emails=emails,
        phone_numbers=phone_numbers,
        years_of_experience=years_of_experience,
        skills=skills,
        education=education,
        job_titles=job_titles,
        source_text=text.strip(),
    )