ALTER TABLE albums 
    RENAME TO works
;

CREATE TABLE works_images (
    work_id INTEGER REFERENCES works(id),
    image_id INTEGER REFERENCES images(id),
    PRIMARY KEY (work_id, image_id)
);

DROP TABLE albums_images;

