# Evaluations

Each directory under `cases/` is a reproducible forward-eval input. A case
contains only the user-like prompt and raw assets the builder is allowed to
see:

```text
cases/<case-id>/
├── prompt.md
└── input/
```

Rubrics are stored separately under `rubrics/` and are never copied into the
builder workspace. Ground-truth implementations live under `examples/`; they
are grader inputs, not builder inputs.

## Run a case

From the repository root:

```bash
python3 evals/run_eval.py hawaii-v1
```

The runner validates the case, syncs the repository Skill into `~/.codex`,
runs Codex in an isolated temporary workspace containing only `input/`, then
archives the workspace, prompt, logs, final message, and manifest under
`results/<case-id>/<run-id>/`.

The manifest records the Skill's Git-derived version, exact commit, source and
installed content hashes, dirty state, Codex version, prompt, and input hash.
This makes tagged releases and unreleased local candidates distinguishable.

Preview the operation without syncing or starting Codex:

```bash
python3 evals/run_eval.py hawaii-v1 --dry-run
```

Optional overrides:

```bash
python3 evals/run_eval.py hawaii-v1 --model MODEL_NAME
python3 evals/run_eval.py hawaii-v1 --results-dir /absolute/path/to/results
```

`results/` is gitignored. Do not commit generated applications, dependency
folders, credentials, or session data.

## Grade a run

Use a fresh Codex task. Give the grader the archived `workspace/`, the matching
ground truth under `examples/`, and `rubrics/photo-flipbook-v1.json`. Do not ask
the builder that created the output to grade itself.

Record criterion-level evidence, elapsed time, build/test status, manual
interventions, total score, and hard failures. A production-build failure,
incorrect page order/pairing, or unusable mobile interaction is a hard failure
regardless of numeric score.
