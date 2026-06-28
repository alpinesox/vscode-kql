/**
 * Core offline language services for Kusto Query Language (KQL).
 */

export type TokenKind =
  | "keyword"
  | "identifier"
  | "string"
  | "number"
  | "operator"
  | "symbol"
  | "comment";

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
}

export interface KqlDiagnostic {
  message: string;
  start: number;
  end: number;
  severity: "error" | "warning";
}

export interface ParseResult {
  tokens: Token[];
  diagnostics: KqlDiagnostic[];
}

const MAX_QUERY_LENGTH = 1_048_576;
const MAX_DIAGNOSTICS = 200;

const KEYWORDS = new Set([
  "AND",
  "AS",
  "ASC",
  "BETWEEN",
  "BY",
  "CONTAINS",
  "DECLARE",
  "DESC",
  "DISTINCT",
  "EXTEND",
  "EXTERNALDATA",
  "EVALUATE",
  "FACET",
  "FALSE",
  "FIND",
  "FORK",
  "GETSCHEMA",
  "HAS",
  "IN",
  "INVOKE",
  "JOIN",
  "KIND",
  "LET",
  "LIMIT",
  "LOOKUP",
  "MAKE-SERIES",
  "MATERIALIZE",
  "MV-APPLY",
  "MV-EXPAND",
  "NOT",
  "NULL",
  "ON",
  "OR",
  "ORDER",
  "PARSE",
  "PRINT",
  "PROJECT",
  "PROJECT-AWAY",
  "PROJECT-KEEP",
  "PROJECT-RENAME",
  "RANGE",
  "REDUCE",
  "RENDER",
  "SAMPLE",
  "SEARCH",
  "SERIALIZE",
  "SORT",
  "SUMMARIZE",
  "TAKE",
  "TOP",
  "TRUE",
  "UNION",
  "WHERE"
]);

const PIPE_OPERATORS = new Set([
  "COUNT",
  "DISTINCT",
  "EVALUATE",
  "EXTEND",
  "FACET",
  "FORK",
  "GETSCHEMA",
  "INVOKE",
  "JOIN",
  "LIMIT",
  "LOOKUP",
  "MAKE-SERIES",
  "MV-APPLY",
  "MV-EXPAND",
  "ORDER",
  "PARSE",
  "PROJECT",
  "PROJECT-AWAY",
  "PROJECT-KEEP",
  "PROJECT-RENAME",
  "REDUCE",
  "RENDER",
  "SAMPLE",
  "SEARCH",
  "SERIALIZE",
  "SORT",
  "SUMMARIZE",
  "TAKE",
  "TOP",
  "UNION",
  "WHERE"
]);

export const COMPLETION_KEYWORDS = [
  "let",
  "declare query_parameters",
  "where",
  "project",
  "extend",
  "summarize",
  "by",
  "order by",
  "sort by",
  "take",
  "top",
  "join kind=inner",
  "union",
  "render",
  "evaluate",
  "mv-expand",
  "mv-apply",
  "parse",
  "distinct"
];

export const COMPLETION_FUNCTIONS = [
  "ago()",
  "bin()",
  "case()",
  "coalesce()",
  "count()",
  "datetime()",
  "dcount()",
  "dynamic()",
  "iff()",
  "isnotempty()",
  "isempty()",
  "make_list()",
  "make_set()",
  "now()",
  "parse_json()",
  "strcat()",
  "sum()",
  "take_any()",
  "timespan()",
  "tostring()",
  "tolower()",
  "toupper()"
];

export const COMPLETION_OPERATORS = [
  "==",
  "!=",
  "=~",
  "!~",
  "contains",
  "!contains",
  "has",
  "!has",
  "in",
  "!in",
  "between",
  "and",
  "or",
  "not"
];

export const COMPLETION_TYPES = ["bool", "datetime", "decimal", "dynamic", "guid", "int", "long", "real", "string", "timespan"];

