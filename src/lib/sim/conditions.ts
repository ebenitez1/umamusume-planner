// Parser + evaluator for UmaTools skill precondition strings.
//
// Grammar (decoded from 927 distinct conditions in skills_all.json):
//
//   expr      = and_group ('@' and_group)*    -- OR
//   and_group = compare   ('&' compare)*      -- AND
//   compare   = ident OP value                -- atomic comparison
//   OP        = '==' | '!=' | '<=' | '>=' | '<' | '>'
//   ident     = [a-z_][a-z0-9_]*
//   value     = signed integer
//
// Operator frequency in the corpus:  &:2257  ==:1954  >=:783  <=:469
// @ (OR):238  !=:72  <:34  >:26 — full coverage with one parser.
//
// Variables are looked up by name in a Context. Unknown variables evaluate
// to 0; we log them once per distinct name in dev so the variable surface
// is observable as we encounter new skills.

export type Op = "==" | "!=" | "<=" | ">=" | "<" | ">";

export interface Compare {
  kind: "compare";
  var: string;
  op: Op;
  value: number;
}

export interface And {
  kind: "and";
  parts: Compare[];
}

export interface Or {
  kind: "or";
  parts: And[];
}

export type Expr = Or;

export type Context = Record<string, number | boolean>;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const OPS: Op[] = ["==", "!=", "<=", ">=", "<", ">"];

function parseCompare(s: string): Compare {
  for (const op of OPS) {
    const i = s.indexOf(op);
    if (i > 0) {
      const v = s.slice(i + op.length);
      const value = Number(v);
      if (!Number.isFinite(value)) {
        // value is a non-numeric token (rare — e.g. variable on right).
        // Treat as 0 so we don't crash; caller can detect by inspecting the AST.
        return { kind: "compare", var: s.slice(0, i).trim(), op, value: 0 };
      }
      return { kind: "compare", var: s.slice(0, i).trim(), op, value };
    }
  }
  // No operator — treat as a "truthy" check on the variable.
  return { kind: "compare", var: s.trim(), op: "!=", value: 0 };
}

function parseAnd(s: string): And {
  if (!s) return { kind: "and", parts: [] };
  const parts = s.split("&").map((p) => p.trim()).filter(Boolean).map(parseCompare);
  return { kind: "and", parts };
}

export function parseCondition(s: string | null | undefined): Expr {
  if (!s) return { kind: "or", parts: [{ kind: "and", parts: [] }] };
  const parts = s.split("@").map((p) => p.trim()).filter(Boolean).map(parseAnd);
  return { kind: "or", parts: parts.length ? parts : [{ kind: "and", parts: [] }] };
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

const seenUnknownVars = new Set<string>();

function lookup(ctx: Context, name: string): number {
  const v = ctx[name];
  if (v === undefined) {
    if (!seenUnknownVars.has(name)) {
      seenUnknownVars.add(name);
      // Dev hint only — fall through to 0 so simulation keeps running.
      if (typeof console !== "undefined") {
        console.debug(`[sim] unknown condition variable: ${name}`);
      }
    }
    return 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function evalCompare(c: Compare, ctx: Context): boolean {
  const lhs = lookup(ctx, c.var);
  switch (c.op) {
    case "==": return lhs === c.value;
    case "!=": return lhs !== c.value;
    case "<=": return lhs <= c.value;
    case ">=": return lhs >= c.value;
    case "<":  return lhs <  c.value;
    case ">":  return lhs >  c.value;
  }
}

function evalAnd(a: And, ctx: Context): boolean {
  // Empty AND is vacuously true (e.g. the empty-condition fallback above).
  if (!a.parts.length) return true;
  return a.parts.every((c) => evalCompare(c, ctx));
}

export function evalCondition(e: Expr, ctx: Context): boolean {
  if (!e.parts.length) return true;
  return e.parts.some((a) => evalAnd(a, ctx));
}

// Convenience: parse + evaluate in one shot. Most callers can use this.
export function evalString(s: string | null | undefined, ctx: Context): boolean {
  return evalCondition(parseCondition(s), ctx);
}

// Expose for dev tools / tests.
export const _internal = { seenUnknownVars };
