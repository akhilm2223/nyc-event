import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: rootEnvPath });

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const DEFAULT_PROMPT_TIMEFRAME = 'the next 7 days';

function buildNYCEventPrompt({ timeframe = DEFAULT_PROMPT_TIMEFRAME } = {}) {
  return `You are an expert event researcher.
  Task: Estimate how many unique public events, pop-ups, concerts, tech meetups, networking mixers, happy hours, club nights, or cultural happenings are available in New York City during ${timeframe}.
  Include:
  - Overall total number of events you can reasonably confirm from reliable current sources
  - Breakdowns by category when possible (e.g., concerts, nightlife, tech, arts & culture, pop-ups, wellness, food & drink)
  - A short list of notable or high-interest events with brief descriptors (include date & neighborhood)
  - Mention any major multi-day festivals or citywide happenings.
  Provide citations or source references when you cite numbers. Keep the response factual and concise.`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatDateLabel(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  });
  return formatter.format(date);
}

function formatDateRangeLabel(start, end) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const yearLabel = sameYear
    ? `${start.getFullYear()}`
    : `${start.getFullYear()}–${end.getFullYear()}`;
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  if (startLabel === endLabel && sameYear) {
    return `${startLabel}, ${yearLabel}`;
  }
  return `${startLabel} – ${endLabel}, ${yearLabel}`;
}

function computeDefaultWeekLabel(days = 7) {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + (days - 1));
  return formatDateRangeLabel(start, end);
}

function computeWeekendLabel() {
  const start = startOfToday();
  const day = start.getDay();
  const saturdayOffset = (6 - day + 7) % 7;
  const saturday = new Date(start);
  saturday.setDate(start.getDate() + saturdayOffset);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return formatDateRangeLabel(saturday, sunday);
}

function deriveTimeframeLabel(timeframeInput) {
  if (!timeframeInput) {
    return computeDefaultWeekLabel();
  }
  const normalized = timeframeInput.trim().toLowerCase();
  if (normalized === 'the next 7 days' || normalized === 'next 7 days') {
    return computeDefaultWeekLabel();
  }
  if (normalized === 'this weekend') {
    return computeWeekendLabel();
  }
  return timeframeInput;
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function normalizeNumberString(str) {
  return str ? str.replace(/[^\d,]/g, '') : null;
}

function parseNumberRangeFromText(text) {
  if (!text) return null;
  const approxMatch = text.match(/([\d,]{3,})\+?\s*(?:to|and)\s*([\d,]{3,})\+?/i);
  if (approxMatch) {
    const low = normalizeNumberString(approxMatch[1]);
    const high = normalizeNumberString(approxMatch[2]);
    return `${low}\u2013${high}`;
  }
  const betweenMatch = text.match(/between\s+([\d,]{3,})\s+(?:and|to)\s+([\d,]{3,})/i);
  if (betweenMatch) {
    const low = normalizeNumberString(betweenMatch[1]);
    const high = normalizeNumberString(betweenMatch[2]);
    return `${low}\u2013${high}`;
  }
  const dashMatch = text.match(/(\d{3,}(?:,\d{3})*)\s*[–-]\s*(\d{3,}(?:,\d{3})*)/);
  if (dashMatch) {
    return `${normalizeNumberString(dashMatch[1])}\u2013${normalizeNumberString(dashMatch[2])}`;
  }
  return null;
}

function parsePerplexityResponse(raw) {
  if (!raw) {
    return {
      summary: {
        total_estimate_range: null,
        confidence: 'low',
        notes: null
      },
      category_breakdown: {},
      notable_events: [],
      major_happenings: [],
      raw_response: raw
    };
  }

  if (raw.startsWith('ERROR')) {
    return {
      summary: {
        total_estimate_range: null,
        confidence: 'low',
        notes: raw
      },
      category_breakdown: {},
      notable_events: [],
      major_happenings: [],
      raw_response: raw
    };
  }

  const lines = raw.split('\n');
  const summaryLine = lines.find(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  }) || '';
  const totalRange = parseNumberRangeFromText(raw);

  const categoryBreakdown = {};
  let section = 'intro';
  const notableEvents = [];
  const majorHappenings = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{2,}\s+/u.test(line)) {
      const heading = line.replace(/^#{2,}\s+/, '');
      if (/^Category Breakdown/i.test(heading) || /^Breakdown by Category/i.test(heading)) {
        section = 'categories';
        continue;
      }
      if (/^Notable/i.test(heading)) {
        section = 'notable';
        continue;
      }
      if (/^Major/i.test(heading)) {
        section = 'major';
        continue;
      }
      section = 'intro';
      continue;
    }

    if (section === 'categories' && line.startsWith('|')) {
      if (line.includes('---')) continue;
      const cells = line.split('|').map(cell => cleanMarkdown(cell)).filter(Boolean);
      if (cells.length >= 2 && !/^Category$/i.test(cells[0])) {
        const range = parseNumberRangeFromText(cells[1]);
        categoryBreakdown[cells[0]] = range || cells[1];
      }
      continue;
    }

    if (section === 'categories' && line.startsWith('-')) {
      const cleaned = cleanMarkdown(line.replace(/^[-•]\s*/, ''));
      const [category, ...rest] = cleaned.split(':');
      if (category && rest.length) {
        const value = rest.join(':').trim();
        const rangeMatch = parseNumberRangeFromText(value);
        categoryBreakdown[category.trim()] = rangeMatch || value;
      }
      continue;
    }

    if (section === 'notable' && line.startsWith('-')) {
      const cleaned = cleanMarkdown(line.replace(/^[-•]\s*/, ''));
      if (cleaned) {
        notableEvents.push(cleaned);
      }
      continue;
    }

    if (section === 'major' && line.startsWith('-')) {
      const cleaned = cleanMarkdown(line.replace(/^[-•]\s*/, ''));
      if (cleaned) {
        majorHappenings.push(cleaned);
      }
      continue;
    }
  }

  return {
    summary: {
      total_estimate_range: totalRange,
      confidence: totalRange ? 'high' : 'medium',
      notes: cleanMarkdown(summaryLine)
    },
    category_breakdown: categoryBreakdown,
    notable_events: notableEvents,
    major_happenings: majorHappenings,
    raw_response: raw
  };
}

