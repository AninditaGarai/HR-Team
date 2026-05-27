# AI HR Team Backend

FastAPI service for the first MVP slice of the autonomous HR workflow.

## Endpoints

- `GET /health`
- `GET /dataset/summary`
- `POST /resume/analyze`

## Dataset

This backend reads the uploaded resume dataset from:

`archive (3)/Resume/Resume.csv`

## Run

```bash
uvicorn app.main:app --reload --app-dir backend
```
