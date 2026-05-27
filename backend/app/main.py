from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from .schemas import DatasetSummary, ResumeAnalysisRequest, ResumeAnalysisResponse
from .services.dataset import category_counts, load_rows, top_keywords
from .services.resume_agent import analyze_resume
from .services.interview_agent import generate_interview
from .services.whisper_integration import transcribe_audio_upload
from .services.evaluator import evaluate_answer
from .services.resume_upload import extract_resume_text_from_bytes
from .services.db import init_db, create_session, add_interaction, get_session
from .services.db import delete_session, export_sessions, list_sessions

app = FastAPI(title="AI HR Team API", version="0.1.0")


@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception:
        pass


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/dataset/summary", response_model=DatasetSummary)
def dataset_summary() -> DatasetSummary:
    rows = load_rows()
    counts = category_counts()

    return DatasetSummary(
        row_count=len(rows),
        category_breakdown=[
            {"name": name, "count": count} for name, count in counts.most_common()
        ],
        top_keywords=[
            {"category": category, "keywords": keywords}
            for category, keywords in top_keywords()
        ],
    )


@app.post("/resume/analyze", response_model=ResumeAnalysisResponse)
def resume_analyze(payload: ResumeAnalysisRequest) -> ResumeAnalysisResponse:
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Resume text is required.")

    result = analyze_resume(payload.text)
    return ResumeAnalysisResponse(
        category=result.category,
        score=result.score,
        confidence=result.confidence,
        matched_keywords=result.matched_keywords,
        summary=result.summary,
    )


@app.post("/resume/upload/analyze", response_model=ResumeAnalysisResponse)
async def resume_upload_analyze(file: UploadFile = File(...)) -> ResumeAnalysisResponse:
    file_bytes = await file.read()
    text = extract_resume_text_from_bytes(file.filename or "resume", file_bytes)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded resume.")

    result = analyze_resume(text)
    return ResumeAnalysisResponse(
        category=result.category,
        score=result.score,
        confidence=result.confidence,
        matched_keywords=result.matched_keywords,
        summary=result.summary,
    )


@app.post("/interview/generate")
def interview_generate(payload: dict | None = None) -> dict:
    payload = payload or {}
    category = payload.get("category")
    keywords = payload.get("keywords") or []
    # create a session for this generation (resume text optional)
    session_id = create_session(resume_text=payload.get("resume_text"), category=category)
    result = generate_interview(category=category, keywords=keywords)
    # persist the generated question as an interaction without answer
    add_interaction(session_id=session_id, question=result.get("question"), answer=None, evaluation=None)
    result["session_id"] = session_id
    return result


@app.post("/interview/voice_transcribe")
async def interview_voice_transcribe(file: UploadFile = File(...)):
    try:
        text = transcribe_audio_upload(file)
        return {"text": text}
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/interview/evaluate")
def interview_evaluate(payload: dict) -> dict:
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    keywords = payload.get("keywords", [])
    if not question or not answer:
        raise HTTPException(status_code=400, detail="question and answer are required")
    return evaluate_answer(answer=answer, question=question, keywords=keywords)


@app.post("/interview/session/{session_id}/answer")
def session_add_answer(session_id: int, payload: dict) -> dict:
    question = payload.get("question", "")
    answer = payload.get("answer", "")
    evaluation = payload.get("evaluation")
    if not question or not answer:
        raise HTTPException(status_code=400, detail="question and answer are required")
    iid = add_interaction(session_id=session_id, question=question, answer=answer, evaluation=evaluation)
    return {"interaction_id": iid}


@app.get("/interview/session/{session_id}")
def session_get(session_id: int) -> dict:
    try:
        return get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")


@app.get("/interview/sessions")
def sessions_list(limit: int = 50, evaluated_only: bool = False) -> dict:
    rows = list_sessions(limit=limit, evaluated_only=evaluated_only)
    return {"sessions": rows}


@app.delete("/interview/session/{session_id}")
def session_delete(session_id: int) -> dict:
    deleted = delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="session not found")
    return {"deleted": True, "session_id": session_id}


@app.get("/interview/sessions/export")
def sessions_export(
    format: str = Query("json", pattern="^(json|csv)$"),
    evaluated_only: bool = False,
    limit: int = 200,
):
    records = export_sessions(limit=limit, evaluated_only=evaluated_only)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(
            buffer,
            fieldnames=[
                "session_id",
                "session_created_at",
                "session_category",
                "interaction_id",
                "interaction_created_at",
                "question",
                "answer",
                "evaluation_score",
                "evaluation_strengths",
                "evaluation_weaknesses",
                "evaluation_follow_ups",
            ],
        )
        writer.writeheader()
        for record in records:
            session = record["session"]
            interactions = record.get("interactions", [])
            if not interactions:
                writer.writerow(
                    {
                        "session_id": session["id"],
                        "session_created_at": session.get("created_at"),
                        "session_category": session.get("category"),
                        "interaction_id": "",
                        "interaction_created_at": "",
                        "question": "",
                        "answer": "",
                        "evaluation_score": "",
                        "evaluation_strengths": "",
                        "evaluation_weaknesses": "",
                        "evaluation_follow_ups": "",
                    }
                )
                continue

            for interaction in interactions:
                evaluation = interaction.get("evaluation") or {}
                writer.writerow(
                    {
                        "session_id": session["id"],
                        "session_created_at": session.get("created_at"),
                        "session_category": session.get("category"),
                        "interaction_id": interaction.get("id"),
                        "interaction_created_at": interaction.get("created_at"),
                        "question": interaction.get("question"),
                        "answer": interaction.get("answer"),
                        "evaluation_score": evaluation.get("score", ""),
                        "evaluation_strengths": " | ".join(evaluation.get("strengths", []) or []),
                        "evaluation_weaknesses": " | ".join(evaluation.get("weaknesses", []) or []),
                        "evaluation_follow_ups": " | ".join(evaluation.get("follow_ups", []) or []),
                    }
                )

        response = StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = f'attachment; filename="session_history_{stamp}.csv"'
        return response

    payload = {
        "exported_at": stamp,
        "format": format,
        "evaluated_only": evaluated_only,
        "sessions": records,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    response = StreamingResponse(iter([body]), media_type="application/json")
    response.headers["Content-Disposition"] = f'attachment; filename="session_history_{stamp}.json"'
    return response
