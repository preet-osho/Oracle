import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync(0, 'utf8'));
const byRule: Record<string, string[]> = {};

for (const file of data) {
  if (file.filePath.includes('.test.')) continue;
  for (const msg of file.messages) {
    if (msg.severity !== 2) continue; // warnings only
    const rule = msg.ruleId || 'unknown';
    if (!byRule[rule]) byRule[rule] = [];
    const short = file.filePath.replace(/^.*[\\/]src[\\/]/, 'src/');
    byRule[rule].push(`${short}:${msg.line}:${msg.column}`);
  }
}

const sorted = Object.entries(byRule).sort((a, b) => b[1].length - a[1].length);
let total = 0;
for (const [rule, locs] of sorted) {
  total += locs.length;
  console.log(`\n${rule} (${locs.length})`);
  for (const loc of locs.slice(0, 8)) console.log(`  ${loc}`);
  if (locs.length > 8) console.log(`  ...+${locs.length - 8} more`);
}
console.log(`\nTotal: ${total} warnings across ${sorted.length} rules`);
