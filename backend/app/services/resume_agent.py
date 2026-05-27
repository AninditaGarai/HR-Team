from __future__ import annotations

from dataclasses import dataclass

from .resume_extraction import ResumeExtraction, extract_resume_profile
from .resume_model import predict_resume


@dataclass(slots=True)
class ResumeAnalysis:
    category: str
    score: int
    confidence: int
    matched_keywords: list[str]
    summary: str
    extraction: ResumeExtraction
    source_text: str


def analyze_resume(text: str) -> ResumeAnalysis:
    result = predict_resume(text)
    extraction = extract_resume_profile(text)
    return ResumeAnalysis(
        category=result.category,
        score=result.score,
        confidence=result.confidence,
        matched_keywords=result.matched_keywords,
        summary=result.summary,
        extraction=extraction,
        source_text=extraction.source_text,
    )