/**
 * Tokenizes KQL source text into comments, literals, operators, symbols, keywords, and identifiers.
 *
 * @param input - KQL source text.
 * @returns Tokens with source offsets.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];
    if (c === undefined) break;

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "/" && input[i + 1] === "/") {
      const start = i;
      i += 2;
      while (i < input.length && input[i] !== "\n") i++;
      tokens.push({ kind: "comment", value: input.slice(start, i), start, end: i });
      continue;
    }

    if (c === "/" && input[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      if (i < input.length) i += 2;
      tokens.push({ kind: "comment", value: input.slice(start, i), start, end: i });
      continue;
    }

    if (c === "'" || c === '"') {
      const quote = c;
      const start = i++;
      while (i < input.length) {
        if (input[i] === "\\") {
          i += 2;
          continue;
        }
        if (quote === "'" && input[i] === "'" && input[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (input[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ kind: "string", value: input.slice(start, i), start, end: i });
      continue;
    }

    const multi = longestOperatorAt(input, i);
    if (multi) {
      tokens.push({ kind: "operator", value: multi, start: i, end: i + multi.length });
      i += multi.length;
      continue;
    }

    if ("(){}[],;:.".includes(c)) {
      tokens.push({ kind: "symbol", value: c, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (/\d/.test(c)) {
      const start = i++;
      while (i < input.length && /[\d._a-zA-Z:-]/.test(input[i] ?? "")) i++;
      tokens.push({ kind: "number", value: input.slice(start, i), start, end: i });
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const start = i++;
      while (i < input.length && /[A-Za-z0-9_-]/.test(input[i] ?? "")) i++;
      const raw = input.slice(start, i);
      const upper = raw.toUpperCase();
      tokens.push({ kind: KEYWORDS.has(upper) ? "keyword" : "identifier", value: KEYWORDS.has(upper) ? upper : raw, start, end: i });
      continue;
    }

    tokens.push({ kind: "symbol", value: c, start: i, end: i + 1 });
    i++;
  }

  return tokens;
}

/**
 * Parses KQL enough for offline diagnostics.
 *
 * @param input - KQL source text.
 * @returns Tokens and lint diagnostics.
 */
export function parseKql(input: string): ParseResult {
  const diagnostics: KqlDiagnostic[] = [];

  if (input.length > MAX_QUERY_LENGTH) {
    addDiagnostic(diagnostics, {
      message: "KQL query text is too large for offline diagnostics.",
      start: MAX_QUERY_LENGTH,
      end: Math.min(input.length, MAX_QUERY_LENGTH + 1),
      severity: "warning"
    });
    return { tokens: [], diagnostics };
  }

  const tokens = tokenize(input);

  validateUnterminatedTokens(tokens, diagnostics);
  validateDelimiters(tokens, diagnostics);
  validatePipeOperators(tokens, diagnostics);
  validateLetStatements(tokens, diagnostics);

  return { tokens, diagnostics };
}

/**
 * Formats common pipe-oriented KQL. Documents containing comments are returned
 * with only trailing whitespace normalized so formatting never removes comments.
 *
 * @param input - KQL source text.
 * @returns Formatted KQL text ending with a newline when non-empty.
 */
export function formatKql(input: string): string {
  if (input.length > MAX_QUERY_LENGTH) return input;

  const tokens = tokenize(input);
  if (tokens.length === 0) return input.trim();
  if (tokens.some((token) => token.kind === "comment")) return `${input.trimEnd()}\n`;

  const statements = splitStatements(tokens);
  const formatted = statements.map(formatStatement).filter(Boolean).join("\n");
  return formatted ? `${formatted}\n` : "";
}

function longestOperatorAt(input: string, start: number): string | undefined {
  const operators = ["!contains", "!has", "!startswith", "!endswith", "!in~", "==", "!=", "<=", ">=", "=~", "!~", "in~", "!in", "=>", "|", "=", "<", ">", "+", "-", "*", "/", "%"];
  return operators.find((operator) => input.startsWith(operator, start));
}

