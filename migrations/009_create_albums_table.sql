CREATE TABLE albums (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    description TEXT NOT NULL,
    title TEXT NOT NULL,
    last_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE albums_images (
    album_id INTEGER REFERENCES albums(id),
    image_id INTEGER REFERENCES images(id),
    PRIMARY KEY (album_id, image_id)
);

