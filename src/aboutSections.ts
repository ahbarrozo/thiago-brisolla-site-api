import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { Image, ImageDTO } from './types/Image.type';
import { AboutSection, AboutSectionDTO } from './types/AboutSection.type';
import { authMiddleware } from './auth';

const aboutSections = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all about section while joining all the images associated
 *  with them and ordering by post date. Then the result is 
 *  parsed to include all images in a single array inside the 
 *  images attribute.
 */
aboutSections.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT 
                asec.id, asec.text, 
                im.id AS image_id, im.path AS image_path,
                im.title AS image_title, im.description AS image_description 
            FROM 
                about_sections asec
            LEFT JOIN
                about_sections_images asi ON asec.id = asi.about_section_id
            LEFT JOIN
                images im ON asi.image_id = im.id
            ORDER BY 
                asec.id;
        `);

        const aboutSections = result.rows.reduce((rows, row) => {
            const image: Image | null = row.image_id ? 
            {
                id: row.image_id,
                description: row.image_description,
                path: row.image_path,
                title: row.image_title
            } : null;

            const existingAboutSection: AboutSection = rows.find((r: AboutSection) => r.id === row.id);

            if (existingAboutSection) {
                if (image)
                    existingAboutSection.images.push(image);
            } else {
                const aboutSection: AboutSection = {
                    id: row.id,
                    text: row.text,
                    images: []
                }

                if (image)
                    aboutSection.images.push(image);

                rows.push(aboutSection);
            }
            return rows;
        }, []);

        return c.json(aboutSections, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch about_sections.'}, 500);
    }
});

/**
 *  POST request to create a new about section entry. It will insert the 
 *  new rows at the about_sections, about_section_images and images tables
 */
aboutSections.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const aboutSection: AboutSectionDTO = {
            text: data.get('text')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());
        const aboutSectionQuery = await pool.query(`
            INSERT INTO 
                about_sections (text)
            VALUES 
                ($1)
            RETURNING 
                id;`,
            [aboutSection.text]
        );
        const aboutSectionId = aboutSectionQuery.rows[0].id;
        const resultImagesPromises = images.map(async (image) => {
            const result = await pool.query(`
                INSERT INTO 
                    images (description, path, title)
                VALUES 
                    ($1, $2, $3)
                RETURNING 
                    id;`, 
                [image.description, image.path, image.title]);

            return result.rows[0].id;
        });

        const resultImages = await Promise.all(resultImagesPromises);
        resultImages.forEach(async (imageId) => {
            await pool.query(`
                INSERT INTO 
                    about_sections_images (about_section_id, image_id)
                VALUES 
                    ($1, $2);`,
                [aboutSectionId, imageId]);
        });

        return c.json(resultImages, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new about section into DB'}, 500);
    }
});

/**
 *  PUT request to update a section based on its ID. It will 
 *  check its existence, fetch images associated with it, and update 
 *  all the fields available at the submission form, images included, 
 *  if needed
 */
aboutSections.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkAboutSection = await pool.query(`
            SELECT 
                id 
            FROM 
                about_sections 
            WHERE 
                id = $1;`,
            [id]);

        if(checkAboutSection.rows.length === 0) {
            return c.json({ error: 'About section not found' }, 404);
        }

        const data = await c.req.formData();
        const aboutSection: AboutSectionDTO = {
            text: data.get('text')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());

        await pool.query(`
            UPDATE 
                about_sections 
            SET 
                text = $1
            WHERE 
                id = $2
            RETURNING 
                id;`,
            [aboutSection.text, id]
        );
        
        const aboutSectionsImagesResults = await pool.query(`
            SELECT 
                asi.image_id, asi.about_section_id, 
                im.id, im.path, im.description, im.title 
            FROM 
                about_sections_images asi
            LEFT JOIN 
                images im ON im.id = asi.image_id
            WHERE 
                asi.about_section_id = $1;`,
            [id]
        );

        // separating between images to be deleted and upserted
        const imagesToDelete = aboutSectionsImagesResults.
                               rows.filter(im => 
                                   !(images.map(i => i.id)).includes(im.image_id)
                               );
        const imagesToUpsert = images.filter(im => 
                                   !im.id || !(imagesToDelete.map(i => i.id)).includes(im.id)
                               );

        imagesToDelete.forEach(async (im) => {
            await pool.query(`
                DELETE FROM 
                    about_sections_images 
                WHERE 
                    about_section_id = $1 AND image_id = $2`, 
                [id, im.id]);
        });

        // Check among images to insert if for no given ID. Else, update
        const imageIds = imagesToUpsert.map(async (image) => {
            if (!image.id) {
                const result = await pool.query(`
                    INSERT INTO 
                        images (description, path, title)
                    VALUES 
                        ($1, $2, $3)
                    RETURNING 
                        id;`, 
                    [image.description, image.path, image.title]);

                await pool.query(`
                    INSERT INTO 
                        about_sections_images (about_section_id, image_id) 
                    VALUES
                        ($1, $2);`, 
                    [id, result.rows[0].id]);

                return result.rows[0].id;
            }

            const result = await pool.query(`
                UPDATE 
                    images 
                SET 
                    description = $1, path = $2, title = $3 
                WHERE 
                    id = $4 
                RETURNING 
                    id;`,
                [image.description, image.path, image.title, image.id]);

            return result.rows[0].id;
        });

        return c.json({ message: `About section ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new about section into DB'}, 500);
    }
});

// DELETE request to delete a section in bio
aboutSections.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {

        const checkAboutSection = await pool.query(`
            SELECT id FROM about_sections WHERE id = $1;`,
            [id]);
        const checkAboutSectionImages = await pool.query(`
            SELECT about_section_id FROM about_sections_images WHERE about_section_id = $1;`,
            [id]);

        if(checkAboutSection.rows.length === 0) {
            return c.json({ error: 'About section not found' }, 404);
        }

        if(checkAboutSectionImages.rows.length > 0) {
            await pool.query(`
                DELETE FROM about_sections_images WHERE about_section_id = $1`, 
                [id]);
        }

        const resultAboutSection = await pool.query(`
            DELETE FROM about_sections WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({
            message: 'About section deleted successfully',
            id: resultAboutSection.rows[0].id
        }, 200);
    } catch (error) {
        console.error('Error deleting about section: ', error);
        return c.json({ error: 'Failed to delete about section' }, 500)
    }
});

export default aboutSections;
