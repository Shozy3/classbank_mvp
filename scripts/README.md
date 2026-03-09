# Seeding

Initialize and seed the local SQLite database:

```bash
python scripts/seed.py --db data/app.db --schema schema.sql --fixture fixtures/sample-course-data.json --reset