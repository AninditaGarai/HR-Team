# AI HR Team

A starter implementation of the autonomous HR workflow project.

## What is in place

- `frontend/`: Next.js dashboard for dataset insights and resume analysis
- `backend/`: FastAPI service for the same dataset-backed analysis flow
- `archive (3)/Resume/Resume.csv`: uploaded resume dataset used by both layers

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

## Run the backend

```bash
cd backend
uvicorn app.main:app --reload
```

## Current MVP behavior

- Reads the uploaded resume dataset
- Shows category counts and keyword profiles in the dashboard
- Scores pasted resume text against dataset patterns
- Exposes matching backend endpoints for dataset summary and resume analysis

## Next steps

- Replace the heuristic analyzer with a trained model
- Add interview, verification, and decision agents
- Persist candidate results in a database
- Add recruiter analytics and report export