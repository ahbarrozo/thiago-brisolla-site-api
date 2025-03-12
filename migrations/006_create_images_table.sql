CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100),
    description VARCHAR(255),
    path TEXT NOT NULL
);
