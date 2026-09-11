#!/usr/bin/env node
// detector.mjs — a deterministic AI-pattern score for prose.
//
//   node detector.mjs <file>     prints { words, points, score, label, issues } as JSON
//   import { analyze } from './detector.mjs'
//
// 0 = clean; higher = more machine-sounding. The same text always gets the same
// result. It looks at vocabulary, stock phrases, sentence shapes and rhythm.
// It does NOT check grammar or spelling.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Words that turn up far more in generated prose than in people's writing.
const WORDS = [
  'delve', 'delves', 'delving', 'tapestry', 'testament', 'realm', 'leverage', 'leveraging',
  'utilize', 'utilizing', 'robust', 'seamless', 'seamlessly', 'pivotal', 'paramount',
  'foster', 'fostering', 'underscore', 'underscores', 'showcase', 'showcasing', 'embark',
  'embarking', 'elevate', 'elevating', 'unlock', 'unleash', 'harness', 'empower', 'empowering',
  'intricate', 'meticulous', 'meticulously', 'vibrant', 'bustling', 'multifaceted', 'holistic',
  'synergy', 'paradigm', 'transformative', 'groundbreaking', 'revolutionize', 'streamline',
  'bolster', 'myriad', 'plethora', 'commendable', 'captivating', 'beacon', 'cornerstone',
  'interplay', 'nestled', 'boasts', 'ever-evolving', 'game-changer', 'cutting-edge', 'resonate',
];

// Stock phrases and set-ups.
const PHRASES = [
  "in today's fast-paced world", "in today's digital age", 'in the ever-evolving',
  "it's important to note", 'it is important to note', "it's worth noting", 'it is worth noting',
  'plays a crucial role', 'plays a pivotal role', 'a testament to', "let's dive in", 'deep dive',
  'navigate the complexities', 'rich tapestry', 'in the realm of', 'a myriad of', 'a plethora of',
  'first and foremost', 'look no further', 'unlock the power', 'embark on a journey',
  "whether you're a", 'whether you are a', 'at the end of the day', 'in conclusion', 'in summary',
  'to sum up', "here's the thing", "here's why", "here's what", "let's break it down",
  "let's explore", 'i hope this helps', 'great question', 'feel free to', 'it goes without saying',
  'rest assured',
];

// Sentence shapes: [pattern, label, hint].
const SHAPES = [
  [/\bnot (?:just|only|merely)\b[^.!?;]{1,80}?[,;—–-]\s*(?:but|it's|it is)\b/gi,
    'not-just-X-but-Y contrast', 'State the point directly.'],
  [/\b(?:it's|this is|that's) not [^.!?;]{1,60}?[,;—–-]\s*(?:it's|this is|that's)\b/gi,
    "it's-not-X-it's-Y reversal", 'Say what it is, not what it is not.'],
  [/(?<=(?:^|[.!?])\s*)(?:Moreover|Furthermore|Additionally|Ultimately|Notably|Importantly|Interestingly|Overall|In essence),/gm,
    'formal connector opener', 'Drop the connector or use a plain one ("Also", "So").'],
  [/\b(?:may|might|could) (?:potentially|possibly)\b/gi, 'stacked hedge', 'Keep one hedge or none.'],
];

const WEIGHT = { vocabulary: 1, phrase: 2, shape: 2, rhetorical: 1.5, dashes: 2, rhythm: 3 };
const SEVERITY = { vocabulary: 'low', phrase: 'high', shape: 'high', rhetorical: 'medium', dashes: 'medium', rhythm: 'medium' };

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_RE = new RegExp(`\\b(?:${WORDS.map(escape).join('|')})\\b`, 'gi');
const PHRASE_RE = new RegExp(`\\b(?:${PHRASES.map(escape).join('|')})\\b`, 'gi');

// Blank out what is not prose (frontmatter, code, URLs), keeping newlines so
// line numbers still match the original.
function proseOnly(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/[‘’]/g, "'")
    .replace(/^---\n[\s\S]*?\n---(?=\n|$)/, blank)
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\bhttps?:\/\/\S+/g, blank);
}

export function analyze(text) {
  const prose = proseOnly(String(text ?? ''));
  const words = (prose.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
  const lineAt = (index) => prose.slice(0, index).split('\n').length;
  const found = [];
  const taken = []; // [start, end) spans already claimed by a phrase or shape
  const overlaps = (start, end) => taken.some(([s, e]) => start < e && end > s);
  const add = (type, index, match, hint) =>
    found.push({ type, index, line: lineAt(index), text: match.replace(/\s+/g, ' ').trim(), severity: SEVERITY[type], hint });

  for (const m of prose.matchAll(PHRASE_RE)) {
    taken.push([m.index, m.index + m[0].length]);
    add('phrase', m.index, m[0], 'Cut the stock phrase; say the specific thing.');
  }
  for (const [pattern, label, hint] of SHAPES) {
    for (const m of prose.matchAll(pattern)) {
      if (overlaps(m.index, m.index + m[0].length)) continue;
      taken.push([m.index, m.index + m[0].length]);
      add('shape', m.index, m[0], `${label}: ${hint}`);
    }
  }
  for (const m of prose.matchAll(WORD_RE)) {
    if (overlaps(m.index, m.index + m[0].length)) continue;
    add('vocabulary', m.index, m[0], 'Use a plainer word.');
  }

  // Sentences, for rhythm and rhetorical set-ups. A newline ends a sentence too.
  const sentences = [...prose.matchAll(/[^.!?\n]+[.!?]*/g)]
    .map((m) => ({ index: m.index, text: m[0], words: (m[0].match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length }))
    .filter((s) => s.words > 0);
  sentences.forEach((s, i) => {
    const next = sentences[i + 1];
    const sameParagraph = next && !prose.slice(s.index, next.index).includes('\n');
    if (s.text.trim().endsWith('?') && s.words <= 6 && sameParagraph) {
      add('rhetorical', s.index + (s.text.length - s.text.trimStart().length), s.text,
        'Rhetorical set-up: make the statement instead of asking and answering.');
    }
  });
  const lengths = sentences.filter((s) => /[.!?]$/.test(s.text.trim()) && s.words >= 3).map((s) => s.words);
  if (lengths.length >= 8) {
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    if (sd / mean < 0.35) {
      add('rhythm', 0, `${lengths.length} sentences, most ${Math.round(mean)} words long`,
        'Uniform sentence length: mix short and long sentences.');
    }
  }

  const dashes = (prose.match(/—| -- /g) ?? []).length;
  if (dashes >= 3 && dashes > words / 60) {
    add('dashes', prose.search(/—| -- /), `${dashes} dashes in ${words} words`,
      'Dash-heavy: turn some into commas, colons or full stops.');
  }

  found.sort((a, b) => a.index - b.index);
  const points = found.reduce((sum, f) => sum + WEIGHT[f.type], 0);
  const score = Math.min(100, Math.round((points * 600) / Math.max(words, 50)));
  const label = score < 10 ? 'Clean' : score < 30 ? 'Some AI patterns' : score < 60 ? 'Moderate AI signals' : 'Heavy AI signals';
  return { words, points, score, label, issues: found.map(({ index, ...rest }) => rest) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node detector.mjs <file>');
    process.exit(2);
  }
  console.log(JSON.stringify(analyze(readFileSync(file, 'utf8')), null, 1));
}
