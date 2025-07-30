-- Query 1: Get detailed information about all tables and their columns in the 'public' schema

SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE ''
    END AS primary_key,
    CASE
        WHEN fk.column_name IS NOT NULL THEN
            'FOREIGN KEY REFERENCES ' || fk.foreign_table_name || '(' || fk.foreign_column_name || ')'
        ELSE ''
    END AS foreign_key_reference
FROM
    information_schema.columns AS c
LEFT JOIN (
    SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name
    FROM
        information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) AS pk
    ON c.table_schema = pk.table_schema
    AND c.table_name = pk.table_name
    AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM
        information_schema.key_column_usage AS kcu
    JOIN information_schema.table_constraints AS tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc -- Added referential_constraints
        ON tc.constraint_name = rc.constraint_name
        AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name -- Corrected join condition
        AND rc.unique_constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
) AS fk
    ON c.table_schema = fk.table_schema
    AND c.table_name = fk.table_name
    AND c.column_name = fk.column_name
WHERE
    c.table_schema = 'public' -- Focus on your 'public' schema
ORDER BY
    c.table_name,
    c.ordinal_position;

-- Query 2: Get information about all Row Level Security (RLS) policies
-- This will show you the policies you've created and their conditions.

SELECT
    nsp.nspname AS schema_name,
    tbl.relname AS table_name,
    pol.polname AS policy_name,
    CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE 'UNKNOWN'
    END AS command,
    pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression,
    (SELECT array_agg(rolname) FROM pg_roles WHERE oid = ANY(pol.polroles)) AS roles
FROM
    pg_policy AS pol
JOIN pg_class AS tbl ON pol.polrelid = tbl.oid
JOIN pg_namespace AS nsp ON tbl.relnamespace = nsp.oid
WHERE
    nsp.nspname = 'public' -- Focus on your 'public' schema
ORDER BY
    table_name, policy_name;
