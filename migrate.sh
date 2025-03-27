#!/bin/bash
# Script to run migrations in a PostgreSQL. It will : 
# 1 - Check if a schema_migrations table exists
# 1b - If it doesn't exist, it will create one
# 2 - Loop through all SQL script files in the migrations 
# 3 - Check via the schema_migrations table if a given
#     script was already executed
# 3b - Run if not executed
set -e  # Exit immediately if a command exits with a non-zero status

DB_USER="thiago_brisolla"
DB_NAME="thiago_brisolla"
DB_HOST="localhost"

# Prompt for password (input will be hidden)
read -sp "Enter PostgreSQL password for $DB_USER : " PGPASSWORD
echo ""  # Add a newline after password input

# Export the password so psql can use it
export PGPASSWORD

# Check if schema_migrations table exists, create if it doesn't
echo "Checking if schema_migrations table exists..."
table_exists=$(psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations')")

if [[ $table_exists == *"f"* ]]; then
  echo "Creating schema_migrations table..."
  psql -U $DB_USER -h $DB_HOST -d $DB_NAME -c "CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )"
  echo "Table created successfully."
else
  echo "schema_migrations table already exists."
fi

# Apply pending migrations
echo "Checking for pending migrations..."
for file in migrations/*.sql; do
  version=$(basename "$file" .sql) #strips file extension and directories from the file path
  if ! psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
    echo "Applying migration: $file"
    psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f "$file"
    psql -U $DB_USER -h $DB_HOST -d $DB_NAME -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
  fi
done

# Clear the password from environment when done
unset PGPASSWORD

echo "All migrations complete."
