# Deviation – FR-17 document vault storage

| | |
|---|---|
| Date | 28-10-2026 |
| Requirement / design | FR-17, SAD CMP-09, DS-02 (MongoDB) |
| Document says | Vault documents and metadata kept in the MongoDB document store |
| What we did | Metadata in the PostgreSQL `documents` table; file bytes in a private `uploads/` folder (outside `public/`, git-ignored) under random names. Downloads only through the authenticated `GET /api/vault/{id}/file` |
| Why | One database to install, back up and test; ownership checks reuse the same `user_id` pattern as every other table (SR-05). File type is checked from the file's first bytes, not its name (SR-07) |
| Also | Closes the README open item "Authenticated download for vault files" |
| Author | Likith Kumar |