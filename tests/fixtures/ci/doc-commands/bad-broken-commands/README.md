# Seeded fixture README

Three deliberately broken documented commands, plus valid ones that must not trip.

```bash
curl -fsSL https://raw.githubusercontent.com/example/repo/main/install.sh | bash
```

```bash
bash install.sh --autoconfirm
```

```bash
claude plugin marketplace register example/repo
```

Valid — these must NOT be flagged:

```bash
bash install.sh --yes
bash install.sh --local --dry-run
claude plugin install example@example
claude plugin marketplace add example/repo
```
