# Create Photo Flipbook UI

A Codex skill for turning user-supplied photographs and visual references into
responsive, page-turning photo-book websites.

## Repository layout

- `skills/create-photo-flipbook-ui/`: the installable Codex skill
- `examples/vanilla-html-book/`: the dependency-free HTML reference implementation
- `evals/cases/`: blinded forward-eval inputs
- `evals/rubrics/`: grader-only scoring rubrics
- `evals/run_eval.py`: isolated Codex eval runner
- `tests/`: repository-level structural checks

The installed skill intentionally excludes examples, evals, and repository
documentation so Codex only loads the resources needed to do the task.
The example uses a null Sites project ID so it cannot accidentally target the
production deployment.

## Install from GitHub

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo HaichaoLihc/create-photo-flipbook-ui \
  --path skills/create-photo-flipbook-ui \
  --ref main
```

After a tagged release, replace `main` with a version such as `v0.2.0`.

## Validate

```bash
python3 tests/validate_repo.py
node --test examples/vanilla-html-book/test.mjs
```

Preview or run the Hawaii forward eval:

```bash
python3 evals/run_eval.py hawaii-v1 --dry-run
python3 evals/run_eval.py hawaii-v1
```

See `evals/README.md` for the isolation and grading workflow.
