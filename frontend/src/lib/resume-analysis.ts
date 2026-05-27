import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type DatasetStats = {
  rowCount: number;
  categoryBreakdown: Array<{ name: string; count: number }>;
  topKeywords: Array<{ category: string; keywords: string[] }>;
};

export type ResumeAnalysis = {
  category: string;
  score: number;
  confidence: number;
  matchedKeywords: string[];
  summary: string;
};

type DatasetRow = {
  ID?: string;
  Resume_str?: string;
  Resume_html?: string;
  Category?: string;
};

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "him",
  "his",
  "i",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "she",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your",
]);

const datasetCache = new Map<string, DatasetRow[]>();
let statsCache: DatasetStats | null = null;
let profilesCache: Map<string, Map<string, number>> | null = null;

function getDatasetPath() {
  return path.resolve(process.cwd(), "..", "archive (3)", "Resume", "Resume.csv");
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

async function loadDataset() {
  const datasetPath = getDatasetPath();
  const cached = datasetCache.get(datasetPath);
  if (cached) {
    return cached;
  }

  const raw = await fs.readFile(datasetPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  }) as DatasetRow[];

  datasetCache.set(datasetPath, rows);
  return rows;
}

async function buildProfiles() {
  if (profilesCache) {
    return profilesCache;
  }

  const rows = await loadDataset();
  const profiles = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const category = row.Category?.trim();
    const text = row.Resume_str?.trim();

    if (!category || !text) {
      continue;
    }

    const profile = profiles.get(category) ?? new Map<string, number>();
    for (const token of tokenize(text)) {
      profile.set(token, (profile.get(token) ?? 0) + 1);
    }
    profiles.set(category, profile);
  }

  profilesCache = profiles;
  return profiles;
}

export async function getDatasetStats(): Promise<DatasetStats> {
  if (statsCache) {
    return statsCache;
  }

  const rows = await loadDataset();
  const categoryCounts = new Map<string, number>();
  const profiles = await buildProfiles();

  for (const row of rows) {
    const category = row.Category?.trim();
    if (!category) {
      continue;
    }
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const categoryBreakdown = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  const topKeywords = Array.from(profiles.entries())
    .map(([category, profile]) => ({
      category,
      keywords: Array.from(profile.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([keyword]) => keyword),
    }))
    .sort((left, right) => left.category.localeCompare(right.category));

  statsCache = {
    rowCount: rows.length,
    categoryBreakdown,
    topKeywords,
  };

  return statsCache;
}

export async function analyzeResume(text: string): Promise<ResumeAnalysis> {
  const profiles = await buildProfiles();
  const inputTokens = tokenize(text);
  const tokenSet = new Set(inputTokens);

  let bestCategory = "General";
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const [category, profile] of profiles.entries()) {
    let score = 0;
    const keywords: string[] = [];

    for (const token of tokenSet) {
      const frequency = profile.get(token);
      if (frequency) {
        score += frequency;
        keywords.push(token);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
      matchedKeywords = keywords;
    }
  }

  const keywordHits = matchedKeywords.length;
  const confidence = Math.min(98, 50 + bestScore + keywordHits * 4);
  const normalizedScore = Math.min(100, 35 + bestScore * 7 + keywordHits * 3);

  const summary =
    matchedKeywords.length > 0
      ? `Strong overlap with ${bestCategory} profiles based on ${matchedKeywords.slice(0, 4).join(", ")}.`
      : "No strong category overlap found. The resume looks more general-purpose than the dataset patterns.";

  return {
    category: bestCategory,
    score: normalizedScore,
    confidence,
    matchedKeywords: matchedKeywords.slice(0, 8),
    summary,
  };
}
