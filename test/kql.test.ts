import { describe, expect, it } from "vitest";
import { COMPLETION_FUNCTIONS, COMPLETION_KEYWORDS, formatKql, parseKql, tokenize } from "../src/kql";

describe("KQL language core", () => {
  it("tokenizes KQL keywords, identifiers, strings, comments, and operators", () => {
    const tokens = tokenize("StormEvents | where State == 'TEXAS' // state filter");
    expect(tokens.map((token) => token.value)).toEqual(["StormEvents", "|", "WHERE", "State", "==", "'TEXAS'", "// state filter"]);
    expect(tokens.map((token) => token.kind)).toEqual(["identifier", "operator", "keyword", "identifier", "operator", "string", "comment"]);
  });

  it("formats common pipe-oriented queries", () => {
    expect(formatKql("StormEvents|where State=='TEXAS' and DamageProperty>1000|summarize Count=count() by EventType|order by Count desc")).toBe(
      "StormEvents\n| WHERE State == 'TEXAS'\n    AND DamageProperty > 1000\n| SUMMARIZE Count = count() BY EventType\n| ORDER BY Count DESC\n"
    );
  });

  it("formats nested pipelines and unary operators without top-level splitting", () => {
    expect(formatKql("let c=toscalar(StormEvents|count);StormEvents|where Duration > ago(-1d)|take c")).toBe(
      "LET c = toscalar(StormEvents | count);\nStormEvents\n| WHERE Duration > ago(-1d)\n| TAKE c\n"
    );
  });

  it("keeps let statements and query body on separate formatted lines", () => {
    expect(formatKql("let threshold=10;StormEvents|take threshold")).toBe("LET threshold = 10;\nStormEvents\n| TAKE threshold\n");
  });

  it("does not remove comments when formatting", () => {
    expect(formatKql("StormEvents | take 10 // keep this comment   ")).toBe("StormEvents | take 10 // keep this comment   ");
  });

  it("formats between ranges with conventional spacing", () => {
    expect(formatKql("StormEvents | where Timestamp between (datetime(2024-01-01) .. datetime(2024-01-02))")).toBe(
      "StormEvents\n| WHERE Timestamp BETWEEN (datetime(2024-01-01) .. datetime(2024-01-02))\n"
    );
  });

  it("reports unmatched delimiters and unterminated strings", () => {
    const result = parseKql("StormEvents | where (State == 'TEXAS");
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain("Unterminated string literal.");
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain("Unmatched opening parenthesis.");
  });

  it("reports uncommon pipe operators", () => {
    const result = parseKql("StormEvents | wherex State == 'TEXAS'");
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain("Unknown or uncommon pipe operator 'wherex'.");
  });

  it("does not report nested pipe operators inside let expressions", () => {
    const result = parseKql("let c = toscalar(StormEvents | count); StormEvents | take c");
    expect(result.diagnostics).toEqual([]);
  });

  it("caps diagnostics and skips tokenization for oversized documents", () => {
    const capped = parseKql("(".repeat(500));
    expect(capped.diagnostics).toHaveLength(200);

    const oversized = parseKql("StormEvents\n".repeat(110_000));
    expect(oversized.tokens).toEqual([]);
    expect(oversized.diagnostics.map((diagnostic) => diagnostic.message)).toContain("KQL query text is too large for offline diagnostics.");
  });

  it("caps token-heavy diagnostics before expensive validation", () => {
    const startedAt = Date.now();
    const result = parseKql("let a = 1 ".repeat(50_000));

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.message).toBe("KQL query has too many tokens for full offline diagnostics.");
  });

  it("reports let statements without semicolons", () => {
    const result = parseKql("let threshold = 10 StormEvents | take threshold");
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain("LET statement should end with a semicolon before the query body.");
  });

  it("provides core completion groups", () => {
    expect(COMPLETION_KEYWORDS).toContain("summarize");
    expect(COMPLETION_FUNCTIONS).toContain("datetime()");
  });
});
