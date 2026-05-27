export type InterviewRequest = {
  category?: string;
  keywords?: string[];
};

export type InterviewQuestion = {
  question: string;
  followUps: string[];
};

const TEMPLATES: Record<string, string[]> = {
  python: [
    "Explain how you would profile a slow Python application.",
    "Describe the Global Interpreter Lock (GIL) and its implications for multithreaded programs.",
    "How would you manage dependencies and environments across multiple services?",
  ],
  ml: [
    "Walk me through an ML project you've built from data ingestion to deployment.",
    "How do you validate a model's performance and prevent data leakage?",
    "Describe a time you improved model generalization — what techniques did you try?",
  ],
  sql: [
    "Explain how you would optimize a slow SQL query on a large table.",
    "How do you design indexes for reporting workloads?",
  ],
  default: [
    "Tell me about a project you're proud of and the specific technical choices you made.",
    "Describe a difficult bug you diagnosed — how did you approach it?",
  ],
};

function pick<T>(arr: T[], fallback: T): T {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeKeyword(k: string) {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function generateInterview(req: InterviewRequest): InterviewQuestion {
  const keywords = (req.keywords ?? []).map(normalizeKeyword);
  const category = (req.category ?? "").toLowerCase();

  // pick a primary theme
  let theme = "default";
  if (category) theme = category;

  // prefer template matching any keyword -> mapping heuristics
  for (const kw of keywords) {
    if (kw.includes("python") || kw.includes("django") || kw.includes("flask")) {
      theme = "python";
      break;
    }
    if (kw.includes("machine") || kw.includes("ml") || kw.includes("learning")) {
      theme = "ml";
      break;
    }
    if (kw.includes("sql") || kw.includes("query") || kw.includes("database")) {
      theme = "sql";
      break;
    }
  }

  const pool = TEMPLATES[theme] ?? TEMPLATES.default;
  const question = pick(pool, TEMPLATES.default[0]);

  // build simple follow-ups based on keywords
  const followUps: string[] = [];
  if (keywords.length) {
    followUps.push(
      `You mentioned ${keywords.slice(0, 3).join(", ")}. Can you explain your specific contributions related to these?`,
    );
  }

  if (theme === "python") {
    followUps.push("How would you improve performance in a CPU-bound Python workload?");
  }
  if (theme === "ml") {
    followUps.push("Which evaluation metrics would you choose for this problem and why?");
  }
  if (theme === "sql") {
    followUps.push("How would you approach schema changes for a table with millions of rows?");
  }

  // ensure at least one follow-up
  if (followUps.length === 0) followUps.push("Can you expand on that?");

  return { question, followUps };
}
