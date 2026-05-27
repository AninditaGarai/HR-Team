'use client';

import { useEffect, useMemo, useState } from "react";

type DatasetStats = {
  rowCount: number;
  categoryBreakdown: Array<{ name: string; count: number }>;
  topKeywords: Array<{ category: string; keywords: string[] }>;
};

type ResumeAnalysis = {
  category: string;
  score: number;
  confidence: number;
  matchedKeywords: string[];
  summary: string;
  sourceText?: string;
  extraction?: {
    name: string | null;
    emails: string[];
    phone_numbers: string[];
    years_of_experience: string | null;
    skills: string[];
    education: string[];
    job_titles: string[];
    source_text: string;
  };
};

type InterviewSession = {
  id: number;
  resume_text: string | null;
  category: string | null;
  created_at: string;
  has_evaluated_answer?: boolean;
};

type SessionDetail = {
  session: InterviewSession;
  interactions: Array<{
    id: number;
    session_id: number;
    question: string;
    answer: string | null;
    evaluation?: {
      score?: number;
      strengths?: string[];
      weaknesses?: string[];
      follow_ups?: string[];
      [key: string]: unknown;
    };
    created_at: string;
  }>;
};

const SAMPLE_RESUME = `Senior Python engineer with machine learning, SQL, and product analytics experience. Built recruitment dashboards, automated report generation, and classification workflows for large text datasets.`;

const QUICK_HIGHLIGHTS = [
  {
    label: "Resume screening",
    value: "CSV-backed",
    detail: "Uses the uploaded dataset as the first training signal.",
  },
  {
    label: "Candidate ranking",
    value: "Scorecards",
    detail: "Produces category, confidence, and matched keywords.",
  },
  {
    label: "Recruiter view",
    value: "Dashboard",
    detail: "Shows dataset distribution and analysis results together.",
  },
];

const normalizeResumeAnalysis = (payload: Record<string, unknown> | null | undefined): ResumeAnalysis => {
  const safePayload = payload ?? {};
  const extraction = (safePayload.extraction as Record<string, unknown> | undefined) ?? undefined;

  return {
    category: String(safePayload.category ?? ""),
    score: Number(safePayload.score ?? 0),
    confidence: Number(safePayload.confidence ?? 0),
    matchedKeywords: (safePayload.matchedKeywords as string[] | undefined) ?? (safePayload.matched_keywords as string[] | undefined) ?? [],
    summary: String(safePayload.summary ?? ""),
    sourceText: String(safePayload.sourceText ?? safePayload.source_text ?? ""),
    extraction: extraction
      ? {
          name: (extraction.name as string | null | undefined) ?? null,
          emails: (extraction.emails as string[] | undefined) ?? [],
          phone_numbers: (extraction.phone_numbers as string[] | undefined) ?? [],
          years_of_experience: (extraction.years_of_experience as string | null | undefined) ?? null,
          skills: (extraction.skills as string[] | undefined) ?? [],
          education: (extraction.education as string[] | undefined) ?? [],
          job_titles: (extraction.job_titles as string[] | undefined) ?? [],
          source_text: String(extraction.source_text ?? ""),
        }
      : undefined,
  };
};

