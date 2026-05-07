-- Courts: all London Clubspark venues seeded from LTA API
CREATE TABLE courts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  venue_uuid           TEXT UNIQUE NOT NULL,
  clubspark_slug       TEXT,
  address              TEXT,
  postcode             TEXT,
  lat                  DECIMAL(9,6),
  lng                  DECIMAL(9,6),
  drop_day_offset      INTEGER,         -- days before desired date that booking opens (e.g. 7)
  drop_time            TIME,            -- time bookings open, e.g. 22:00
  drop_time_confidence TEXT DEFAULT 'unknown' CHECK (drop_time_confidence IN ('unknown', 'learned', 'confirmed')),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- One observation per (court, date): records when a date first appeared as bookable
CREATE TABLE drop_observations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id       UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  observed_date  DATE NOT NULL,       -- the calendar date that became available
  first_seen_at  TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (court_id, observed_date)
);

-- User notification alerts
CREATE TABLE alerts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  court_id           UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  desired_date       DATE NOT NULL,
  desired_time_start TIME NOT NULL,   -- e.g. 14:00
  notify_at          TIMESTAMPTZ,     -- NULL until drop time is known
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON alerts (notify_at) WHERE sent_at IS NULL;
CREATE INDEX ON alerts (court_id) WHERE notify_at IS NULL AND sent_at IS NULL;
CREATE INDEX ON drop_observations (court_id, first_seen_at);
