CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    address TEXT,
    contact TEXT NOT NULL,
    mail TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    last_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
