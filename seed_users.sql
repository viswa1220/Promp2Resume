-- Local seed for "User" table (10 rows from User_rows.csv)
-- Run against local Supabase/Postgres, e.g.:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f seed_users.sql

CREATE TABLE IF NOT EXISTS "User" (
    "id"                  TEXT PRIMARY KEY,
    "name"                TEXT,
    "email"               TEXT UNIQUE NOT NULL,
    "passwordHash"        TEXT NOT NULL,
    "role"                TEXT        NOT NULL DEFAULT 'user',
    "approved"            BOOLEAN     NOT NULL DEFAULT FALSE,
    "plan"                TEXT        NOT NULL DEFAULT 'free',
    "planRenewsAt"        TIMESTAMPTZ,
    "dailyDownloadLimit"  INTEGER     NOT NULL DEFAULT 0,
    "bonusDownloads"      INTEGER     NOT NULL DEFAULT 0,
    "bonusExpires"        TIMESTAMPTZ,
    "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "lastLoginAt"         TIMESTAMPTZ,
    "dailyLearningEmail"  BOOLEAN     NOT NULL DEFAULT FALSE,
    "lastLearningEmailAt" TIMESTAMPTZ,
    "learnLevel"          TEXT,
    "learnTech"           TEXT,
    "tokenVersion"        INTEGER     NOT NULL DEFAULT 0,
    "learnStreak"         INTEGER     NOT NULL DEFAULT 0,
    "learnStreakAt"       TIMESTAMPTZ
);


INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "approved", "plan", "planRenewsAt", "dailyDownloadLimit", "bonusDownloads", "bonusExpires", "createdAt", "lastLoginAt", "dailyLearningEmail", "lastLearningEmailAt", "learnLevel", "learnTech", "tokenVersion", "learnStreak", "learnStreakAt") VALUES
    ('cmqdb5ec60000329c6l355tby', 'Admin', 'viswanathan122000@gmail.com', '$2a$10$pZuX2khWT0GXeP768z2Xy.SYD/kQ7wt.FaQIfnbMVNvc7YnUohgf.', 'admin', TRUE, 'pro', NULL, 999, 0, NULL, '2026-06-14 04:52:18.774', '2026-06-28 18:10:09.937', TRUE, '2026-06-30 07:30:08.374', 'beginner', 'python', 4, 1, '2026-06-28 16:06:35.486'),
    ('cmqdxggws000410f8kchbjs7p', 'Ramyasree L', 'ramyasreeslr@gmail.com', '$2a$10$bpcVC/x2h9VW4R1KNGDvpO3mXhDrK/YyXvEMPBs38shG.fXh.8cPi', 'user', TRUE, 'free', NULL, 2, 0, NULL, '2026-06-14 15:16:46.876', '2026-06-14 15:58:02.778', FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqdyqqyf000710f8e51wevby', 'Guru Prakash', 'vijaiguru152000@gmail.com', '$2a$10$ssxS5P2/4TzoeqxHf3DgTO0ECFMKOclGSvJH4/PjNXJ5pIBNTB626', 'user', TRUE, 'free', NULL, 2, 0, NULL, '2026-06-14 15:52:46.072', '2026-06-14 15:54:42.966', FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqdyu36c000810f8ee4vfx1r', 'Mathan Kumar', 'mkofficial6329@gmail.com', '$2a$10$4PVbG0LnbMq3jaJPGdvRiOgfOJJxpatR27LSMqSPA0rLNgTssQleW', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-14 15:55:21.876', '2026-06-14 15:55:53.085', FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqekm9cd0000s7mzjvbmls8q', 'Ram Prasad Janarthanan', 'ramprasad19992011@gmail.com', '$2a$10$SdcjPI3j0.6X3THG2hPLD.dCjcKHvrad1BGElUHDzVUp36063Xxam', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-15 02:05:08.173', NULL, FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqgx40dr0000rh90vpv5zazq', 'Vijay', 'vijaykrishna.oh@gmail.com', '$2a$10$qAms2XcZ/1SOHRGJVZK6fOw.7EMhaqCCDKrlT35OKcLfDq7r6r0V2', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-16 17:30:24.111', '2026-06-29 11:20:38.854', FALSE, NULL, 'beginner', NULL, 0, 1, '2026-06-28 14:21:11.657'),
    ('cmqls6we80000lfnt9l1ti8ky', 'Karthikeyan', 'karthikeyannaran@gmail.com', '$2a$10$W4vx3Zx4ZZErDIlZAEXSbOfNvyqkyHEQcgpsZ5sNXS3Eb7WZLNIcu', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-20 03:11:31.712', NULL, FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqx4mzun0000hyb72n21nnq5', 'Viswa', 'v.viswanathan.ca@gmail.com', '$2a$10$Q3v4MnToQUn6Cnvqpg0aYO/Foe.sHmZ1zCCCMe6woO92BPXgsmd3e', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-28 01:45:26.015', '2026-06-29 23:02:54.579', TRUE, '2026-06-30 07:30:19.414', 'advanced', 'Agentic ai', 2, 0, NULL),
    ('cmqx5ovf80002hyb7ekuaacod', 'Sowmiya', 'sowmiyaparamasivam0405@gmail.com', '$2a$10$q5VwTfKdz9DRiJV9esvH7uqHVBrTB8FoUay1r8q73HJcsP/2uD.dy', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-28 02:14:53.204', '2026-06-28 04:50:14.396', FALSE, NULL, 'beginner', NULL, 0, 0, NULL),
    ('cmqzqn149000jhd97pdmyee7c', 'Hare', 'ca.harekrishna1495@gmail.com', '$2a$10$zk8qvbDKZzbbmZ2H6i/Vv.ehoRJHdlLhgE.1ta7pqCsluGOwoRSQi', 'user', TRUE, 'free', NULL, 3, 0, NULL, '2026-06-29 21:36:51.561', '2026-06-29 21:37:37.489', FALSE, NULL, 'beginner', NULL, 0, 0, NULL)
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "email" = EXCLUDED."email",
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "approved" = EXCLUDED."approved",
    "plan" = EXCLUDED."plan",
    "planRenewsAt" = EXCLUDED."planRenewsAt",
    "dailyDownloadLimit" = EXCLUDED."dailyDownloadLimit",
    "bonusDownloads" = EXCLUDED."bonusDownloads",
    "bonusExpires" = EXCLUDED."bonusExpires",
    "createdAt" = EXCLUDED."createdAt",
    "lastLoginAt" = EXCLUDED."lastLoginAt",
    "dailyLearningEmail" = EXCLUDED."dailyLearningEmail",
    "lastLearningEmailAt" = EXCLUDED."lastLearningEmailAt",
    "learnLevel" = EXCLUDED."learnLevel",
    "learnTech" = EXCLUDED."learnTech",
    "tokenVersion" = EXCLUDED."tokenVersion",
    "learnStreak" = EXCLUDED."learnStreak",
    "learnStreakAt" = EXCLUDED."learnStreakAt";
