from __future__ import annotations

from pydantic import BaseModel, Field


class ResumeAnalysisRequest(BaseModel):
    text: str = Field(min_length=1, description="Resume text to analyze")


class ResumeExtraction(BaseModel):
    name: str | None
    emails: list[str]
    phone_numbers: list[str]
    years_of_experience: str | None
    skills: list[str]
    education: list[str]
    job_titles: list[str]
    source_text: str


class ResumeAnalysisResponse(BaseModel):
    category: str
    score: int
    confidence: int
    matched_keywords: list[str]
    summary: str
    extraction: ResumeExtraction
    source_text: str


class CategoryStat(BaseModel):
    name: str
    count: int


class KeywordProfile(BaseModel):
    category: str
    keywords: list[str]


class DatasetSummary(BaseModel):
    row_count: int
    category_breakdown: list[CategoryStat]
    top_keywords: list[KeywordProfile]
