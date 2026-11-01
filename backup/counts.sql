-- The row count of every table of the public schema, one "table count" line
-- each, sorted by table. backup.sh stores it in the snapshot as
-- row-counts.txt; restore.sh runs it on the restored database and compares.
SELECT table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
