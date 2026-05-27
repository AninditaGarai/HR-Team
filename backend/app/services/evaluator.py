from __future__ import annotations

from collections import Counter
import os
import re
from typing import List


def tokenize(text: str) -> List[str]:
    return [t for t in re.findall(r"[a-zA-Z0-9+#.]{3,}", text.lower())]


def keyword_overlap_score(answer_tokens: List[str], keywords: List[str]) -> int:
    kwset = set(k.lower() for k in keywords)
    hits = sum(1 for t in answer_tokens if t in kwset)
    return hits


def evaluate_answer(answer: str, question: str, keywords: List[str]) -> dict:
    tokens = tokenize(answer)
    length = len(tokens)
    hits = keyword_overlap_score(tokens, keywords)

    # heuristic scoring
    score = 30
    score += min(40, hits * 10)  # each keyword hit up to +40
    score += min(30, length // 5)  # verbosity up to +30
    score = max(0, min(100, score))

    strengths = []
    weaknesses = []

    if hits > 0:
        strengths.append(f"References relevant keywords: {', '.join(set(k for k in keywords if k.lower() in tokens))}")
    else:
        weaknesses.append("Does not reference expected keywords or technical terms.")

    if length < 10:
        weaknesses.append("Answer is brief; provide more detail or examples.")

    # dynamic follow-ups: ask about missing keywords or deeper aspects
    follow_ups = []
    missing = [k for k in keywords if k.lower() not in tokens]
    if missing:
        follow_ups.append(f"You did not mention {', '.join(missing[:3])}. Can you explain your experience with them?")

    # add probing questions based on common patterns
    if "python" in question.lower() or any("python" in k.lower() for k in keywords):
        follow_ups.append("Can you explain the trade-offs of multithreading vs multiprocessing in Python for this use case?")
    if "model" in question.lower() or any(k.lower() in ("ml", "model", "training") for k in keywords):
        follow_ups.append("How did you validate your model and prevent data leakage?")

    # If OPENAI_API_KEY present, attempt an LLM-based critique
    if os.environ.get("OPENAI_API_KEY"):
        try:
            import requests
            api_key = os.environ.get("OPENAI_API_KEY")
            # create a concise prompt
            prompt = (
                "You are an unbiased technical interviewer. Evaluate the following candidate answer for correctness, "
                "depth, and clarity. Provide a score 0-100, 1-2 strengths, 1-2 weaknesses, and two follow-up questions.\n\n"
                f"Question: {question}\n\n"
                f"Answer: {answer}\n\n"
                f"Keywords: {', '.join(keywords)}\n\n"
                "Return JSON with keys: score, strengths, weaknesses, follow_ups."
            )
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            # try to parse JSON from text
            import json

            parsed = json.loads(text)
            return parsed
        except Exception:
            # fallback to heuristic
            pass

    return {
        "score": int(score),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "follow_ups": follow_ups or ["Can you expand on that?"]
    }
