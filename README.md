# KQL for Visual Studio Code

Offline language support for Kusto Query Language (`.kql` and `.csl`) files.

## Features

- Tokenization for KQL keywords, identifiers, literals, comments, operators, and symbols.
- Document formatting for pipe-oriented KQL queries.
- Lint diagnostics for unmatched delimiters, unterminated strings/comments, and common query-shape issues.
- Completion suggestions for common KQL keywords, functions, operators, scalar types, and pipe operators.

This extension intentionally provides offline language features only and does not connect to Azure Data Explorer.
Formatting is conservative for files that contain comments and for files larger
than the offline diagnostics limit.

## Development

```sh
npm ci
npm run compile
npm test
```

## Security checks

The repository includes pre-commit and CI checks for TruffleHog secret scanning
and Semgrep static analysis.

Install TruffleHog and Semgrep before enabling the hook. On Windows, one option
is Chocolatey for TruffleHog and pipx for Semgrep:

```sh
choco install trufflehog
pipx install semgrep
```

Confirm both tools are on `PATH`. If pipx adds a new directory to `PATH`, open a
new shell before running these checks:

```sh
trufflehog --version
semgrep --version
```

Install the local hooks with either option:

```sh
pre-commit install --hook-type pre-commit
```

or:

```sh
git config core.hooksPath .githooks
```

Run the same scans manually:

```sh
npm run security
```

This artifact was produced with AI assistance and should be reviewed by a
qualified professional before use as compliance evidence, legal submission, or
external distribution.