function validateUnterminatedTokens(tokens: Token[], diagnostics: KqlDiagnostic[]): void {
  for (const token of tokens) {
    if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    if (token.kind === "string") {
      const first = token.value[0];
      if (!first || token.value.length === 1 || token.value[token.value.length - 1] !== first) {
        addDiagnostic(diagnostics, { message: "Unterminated string literal.", start: token.start, end: token.end, severity: "error" });
      }
    }
    if (token.kind === "comment" && token.value.startsWith("/*") && !token.value.endsWith("*/")) {
      addDiagnostic(diagnostics, { message: "Unterminated block comment.", start: token.start, end: token.end, severity: "error" });
    }
  }
}

function validateDelimiters(tokens: Token[], diagnostics: KqlDiagnostic[]): void {
  const stack: Token[] = [];
  const pairs = new Map([[")", "("], ["]", "["], ["}", "{"]]);
  for (const token of tokens) {
    if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    if (token.kind === "comment" || token.kind === "string") continue;
    if (["(", "[", "{"].includes(token.value)) stack.push(token);
    if ([")", "]", "}"].includes(token.value)) {
      const expected = pairs.get(token.value);
      const open = stack.pop();
      if (!open || open.value !== expected) {
        addDiagnostic(diagnostics, { message: `Unmatched closing ${delimiterName(token.value)}.`, start: token.start, end: token.end, severity: "error" });
      }
    }
  }
  for (const open of stack) {
    if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    addDiagnostic(diagnostics, { message: `Unmatched opening ${delimiterName(open.value)}.`, start: open.start, end: open.end, severity: "error" });
  }
}

function validatePipeOperators(tokens: Token[], diagnostics: KqlDiagnostic[]): void {
  let depth = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) continue;
    if (["(", "[", "{"].includes(token.value)) depth++;
    if ([")", "]", "}"].includes(token.value)) depth = Math.max(0, depth - 1);
    if (token.value !== "|" || depth !== 0) continue;
    const next = nextSignificant(tokens, index + 1);
    if (!next) {
      addDiagnostic(diagnostics, { message: "Pipe operator should be followed by a KQL tabular operator.", start: token.start, end: token.end, severity: "error" });
      continue;
    }
    if (next.kind !== "keyword" && next.kind !== "identifier") continue;
    if (!PIPE_OPERATORS.has(next.value.toUpperCase())) {
      addDiagnostic(diagnostics, { message: `Unknown or uncommon pipe operator '${next.value}'.`, start: next.start, end: next.end, severity: "warning" });
    }
  }
}

function validateLetStatements(tokens: Token[], diagnostics: KqlDiagnostic[]): void {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token?.kind !== "keyword" || token.value !== "LET") continue;
    let cursor = index + 1;
    let depth = 0;
    let foundEquals = false;
    let foundTerminator = false;
    while (cursor < tokens.length) {
      const current = tokens[cursor];
      if (!current) break;
      if (["(", "[", "{"].includes(current.value)) depth++;
      if ([")", "]", "}"].includes(current.value)) depth = Math.max(0, depth - 1);
      if (current.value === "=") foundEquals = true;
      if (current.value === ";" && depth === 0) {
        foundTerminator = true;
        break;
      }
      if (current.value === "|" && depth === 0 && !foundTerminator) break;
      cursor++;
    }
    if (!foundEquals) {
      addDiagnostic(diagnostics, { message: "LET statement should assign a name with '='.", start: token.start, end: token.end, severity: "warning" });
    } else if (!foundTerminator) {
      addDiagnostic(diagnostics, { message: "LET statement should end with a semicolon before the query body.", start: token.start, end: token.end, severity: "warning" });
    }
  }
}

function addDiagnostic(diagnostics: KqlDiagnostic[], diagnostic: KqlDiagnostic): void {
  if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(diagnostic);
}

function nextSignificant(tokens: Token[], start: number): Token | undefined {
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index];
    if (token && token.kind !== "comment") return token;
  }
  return undefined;
}

