# Database Migrations

This directory contains incremental database migrations for the Notification Service.

## How It Works

1. **Base Schema**: The `sql/init.sql` file contains the base database schema
2. **Migrations**: This directory contains incremental changes numbered sequentially (001_, 002_, etc.)
3. **Tracking**: A `migrations_log` table tracks which migrations have been executed
4. **Automatic**: Migrations run automatically in development mode when the server starts
5. **Manual**: Run `npm run migrate` to manually execute migrations

## Migration Naming Convention

Migrations should be named with a sequential number prefix:
- `001_add_scheduled_at_column.sql`
- `002_add_user_preferences.sql`
- `003_add_analytics_tables.sql`

## Creating a New Migration

1. Create a new `.sql` file in this directory with the next sequential number
2. Write idempotent SQL (use `IF NOT EXISTS`, `IF EXISTS`, etc.)
3. Test the migration locally
4. Commit the migration file
5. The migration will run automatically on next deployment

## Running Migrations

### Automatic (Development)
Migrations run automatically when you start the server in development mode:
```bash
npm run dev
```

### Manual
To manually run migrations:
```bash
npm run migrate
```

## Migration Best Practices

1. **Idempotent**: Always use `IF NOT EXISTS` or `IF EXISTS` to make migrations safe to run multiple times
2. **Transactional**: Each migration runs in a transaction and rolls back on error
3. **Sequential**: Number migrations sequentially (001, 002, 003, etc.)
4. **Tested**: Test migrations locally before deploying
5. **Documented**: Add comments explaining what the migration does

## Current Migrations

- `001_add_scheduled_at_column.sql` - Adds scheduled_at column for scheduled notifications

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message in the console
2. Fix the migration SQL
3. Delete the failed entry from `migrations_log` table
4. Run the migration again

### Check Migration Status
Query the migrations_log table to see which migrations have been run:
```sql
SELECT * FROM migrations_log ORDER BY executed_at DESC;
```

### Reset Migrations (Development Only)
To reset all migrations and start fresh:
```sql
DROP TABLE migrations_log;
```
Then restart the server or run `npm run migrate`.
