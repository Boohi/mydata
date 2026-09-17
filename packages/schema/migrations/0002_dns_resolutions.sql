-- Responses are separate events, not additional query counts. Preserve old rows.
ALTER TABLE dns_queries ADD COLUMN event_kind TEXT NOT NULL DEFAULT 'query'
    CHECK (event_kind IN ('query', 'response'));
ALTER TABLE dns_queries ADD COLUMN resolved_ips TEXT NOT NULL DEFAULT '[]';
UPDATE meta SET value = '2' WHERE key = 'schema_version';
