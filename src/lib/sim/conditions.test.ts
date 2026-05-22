// Quick sanity checks for the condition parser/evaluator. Run via
// `npx tsx src/lib/sim/conditions.test.ts` (not wired to a test runner yet —
// these are spot-checks against real conditions extracted from skills_all).

import { evalString, parseCondition, type Context } from "./conditions";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}`);
    console.error("  expected:", expected);
    console.error("  actual:  ", actual);
  } else {
    console.log(`PASS  ${label}`);
  }
}

// --- parsing ---
check(
  "single compare",
  parseCondition("phase==2"),
  { kind: "or", parts: [{ kind: "and", parts: [{ kind: "compare", var: "phase", op: "==", value: 2 }] }] }
);

check(
  "AND chain",
  parseCondition("phase==2&order<=5").parts[0].parts.length,
  2
);

check(
  "OR alternation",
  parseCondition("phase==2@phase==3").parts.length,
  2
);

// --- evaluation ---
const ctx1: Context = { phase: 2, order: 3, is_finalcorner: 1, is_overtake: 1, order_rate: 40 };
check(
  "real condition true",
  evalString("is_finalcorner==1&is_overtake==1&order<=5&order_rate<=50", ctx1),
  true
);

check(
  "real condition false (wrong phase)",
  evalString("phase==1", ctx1),
  false
);

check(
  "OR — one branch true",
  evalString("order==1@order==3", ctx1),
  true
);

check(
  "OR — both branches false",
  evalString("order==5@order==7", ctx1),
  false
);

const ctx2: Context = { phase: 2, distance_rate: 60, slope: 2, order_rate: 70, remain_distance: 600 };
check(
  "complex multi-AND",
  evalString("distance_rate>=60&slope==2&phase==1&order_rate>=40&order_rate<=80&remain_distance>=500", ctx2),
  false   // phase==1 fails (ctx has phase=2)
);

check(
  "complex multi-AND, ctx fixed",
  evalString("distance_rate>=60&slope==2&phase==2&order_rate>=40&order_rate<=80&remain_distance>=500", ctx2),
  true
);

// Empty / missing
check("empty string evaluates true", evalString("", ctx1), true);
check("undefined evaluates true", evalString(undefined, ctx1), true);

// Unknown variable defaults to 0
check("unknown var defaults to 0 (matches ==0)", evalString("foo==0", ctx1), true);
check("unknown var defaults to 0 (fails ==1)", evalString("foo==1", ctx1), false);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).process?.exit?.(1);
} else {
  console.log("\nAll passed.");
}