export default function Home() {
  const [dataset, setDataset] = useState<DatasetStats | null>(null);
  const [resumeText, setResumeText] = useState(SAMPLE_RESUME);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEvaluatedOnly, setShowEvaluatedOnly] = useState(false);

  useEffect(() => {
    const loadDataset = async () => {
      try {
        const response = await fetch("/api/dataset");
        if (!response.ok) {
          throw new Error("Unable to load dataset summary.");
        }
        const payload = (await response.json()) as DatasetStats;
        setDataset(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unexpected error.");
      } finally {
        setLoadingDataset(false);
      }
    };

    loadDataset();
  }, []);

  const loadSessions = async (evaluatedOnly = showEvaluatedOnly) => {
    setLoadingSessions(true);
    try {
      const params = new URLSearchParams();
      if (evaluatedOnly) {
        params.set("evaluated_only", "true");
      }
      const response = await fetch(`/api/interview/sessions${params.toString() ? `?${params.toString()}` : ""}`);
      const payload = (await response.json()) as { sessions?: InterviewSession[] };
      setSessions(payload.sessions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error.");
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/interview/session/${sessionId}`);
      const payload = (await response.json()) as SessionDetail;
      setActiveSession(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unexpected error.");
    }
  };

  useEffect(() => {
    loadSessions();
  }, [showEvaluatedOnly]);

  const topCategories = useMemo(() => dataset?.categoryBreakdown.slice(0, 4) ?? [], [dataset]);

  const handleAnalyze = async () => {
    setError(null);
    setLoadingAnalysis(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: resumeText }),
      });

      const rawPayload = (await response.json()) as Record<string, unknown>;
      const payload = normalizeResumeAnalysis(rawPayload);

      if (!response.ok) {
        throw new Error(String(rawPayload.error ?? rawPayload.detail ?? "Unable to analyze the resume."));
      }

      setAnalysis(payload);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Unexpected error.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleResumeFileAnalyze = async (fileToAnalyze: File | null = resumeFile) => {
    if (!fileToAnalyze) {
      setError("Please choose a resume file first.");
      return;
    }

    setError(null);
    setLoadingAnalysis(true);

    try {
      const formData = new FormData();
      formData.append("file", fileToAnalyze);

      const response = await fetch("/api/resume/upload/analyze", {
        method: "POST",
        body: formData,
      });

      const rawPayload = (await response.json()) as Record<string, unknown>;
      const payload = normalizeResumeAnalysis(rawPayload);

      if (!response.ok) {
        throw new Error(String(rawPayload.detail ?? rawPayload.error ?? "Unable to analyze the uploaded resume."));
      }

      setAnalysis(payload);
      setResumeText(payload.sourceText && payload.sourceText.trim() ? payload.sourceText : `Uploaded file: ${fileToAnalyze.name}`);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Unexpected error.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const [interviewQuestion, setInterviewQuestion] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [loadingInterview, setLoadingInterview] = useState(false);
  const [interviewLog, setInterviewLog] = useState<Array<{ q: string; a?: string; evaluation?: any }>>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // voice recording state
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    if (!query) {
      return sessions;
    }

    return sessions.filter((session) => {
      const haystack = [
        session.id.toString(),
        session.category ?? "",
        session.resume_text ?? "",
        session.created_at,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [sessions, sessionSearch]);

  const handleGenerateInterview = async () => {
    setLoadingInterview(true);
    setInterviewQuestion(null);
    setFollowUps([]);

    try {
      // first analyze the current resume text to extract keywords
      const aResp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: resumeText }),
      });

      const analysisPayload = normalizeResumeAnalysis((await aResp.json()) as Record<string, unknown>);
      const keywords = analysisPayload.matchedKeywords ?? [];
      const category = analysisPayload.category ?? undefined;

      const iResp = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, keywords }),
      });

      const interviewPayload = await iResp.json();

      setInterviewQuestion(interviewPayload.question ?? null);
      setFollowUps(interviewPayload.followUps ?? []);
      setInterviewLog((l) => [...l, { q: interviewPayload.question }]);
      if (interviewPayload.session_id) setSessionId(interviewPayload.session_id as number);
      await loadSessions();
      if (interviewPayload.session_id) {
        await loadSession(interviewPayload.session_id as number);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInterview(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!interviewQuestion) return;
    (async () => {
      const answer = candidateAnswer;
      const question = interviewQuestion;
      try {
        const resp = await fetch("/api/interview/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer, keywords: analysis?.matchedKeywords ?? [] }),
        });
        const evalPayload = await resp.json();

        setInterviewLog((l) => {
          const copy = [...l];
          copy[copy.length - 1] = { ...copy[copy.length - 1], a: answer, evaluation: evalPayload };
          return copy;
        });

        // persist to backend session if available
        if (sessionId) {
          await fetch(`/api/interview/session/${sessionId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, answer, evaluation: evalPayload }),
          });
          await loadSessions();
          await loadSession(sessionId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setCandidateAnswer("");
      }
    })();
  };

  const handleDeleteSession = async (sessionIdToDelete: number) => {
    const confirmed = window.confirm(`Delete session #${sessionIdToDelete}? This cannot be undone.`);
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/interview/session/${sessionIdToDelete}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Unable to delete session.");
      }

      if (activeSession?.session.id === sessionIdToDelete) {
        setActiveSession(null);
      }
      if (sessionId === sessionIdToDelete) {
        setSessionId(null);
      }
      setInterviewLog([]);
      setInterviewQuestion(null);
      setFollowUps([]);
      await loadSessions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unexpected error.");
    }
  };

  const handleExportSessions = async (format: "json" | "csv") => {
    setError(null);
    try {
      const params = new URLSearchParams({
        format,
        evaluated_only: showEvaluatedOnly ? "true" : "false",
      });
      const response = await fetch(`/api/interview/sessions/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Unable to export session history.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `session_history.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unexpected error.");
    }
  };

  // voice recording handlers
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (ev) => chunks.push(ev.data);
      mr.onstop = () => setAudioBlob(new Blob(chunks, { type: "audio/webm" }));
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    setRecording(false);
  };

  const uploadRecording = async () => {
    if (!audioBlob) return;
    setLoadingInterview(true);
    try {
      const fd = new FormData();
      fd.append("file", audioBlob, "answer.webm");
      const resp = await fetch("/api/interview/voice_transcribe", { method: "POST", body: fd });
      const payload = await resp.json();
      const text = payload?.text ?? "";
      setCandidateAnswer(text);
      // auto-evaluate once transcribed
      setTimeout(() => handleSubmitAnswer(), 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInterview(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0%,_#0f172a_42%,_#020617_100%)] text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 px-6 py-8 shadow-2xl shadow-cyan-950/30 backdrop-blur md:px-10">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),transparent_45%,rgba(16,185,129,0.14),transparent_80%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
            <div className="space-y-6">
              <span className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                AI HR Team · MVP build
              </span>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  Autonomous resume screening built on your uploaded dataset.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  This first slice turns the resume dataset into a live screening workspace: dataset insights,
                  category frequencies, and a resume analyzer that returns a draft hiring signal.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {QUICK_HIGHLIGHTS.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-lg shadow-black/10"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-cyan-950/20">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Current model</p>
                  <p className="mt-2 text-xl font-semibold text-white">Dataset-driven heuristic</p>
                </div>
                <div className="rounded-2xl bg-emerald-400/15 px-3 py-2 text-right">
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Status</p>
                  <p className="text-sm font-semibold text-emerald-100">Ready</p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-2xl bg-white/5 p-4">
                  <dt className="text-slate-400">Uploaded dataset</dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">Resume.csv</dd>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <dt className="text-slate-400">Analysis route</dt>
                  <dd className="mt-2 text-2xl font-semibold text-white">/api/analyze</dd>
                </div>
              </dl>
              <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-100">
                Next step: replace the heuristic with a trained classifier and then add interview, verification,
                and decision agents.
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dataset insights</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Recruitment corpus summary</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {loadingDataset ? "Loading..." : `${dataset?.rowCount ?? 0} resumes`}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Dataset rows</p>
                <p className="mt-3 text-3xl font-semibold text-white">{dataset?.rowCount ?? "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Top category</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {topCategories[0]?.name ?? "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Distinct categories</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {dataset?.categoryBreakdown.length ?? "--"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {topCategories.map((category, index) => (
                <div key={category.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{category.name}</p>
                      <p className="text-xs text-slate-400">Most frequent category #{index + 1}</p>
                    </div>
                    <span className="text-sm text-slate-300">{category.count} resumes</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Resume analyzer</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Paste a candidate summary</h2>
            </div>

            <label className="mt-5 block rounded-3xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
              <span className="block text-sm font-semibold text-white">Upload a resume file</span>
              <span className="mt-1 block text-xs text-slate-400">PDF, DOCX, TXT, or Markdown works best.</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] ?? null;
                  setResumeFile(selectedFile);
                  if (selectedFile) {
                    void handleResumeFileAnalyze(selectedFile);
                  }
                }}
                className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-cyan-300"
              />
              {resumeFile ? <span className="mt-3 block text-xs text-emerald-300">Selected: {resumeFile.name}</span> : null}
            </label>

            <textarea
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              className="mt-5 min-h-44 w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-6 text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/40"
              placeholder="Paste resume text here..."
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resumeFile ? () => handleResumeFileAnalyze() : handleAnalyze}
                disabled={loadingAnalysis}
                className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAnalysis ? "Analyzing..." : resumeFile ? "Analyze uploaded resume" : "Analyze resume"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResumeFile(null);
                  setResumeText(SAMPLE_RESUME);
                }}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Reset sample
              </button>
            </div>

            {analysis ? (
              <div className="mt-6 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Predicted category</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{analysis.category}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Score</p>
                    <p className="text-xl font-semibold text-white">{analysis.score}/100</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-emerald-50/90">{analysis.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.matchedKeywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-50">
                      {keyword}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm text-emerald-100">
                  Confidence: <span className="font-semibold">{analysis.confidence}%</span>
                </p>
                {analysis.extraction ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Detected skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analysis.extraction.skills.length > 0 ? (
                          analysis.extraction.skills.map((skill) => (
                            <span key={skill} className="rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-50">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-emerald-50/80">No obvious skills detected.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Contact & experience</p>
                      <div className="mt-3 space-y-2 text-sm text-emerald-50/90">
                        <p>Name: {analysis.extraction.name ?? "—"}</p>
                        <p>Emails: {analysis.extraction.emails.length > 0 ? analysis.extraction.emails.join(", ") : "—"}</p>
                        <p>Phone: {analysis.extraction.phone_numbers.length > 0 ? analysis.extraction.phone_numbers.join(", ") : "—"}</p>
                        <p>Experience: {analysis.extraction.years_of_experience ?? "—"}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Education and target roles</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(analysis.extraction.education.length > 0 ? analysis.extraction.education : ["—"]).map((item) => (
                          <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-50">
                            {item}
                          </span>
                        ))}
                        {(analysis.extraction.job_titles.length > 0 ? analysis.extraction.job_titles : ["—"]).map((item) => (
                          <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-emerald-50">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
                Run the analyzer to generate a category prediction and a recruiter-friendly scorecard.
              </div>
            )}
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI Interview</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Generate interview questions</h2>
            </div>

            <p className="mt-4 text-sm text-slate-300">Generate a focused technical question based on the pasted resume.</p>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleGenerateInterview}
                disabled={loadingInterview}
                className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
              >
                {loadingInterview ? "Generating..." : "Generate question"}
              </button>
              <button
                onClick={() => {
                  setInterviewQuestion(null);
                  setFollowUps([]);
                  setInterviewLog([]);
                }}
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Reset
              </button>
            </div>

            {interviewLog.length > 0 ? (
              <div className="mt-6 space-y-4">
                {interviewLog.map((entry, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-sm text-slate-400">Question</p>
                    <p className="mt-1 text-white">{entry.q}</p>
                    <p className="mt-3 text-sm text-slate-400">Answer</p>
                    <p className="mt-1 text-slate-300">{entry.a ?? "(not answered)"}</p>
                  </div>
                ))}
                {interviewQuestion ? (
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Current question</p>
                    <p className="mt-1 text-white">{interviewQuestion}</p>

                    <textarea
                      value={candidateAnswer}
                      onChange={(e) => setCandidateAnswer(e.target.value)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-100"
                      placeholder="Type candidate's answer here..."
                    />

                    <div className="mt-3 flex gap-3">
                      <button
                        onClick={handleSubmitAnswer}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save answer
                      </button>
                      <button
                        onClick={() => setCandidateAnswer("")}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
                Generate an interview question to start a short AI-driven interview flow.
              </div>
            )}
          </article>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Session history</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Saved sessions and interactions</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={showEvaluatedOnly}
                  onChange={(event) => setShowEvaluatedOnly(event.target.checked)}
                  className="h-4 w-4 accent-cyan-400"
                />
                Evaluated only
              </label>
              <button
                type="button"
                onClick={() => handleExportSessions("json")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => handleExportSessions("csv")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
              >
                Export CSV
              </button>
              <input
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder="Search sessions"
                className="w-48 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
              />
              <button
                type="button"
                onClick={() => loadSessions()}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
              >
                {loadingSessions ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {filteredSessions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  {sessions.length === 0 ? "No saved sessions yet." : "No sessions match your search."}
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => loadSession(session.id)} className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">Session #{session.id}</p>
                          {session.has_evaluated_answer ? (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                              Evaluated
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{session.created_at}</p>
                        <p className="mt-2 text-sm text-slate-300">Category: {session.category ?? "N/A"}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {session.resume_text ?? "No resume text stored."}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {activeSession ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400">Active session</p>
                    <h3 className="text-xl font-semibold text-white">#{activeSession.session.id}</h3>
                    <p className="text-sm text-slate-300">Category: {activeSession.session.category ?? "N/A"}</p>
                  </div>
                  <div className="space-y-3">
                    {activeSession.interactions.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-sm font-medium text-white">Q: {item.question}</p>
                        <p className="mt-2 text-sm text-slate-300">A: {item.answer ?? "—"}</p>
                        {item.evaluation ? (
                          <div className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-100">
                            <p>Score: {item.evaluation.score ?? "N/A"}</p>
                            <p>Strengths: {(item.evaluation.strengths ?? []).join(", ") || "—"}</p>
                            <p>Weaknesses: {(item.evaluation.weaknesses ?? []).join(", ") || "—"}</p>
                            <p>Follow-ups: {(item.evaluation.follow_ups ?? []).join(" | ") || "—"}</p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {activeSession.interactions.length === 0 ? (
                      <div className="text-sm text-slate-400">No interactions stored for this session.</div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-300">Select a session to view its questions, answers, and evaluation.</div>
              )}
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dataset keywords</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Common signals per category</h2>
            </div>
            <p className="text-sm text-slate-400">These are extracted from the uploaded CSV and used by the analyzer.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(dataset?.topKeywords ?? []).slice(0, 6).map((item) => (
              <article key={item.category} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm font-semibold text-white">{item.category}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(item.keywords ?? []).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-white/6 px-3 py-1 text-xs text-slate-300">
                      {keyword}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
