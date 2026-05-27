from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from .dataset import load_rows, tokenize


@dataclass(slots=True)
class ResumePrediction:
    category: str
    score: int
    confidence: int
    matched_keywords: list[str]
    summary: str


@dataclass(slots=True)
class ResumeClassifier:
    pipeline: Pipeline
    training_rows: int
    categories: list[str]


def _load_training_corpus() -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []

    for row in load_rows():
        category = (row.get("Category") or "").strip()
        resume_text = (row.get("Resume_str") or "").strip()
        if not category or not resume_text:
            continue

        texts.append(resume_text)
        labels.append(category)

    if not texts:
        raise RuntimeError("Resume training dataset is empty.")

    return texts, labels


@lru_cache(maxsize=1)
def get_resume_classifier() -> ResumeClassifier:
    texts, labels = _load_training_corpus()

    vectorizer = TfidfVectorizer(
        tokenizer=tokenize,
        preprocessor=None,
        lowercase=False,
        token_pattern=None,
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        max_features=30000,
        sublinear_tf=True,
    )
    classifier = LogisticRegression(
        max_iter=1200,
        class_weight="balanced",
    )

    pipeline = Pipeline([
        ("vectorizer", vectorizer),
        ("classifier", classifier),
    ])
    pipeline.fit(texts, labels)

    return ResumeClassifier(
        pipeline=pipeline,
        training_rows=len(texts),
        categories=list(pipeline.named_steps["classifier"].classes_),
    )


def _dedupe_terms(terms: Iterable[str], limit: int) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []

    for term in terms:
        cleaned = term.strip().strip(".,;:!?()")
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        deduped.append(cleaned)
        if len(deduped) >= limit:
            break

    return deduped


def predict_resume(text: str) -> ResumePrediction:
    classifier = get_resume_classifier()
    pipeline = classifier.pipeline

    probability_row = pipeline.predict_proba([text])[0]
    best_index = int(probability_row.argmax())
    best_category = str(pipeline.classes_[best_index])
    best_probability = float(probability_row[best_index])
    runner_up_probability = float(sorted(probability_row, reverse=True)[1]) if len(probability_row) > 1 else 0.0

    vectorizer: TfidfVectorizer = pipeline.named_steps["vectorizer"]
    model: LogisticRegression = pipeline.named_steps["classifier"]

    text_vector = vectorizer.transform([text]).tocsr()
    feature_names = vectorizer.get_feature_names_out()
    class_index = list(model.classes_).index(best_category)
    coefficients = model.coef_[class_index]

    signal_scores: list[tuple[float, str]] = []
    for feature_index, tfidf_value in zip(text_vector.indices, text_vector.data):
        feature_name = feature_names[feature_index]
        if " " in feature_name:
            continue

        contribution = max(coefficients[feature_index], 0.0) * tfidf_value
        if contribution > 0:
            signal_scores.append((contribution, feature_name))

    if not signal_scores:
        signal_scores = [(float(value), feature_names[index]) for index, value in zip(text_vector.indices, text_vector.data)]

    signal_scores.sort(key=lambda item: item[0], reverse=True)
    matched_keywords = _dedupe_terms((term for _, term in signal_scores), limit=8)

    score = int(round(min(100.0, best_probability * 100.0)))
    confidence = int(round(min(99.0, max(1.0, (best_probability - runner_up_probability + 1.0) * 50.0))))

    if matched_keywords:
        summary = (
            f"Trained on {classifier.training_rows} resumes, the model predicts {best_category} as the best match "
            f"based on signals like {', '.join(matched_keywords[:6])}."
        )
    else:
        summary = (
            f"Trained on {classifier.training_rows} resumes, the model predicts {best_category} as the best match, "
            "but the resume text does not expose many strong keyword signals."
        )

    return ResumePrediction(
        category=best_category,
        score=score,
        confidence=confidence,
        matched_keywords=matched_keywords,
        summary=summary,
    )