function parseGeminiResponse(raw) {
  if (!raw) {
    return {
      summary: {
        total_estimate_range: null,
        confidence: 'low',
        notes: null
      },
      category_signals: {},
      methodology: [],
      caveats: [],
      raw_response: raw
    };
  }

  if (raw.startsWith('ERROR')) {
    return {
      summary: {
        total_estimate_range: null,
        confidence: 'low',
        notes: raw
      },
      category_signals: {},
      methodology: [],
      caveats: [],
      raw_response: raw
    };
  }

  const lines = raw.split('\n');
  const summaryLine = lines.find(line => line.trim().length > 0 && !line.trim().startsWith('**')) || '';

  let totalEstimate = null;
  if (/over\s+1,?000/i.test(raw) || /\*\*over\s+1,?000\*\*/i.test(raw)) {
    totalEstimate = '1000+';
  } else if (/thousands/i.test(raw)) {
    totalEstimate = 'thousands';
  }

  const categorySignals = {};
  let section = 'intro';
  const methodology = [];
  const caveats = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('**Breakdown')) {
      section = 'categories';
      continue;
    }
    if (line.startsWith('**Notable')) {
      section = 'notable';
      continue;
    }
    if (line.startsWith('**Major')) {
      section = 'major';
      continue;
    }
    if (line.startsWith('**Sources')) {
      section = 'methodology';
      continue;
    }
    if (line.startsWith('**Important')) {
      section = 'caveats';
      continue;
    }

    if (section === 'categories' && line.startsWith('*')) {
      const cleaned = cleanMarkdown(line.replace(/^\*\s*/, ''));
      const [category, ...rest] = cleaned.split(':');
      if (category && rest.length) {
        categorySignals[category.trim()] = rest.join(':').trim();
      }
      continue;
    }

    if (section === 'methodology' && line.startsWith('*')) {
      methodology.push(cleanMarkdown(line.replace(/^\*\s*/, '')));
      continue;
    }

    if (section === 'caveats' && line.startsWith('*')) {
      caveats.push(cleanMarkdown(line.replace(/^\*\s*/, '')));
      continue;
    }
  }

  return {
    summary: {
      total_estimate_range: totalEstimate,
      confidence: totalEstimate ? 'medium' : 'low',
      notes: cleanMarkdown(summaryLine)
    },
    category_signals: categorySignals,
    methodology,
    caveats,
    raw_response: raw
  };
}

async function askPerplexity(prompt) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a meticulous NYC events analyst who cites reliable sources.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${errorText}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content;
    return message || null;
  } catch (error) {
    console.error('❌ Perplexity request failed:', error.message);
    throw error;
  }
}

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.25,
            topP: 0.8,
            topK: 40
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    const message = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return message || null;
  } catch (error) {
    console.error('❌ Gemini request failed:', error.message);
    throw error;
  }
}

export async function researchNYCEventCounts(options = {}) {
  const timeframeInput = options.timeframe || DEFAULT_PROMPT_TIMEFRAME;
  const prompt = buildNYCEventPrompt({ timeframe: timeframeInput });
  const timeframeLabel = deriveTimeframeLabel(timeframeInput);

  const results = {
    prompt,
    timeframe: timeframeInput,
    timeframeLabel,
    generatedAt: new Date().toISOString(),
    perplexity: null,
    gemini: null
  };

  try {
    console.log('🔍 Querying Perplexity for NYC event counts...');
    results.perplexity = await askPerplexity(prompt);
    console.log('✅ Perplexity response received');
  } catch (error) {
    results.perplexity = `ERROR: ${error.message}`;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    console.log('🤖 Querying Gemini for NYC event counts...');
    results.gemini = await askGemini(prompt);
    console.log('✅ Gemini response received');
  } catch (error) {
    results.gemini = `ERROR: ${error.message}`;
  }

  return results;
}

export async function saveNYCEventResearch(results, outputFilename = 'ai-nyc-event-counts.json') {
  const fs = await import('fs/promises');
  const path = await import('path');

  const entry = {
    metadata: {
      prompt: results.prompt,
      timeframe: results.timeframeLabel || results.timeframe,
      timeframe_input: results.timeframe,
      timestamp: results.generatedAt
    },
    perplexity: parsePerplexityResponse(results.perplexity),
    gemini: parseGeminiResponse(results.gemini)
  };

  const outputPath = path.join(process.cwd(), outputFilename);

  let existing = [];
  try {
    const raw = await fs.readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      existing = parsed;
    } else if (parsed) {
      existing = [parsed];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  existing.push(entry);

  await fs.writeFile(outputPath, JSON.stringify(existing, null, 2), 'utf-8');
  console.log(`💾 Saved research to ${outputFilename}`);
}
