CREATE TABLE blog_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE blog_posts_images (
    blog_post_id INTEGER REFERENCES blog_posts(id),
    image_id INTEGER REFERENCES images(id),
    PRIMARY KEY (blog_post_id, image_id)
);

