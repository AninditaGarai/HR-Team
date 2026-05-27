from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
import joblib

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

    # train vectorizer on texts and then calibrate the classifier
    X = vectorizer.fit_transform(texts)

    # fit base classifier
    classifier.fit(X, labels)

    # calibrate probabilities using cross-validation
    try:
        calibrated = CalibratedClassifierCV(classifier, cv=3)
        calibrated.fit(X, labels)
        trained_classifier = calibrated
    except Exception:
        # fallback: use uncalibrated classifier if calibration fails
        trained_classifier = classifier

    pipeline = Pipeline([
        ("vectorizer", vectorizer),
        ("classifier", trained_classifier),
    ])

    # persist the trained pipeline for faster startup
    models_dir = Path(__file__).resolve().parents[2] / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / "resume_classifier.joblib"
    try:
        joblib.dump({"pipeline": pipeline, "training_rows": len(texts), "categories": list(trained_classifier.classes_)}, model_path)
    except Exception:
        # if saving fails, continue without failing startup
        pass

    return ResumeClassifier(
        pipeline=pipeline,
        training_rows=len(texts),
        categories=list(trained_classifier.classes_),
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
    # attempt to extract positive feature contributions from the underlying model
    signal_scores: list[tuple[float, str]] = []
    try:
        # calibrated classifiers may not expose `coef_` directly; try to get the base estimator
        base_model = None
        if hasattr(model, "base_estimator_") and getattr(model, "base_estimator_") is not None:
            base_model = model.base_estimator_
        elif hasattr(model, "base_estimator") and getattr(model, "base_estimator") is not None:
            base_model = model.base_estimator
        elif hasattr(model, "estimators_") and getattr(model, "estimators_"):
            # take first underlying estimator
            base_model = model.estimators_[0]
        else:
            base_model = model

        class_index = list(model.classes_).index(best_category)
        coefficients = getattr(base_model, "coef_", None)

        if coefficients is not None:
            if coefficients.ndim > 1:
                class_coef = coefficients[class_index]
            else:
                class_coef = coefficients

            for feature_index, tfidf_value in zip(text_vector.indices, text_vector.data):
                feature_name = feature_names[feature_index]
                if " " in feature_name:
                    continue

                contribution = max(class_coef[feature_index], 0.0) * tfidf_value
                if contribution > 0:
                    signal_scores.append((contribution, feature_name))
        else:
            # fallback: use raw tfidf values as signal when coefficients are not available
            signal_scores = [(float(value), feature_names[index]) for index, value in zip(text_vector.indices, text_vector.data)]
    except Exception:
        signal_scores = [(float(value), feature_names[index]) for index, value in zip(text_vector.indices, text_vector.data)]

    signal_scores.sort(key=lambda item: item[0], reverse=True)
    matched_keywords = _dedupe_terms((term for _, term in signal_scores), limit=8)

    # Base score from model probability (0-100)
    prob_score = best_probability * 100.0

    # Keyword signal: more matched keywords -> higher heuristic boost (up to 100)
    keyword_score = min(1.0, len(matched_keywords) / 5.0) * 100.0

    # Blend model probability with keyword signal to give short resumes more reasonable scores.
    # Weights chosen conservatively: 65% model probability, 35% keyword signal.
    score = int(round(min(100.0, 0.65 * prob_score + 0.35 * keyword_score)))

    # Keep existing confidence metric based on margin vs runner-up.
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