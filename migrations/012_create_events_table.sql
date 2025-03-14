CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    dates TEXT NOT NULL,
    link TEXT,
    location TEXT NOT NULL,
    name TEXT NOT NULL,
    last_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
