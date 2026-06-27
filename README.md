# KQL for Visual Studio Code

Offline language support for Kusto Query Language (`.kql` and `.csl`) files.

## Features

- Tokenization for KQL keywords, identifiers, literals, comments, operators, and symbols.
- Document formatting for pipe-oriented KQL queries.
- Lint diagnostics for unmatched delimiters, unterminated strings/comments, and common query-shape issues.
- Completion suggestions for common KQL keywords, functions, operators, scalar types, and pipe operators.

This extension intentionally provides offline language features only and does not connect to Azure Data Explorer.

## Development

```sh
npm ci
npm run compile
npm test
```

This artifact was produced with AI assistance and should be reviewed by a
qualified professional before use as compliance evidence, legal submission, or
external distribution.