function delimiterName(value: string): string {
  if (value === "(" || value === ")") return "parenthesis";
  if (value === "[" || value === "]") return "bracket";
  return "brace";
}

function splitStatements(tokens: Token[]): Token[][] {
  const statements: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    current.push(token);
    if (["(", "[", "{"].includes(token.value)) depth++;
    if ([")", "]", "}"].includes(token.value)) depth = Math.max(0, depth - 1);
    if (token.value === ";" && depth === 0) {
      statements.push(current);
      current = [];
    }
  }
  if (current.length > 0) statements.push(current);
  return statements;
}

function formatStatement(tokens: Token[]): string {
  const segments: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (["(", "[", "{"].includes(token.value)) depth++;
    if ([")", "]", "}"].includes(token.value)) depth = Math.max(0, depth - 1);
    if (token.value === "|" && depth === 0) {
      if (current.length > 0) segments.push(current);
      current = [token];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) segments.push(current);

  return segments.map((segment, index) => formatSegment(segment, index > 0)).join("\n");
}

function formatSegment(tokens: Token[], isPipe: boolean): string {
  const text = tokensToText(tokens);
  const logicalLines = splitTopLevelLogical(tokens);
  if (logicalLines.length <= 1) return text;
  const [first, ...rest] = logicalLines;
  const prefix = isPipe ? "| " : "";
  const firstText = first ? tokensToText(first).replace(/^\|\s*/, "") : "";
  return [`${prefix}${firstText}`, ...rest.map((line) => `    ${tokensToText(line)}`)].join("\n");
}

function splitTopLevelLogical(tokens: Token[]): Token[][] {
  const lines: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;
  for (const token of tokens) {
    if (["(", "[", "{"].includes(token.value)) depth++;
    if ([")", "]", "}"].includes(token.value)) depth = Math.max(0, depth - 1);
    if (depth === 0 && token.kind === "keyword" && (token.value === "AND" || token.value === "OR")) {
      if (current.length > 0) lines.push(current);
      current = [token];
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function tokensToText(tokens: Token[]): string {
  let output = "";
  let previous: Token | undefined;
  let beforePrevious: Token | undefined;
  let depth = 0;
  for (const token of tokens) {
    const currentDepth = depth;
    if (token.value === ";") output = `${output.trimEnd()};`;
    else if (token.value === ",") output = `${output.trimEnd()}, `;
    else if ([")", "]", "}"].includes(token.value)) output = `${output.trimEnd()}${token.value}`;
    else if (["(", "[", "{"].includes(token.value)) output = `${output.trimEnd()}${token.value}`;
    else if (token.value === ".") output = `${output.trimEnd()}.`;
    else if (token.value === "|" && currentDepth === 0) output = "| ";
    else if (token.value === "|") output = `${output.trimEnd()} | `;
    else if ((token.value === "-" || token.value === "+") && isUnaryOperator(previous)) output = `${output.trimEnd()}${token.value}`;
    else if (token.kind === "operator") output = `${output.trimEnd()} ${token.value} `;
    else output += `${needsSpace(output, previous, beforePrevious) ? " " : ""}${token.value}`;
    if (["(", "[", "{"].includes(token.value)) depth++;
    if ([")", "]", "}"].includes(token.value)) depth = Math.max(0, depth - 1);
    beforePrevious = previous;
    previous = token;
  }
  return output.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

function isUnaryOperator(previous: Token | undefined): boolean {
  if (!previous) return true;
  if (["(", "[", "{", ",", ":", "=", "==", "!=", "<=", ">=", "<", ">", "=~", "!~"].includes(previous.value)) return true;
  return previous.kind === "operator" && previous.value !== ")";
}

function needsSpace(output: string, previous: Token | undefined, beforePrevious: Token | undefined): boolean {
  if (previous && (previous.value === "-" || previous.value === "+") && isUnaryOperator(beforePrevious)) return false;
  return output.length > 0 && !/[\s([{.]$/.test(output);
}
