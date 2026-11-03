"use client";

import React, { useMemo } from "react";

export interface SyntaxHighlighterProps {
  code: string;
  language?: "tsx" | "typescript" | "javascript" | "css" | "prisma" | "markdown" | "json";
  highlightedLine?: number | null;
  onLineClick?: (lineIndex: number, lineText: string) => void;
  className?: string;
  showLineNumbers?: boolean;
}

const JS_KEYWORDS = new Set([
  "import",
  "export",
  "default",
  "function",
  "const",
  "let",
  "var",
  "return",
  "await",
  "async",
  "interface",
  "type",
  "from",
  "if",
  "else",
  "for",
  "while",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "class",
  "extends",
  "implements",
  "null",
  "undefined",
  "true",
  "false",
  "switch",
  "case",
  "break",
  "continue",
  "yield",
  "as",
  "typeof",
  "instanceof",
  "in",
  "of",
]);

const BUILTIN_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "any",
  "void",
  "unknown",
  "never",
  "object",
  "symbol",
  "bigint",
  "Record",
  "Array",
  "Promise",
  "ReactNode",
  "FC",
  "React",
  "String",
  "Int",
  "Float",
  "Boolean",
  "DateTime",
  "Json",
]);

/**
 * Tokenize a single line of code into categorized chunks.
 */
function tokenizeLine(line: string, language: string): React.ReactNode[] {
  if (!line) {
    return [" "];
  }

  const trimmed = line.trim();

  // Full-line comments
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("--") ||
    trimmed.startsWith("# ")
  ) {
    return [
      <span key="comment" className="ll:text-muted ll:italic">
        {line}
      </span>,
    ];
  }

  // Tokenize using regex covering strings, words, and delimiters
  const tokenRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*|"[^"]*"|'[^']*'|`[^`]*`|<\/?[a-zA-Z0-9_-]+|[{}()[\]:;,.=><!&|?+\-*/%^~]|[\s]+)/g;
  const rawParts = line.match(tokenRegex) || [line];

  return rawParts.map((token, i) => {
    // Whitespace
    if (/^\s+$/.test(token)) {
      return <span key={i}>{token}</span>;
    }

    // String literals
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'")) ||
      (token.startsWith("`") && token.endsWith("`"))
    ) {
      return (
        <span key={i} className="ll:text-secondary ll:font-normal">
          {token}
        </span>
      );
    }

    // JSX tags: <section, </section>, <h1>, etc.
    if (token.startsWith("<") || token.startsWith("</")) {
      return (
        <span key={i} className="ll:text-primary ll:font-medium">
          {token}
        </span>
      );
    }

    // Keywords
    if (JS_KEYWORDS.has(token)) {
      return (
        <span key={i} className="ll:text-primary ll:font-semibold">
          {token}
        </span>
      );
    }

    // Types
    if (
      BUILTIN_TYPES.has(token) ||
      (language === "prisma" && ["model", "datasource", "generator", "enum"].includes(token)) ||
      (/^[A-Z][a-zA-Z0-9]+$/.test(token) && token.length > 2)
    ) {
      return (
        <span key={i} className="ll:text-primary ll:font-medium">
          {token}
        </span>
      );
    }

    // Numbers
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      return (
        <span key={i} className="ll:text-secondary">
          {token}
        </span>
      );
    }

    // Operators / Delimiters
    if (/^[{}()[\]:;,.=><!&|?+\-*/%^~]$/.test(token)) {
      return (
        <span key={i} className="ll:text-muted">
          {token}
        </span>
      );
    }

    // Default identifier / property
    return (
      <span key={i} className="ll:text-secondary">
        {token}
      </span>
    );
  });
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  code,
  language = "tsx",
  highlightedLine,
  onLineClick,
  className = "",
  showLineNumbers = true,
}) => {
  const lines = useMemo(() => {
    return code.split("\n");
  }, [code]);

  return (
    <pre
      tabIndex={0}
      aria-label="Code viewer"
      className={`ll:m-0 ll:p-4 ll:font-mono ll:text-small ll:leading-relaxed ll:text-secondary ll:whitespace-pre ll:overflow-auto ll:h-full ll:w-full ll:box-border ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${className}`}
      style={{
        counterReset: showLineNumbers ? "ln" : undefined,
      }}
    >
      <code>
        {lines.map((line, idx) => {
          const isHighlighted = highlightedLine === idx;

          return (
            <span
              key={idx}
              data-line-index={idx}
              data-highlighted={isHighlighted ? "true" : undefined}
              onClick={() => onLineClick?.(idx, line)}
              className={`ll:block ll:min-h-5 ll:transition-colors ll:duration-75 ${
                onLineClick ? "ll:cursor-pointer ll:hover:bg-surface-hover" : ""
              } ${
                isHighlighted
                  ? "ll:bg-select-bg ll:text-select-fg ll:rounded-xs"
                  : ""
              }`}
              style={{
                counterIncrement: showLineNumbers ? "ln" : undefined,
              }}
            >
              {showLineNumbers && (
                <span
                  aria-hidden="true"
                  className={`ll:inline-block ll:w-7 ll:mr-4 ll:text-right ll:select-none ${
                    isHighlighted
                      ? "ll:text-primary ll:font-medium"
                      : "ll:text-muted"
                  }`}
                >
                  {idx + 1}
                </span>
              )}
              <span className="ll:inline">{tokenizeLine(line, language)}</span>
            </span>
          );
        })}
      </code>
    </pre>
  );
};
