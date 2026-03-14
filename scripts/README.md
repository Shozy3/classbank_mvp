# Seeding

Initialize and seed the local SQLite database:

```bash
python scripts/seed.py --db data/app.db --schema schema.sql --fixture fixtures/sample-course-data.json --reset
```

Use `--reset` for a clean local test dataset before smoke or acceptance runs.