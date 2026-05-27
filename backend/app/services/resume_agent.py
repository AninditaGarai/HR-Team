from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict

from .dataset import category_profiles, tokenize


@dataclass(slots=True)
class ResumeAnalysis:
    category: str
    score: int
    confidence: int
    matched_keywords: list[str]
    summary: str


def _build_idf(profiles: Dict[str, Dict[str, int]]) -> Dict[str, float]:
    # IDF across categories (documents)
    df: Dict[str, int] = {}
    total_docs = len(profiles) if profiles else 1
    for profile in profiles.values():
        for term in profile.keys():
            df[term] = df.get(term, 0) + 1

    idf: Dict[str, float] = {}
    for term, dfcount in df.items():
        idf[term] = math.log((total_docs + 1) / (dfcount + 1)) + 1.0
    return idf


def _vectorize_profile(profile: Dict[str, int], idf: Dict[str, float]) -> Dict[str, float]:
    vec: Dict[str, float] = {}
    for term, freq in profile.items():
        vec[term] = freq * idf.get(term, 1.0)
    return vec


def _cosine_sim(a: Dict[str, float], b: Dict[str, float]) -> float:
    # compute dot and norms
    dot = 0.0
    for k, v in a.items():
        if k in b:
            dot += v * b[k]
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def analyze_resume(text: str) -> ResumeAnalysis:
    profiles = category_profiles()
    idf = _build_idf(profiles)

    # TF for input
    tokens = tokenize(text)
    tf: Dict[str, int] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1

    # input tf-idf vector
    input_vec: Dict[str, float] = {t: freq * idf.get(t, 1.0) for t, freq in tf.items()}

    best_category = "General"
    best_score = 0.0
    best_keywords: list[str] = []

    for category, profile in profiles.items():
        cat_vec = _vectorize_profile(profile, idf)
        sim = _cosine_sim(input_vec, cat_vec)
        if sim > best_score:
            best_score = sim
            # matched keywords: intersection of tokens with top profile terms
            matched = [t for t in tokens if t in profile]
            best_keywords = matched
            best_category = category

    # normalize similarity into 0-100
    score = int(min(100, max(0, best_score * 200)))
    confidence = int(min(99, 40 + best_score * 100))

    if best_keywords:
        summary = f"Strong overlap with {best_category} profiles based on {', '.join(best_keywords[:6])}."
    else:
        summary = "No strong category overlap found. The resume looks more general-purpose than the dataset patterns."

    return ResumeAnalysis(category=best_category, score=score, confidence=confidence, matched_keywords=best_keywords[:8], summary=summary)
