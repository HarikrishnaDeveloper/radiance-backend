// Restores "1. 2. 3." (or "I. II. III.") numbering on statement lists that
// lost it when papers were transcribed into prisma/seed-data/*.ts.
//
//   node scripts/fix-statement-numbers.js prisma/seed-data            # report
//   node scripts/fix-statement-numbers.js prisma/seed-data --write    # apply
//
// Then run scripts/sync-paper-questions.ts to carry the text into the database.
// A list = a run of 2+ unnumbered lines right after a lead-in line ending in
// ":" or "?"; it ends at the next lead-in / instruction line.
const NUMBERED = /^\s*(\(?[0-9]+[.)]|\(?[ivxIVX]+[.)]|\(?[a-dA-D][.)]|[-•*])\s/;
const LEAD = /[:?]\s*$/;
const STOP = /^(which|select|how many|what|choose|in the light|with reference|from the above|consider the|the above|codes?\b|list[- ]?i)/i;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
// Match-the-following tables have column headers, not statements: leave them.
const MATCH = /\bmatch\b|\blist[- ]?i\b/i;

// options: the four choices, used to pick the numbering the answer refers to.
function numberLists(text, options = []) {
  if (MATCH.test(text)) return text;
  const opts = options.join(' ');
  const roman = /\b(I|II|III|IV|V|VI)\b/.test(opts) && !/\b\d\b/.test(opts);
  const label = (n) => (roman ? ROMAN[n] : String(n + 1));
  const lines = text.split('\n');
  const out = [...lines];
  for (let i = 0; i < lines.length; i++) {
    if (!LEAD.test(lines[i])) continue;
    let j = i + 1;
    const run = [];
    while (j < lines.length && lines[j].trim() && !LEAD.test(lines[j]) && !STOP.test(lines[j].trim()) && !NUMBERED.test(lines[j])) run.push(j++);
    // Only a real list: 2+ items, and not a table's column headers (those
    // are followed straight away by rows that already carry labels).
    const headers = j < lines.length && NUMBERED.test(lines[j]);
    if (run.length >= 2 && !headers) run.forEach((k, n) => (out[k] = `${label(n)}. ${lines[k].trim()}`));
  }
  return out.join('\n');
}
module.exports = { numberLists };

if (require.main === module) {
  const fs = require('fs');
  const [dir, mode] = [process.argv[2], process.argv[3]];
  let total = 0, changed = 0; const samples = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const lines = fs.readFileSync(`${dir}/${f}`, 'utf8').split(/\r?\n/);
    let fileChanged = 0;
    const next = lines.map((l) => {
      const t = l.trim().replace(/,\s*$/, '');
      if (!t.startsWith('{"no"')) return l;
      const q = JSON.parse(t); total++;
      const fixed = numberLists(q.text, [q.A, q.B, q.C, q.D].filter(Boolean));
      if (fixed === q.text) return l;
      changed++; fileChanged++;
      samples.push({ f, no: q.no, before: q.text, after: fixed, A: q.A, B: q.B });
      return l.replace(JSON.stringify(q.text), JSON.stringify(fixed));
    });
    if (mode === '--write' && fileChanged) fs.writeFileSync(`${dir}/${f}`, next.join('\n'));
    if (fileChanged) console.log(f, fileChanged);
  }
  console.log({ total, changed });
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(samples, null, 1));
}
