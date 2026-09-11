// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from './detector.mjs';

const HUMAN = `I rewrote the parser on Sunday. It took four hours, most of them spent chasing a bug
that turned out to be a missing semicolon in a test fixture. The fix was one character.
The lesson, if there is one, is that I should read error messages before I read code.
Next week I want to try the same refactor on the exporter, but only after the release
ships and nobody is waiting on me.`;

const GENERATED = `In today's fast-paced world, it's important to note that productivity is not just a
skill, it's a mindset. Let's dive in. Moreover, leveraging robust tools can seamlessly elevate
your workflow and unlock your potential. This guide is a testament to the transformative
power of focus. Whether you're a student or a professional, embarking on this path will foster
growth. Ultimately, it's worth noting that success comes from a holistic approach.`;

test('plain human prose scores clean', () => {
  const r = analyze(HUMAN);
  assert.equal(r.label, 'Clean');
  assert.ok(r.score < 10, `score ${r.score}`);
});

test('stock generated prose scores heavy', () => {
  const r = analyze(GENERATED);
  assert.equal(r.label, 'Heavy AI signals');
  assert.ok(r.score >= 60, `score ${r.score}`);
  const types = new Set(r.issues.map((i) => i.type));
  for (const t of ['phrase', 'shape', 'vocabulary']) assert.ok(types.has(t), `missing ${t}`);
});

test('same input, same result', () => {
  assert.deepEqual(analyze(GENERATED), analyze(GENERATED));
});

test('code, URLs and frontmatter are not prose', () => {
  const md = '---\ntitle: robust\n---\nPlain words here.\n\n```\nconst robust = delve();\n```\nSee `leverage` at https://example.com/delve-into-synergy for more.';
  assert.deepEqual(analyze(md).issues, []);
});

test('issues carry the line they are on', () => {
  const r = analyze('First line is fine.\nSecond line too.\nThis one is a robust claim.');
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].line, 3);
  assert.equal(r.issues[0].text, 'robust');
});

test('a phrase is counted once, not again for its words', () => {
  const r = analyze('This result is a testament to careful work.');
  assert.deepEqual(r.issues.map((i) => i.type), ['phrase']);
});

test('connector openers are reported on their own', () => {
  const r = analyze('It works.\nMoreover, it is fast. Furthermore, it is cheap.');
  assert.deepEqual(r.issues.map((i) => i.text), ['Moreover,', 'Furthermore,']);
});

test('rhetorical question set-ups are flagged', () => {
  const r = analyze('The best part? It costs nothing to start.');
  assert.ok(r.issues.some((i) => i.type === 'rhetorical'));
});

test('empty text is clean', () => {
  assert.deepEqual(analyze(''), { words: 0, points: 0, score: 0, label: 'Clean', issues: [] });
});
