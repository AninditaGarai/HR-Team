from __future__ import annotations

from pydantic import BaseModel, Field


class ResumeAnalysisRequest(BaseModel):
    text: str = Field(min_length=1, description="Resume text to analyze")


class ResumeAnalysisResponse(BaseModel):
    category: str
    score: int
    confidence: int
    matched_keywords: list[str]
    summary: str


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
