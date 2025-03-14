CREATE TABLE about_sections (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    last_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE about_sections_images (
    about_section_id INTEGER REFERENCES about_sections(id),
    image_id INTEGER REFERENCES images(id),
    PRIMARY KEY (about_section_id, image_id)
);

