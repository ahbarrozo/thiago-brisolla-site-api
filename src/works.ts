import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { Image, ImageDTO } from './types/Image.type';
import { Work, WorkDTO } from './types/Work.type';
import { authMiddleware } from './auth';

const works = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all works while joining all the images associated
 *  with them and ordering by post date. Then the result is 
 *  parsed to include all images in a single array inside the 
 *  images attribute.
 */
works.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT 
                wk.id, wk.date, wk.description, wk.title, wk.link,   
                im.id AS image_id, im.path AS image_path,
                im.title AS image_title, im.description AS image_description 
            FROM 
                works wk
            LEFT JOIN
                works_images wki ON wk.id = wki.work_id
            LEFT JOIN
                images im ON wki.image_id = im.id;
        `);

        const works = result.rows.reduce((rows, row) => {
            const image: Image | null = row.image_id ? 
            {
                id: row.image_id,
                description: row.image_description,
                path: row.image_path,
                title: row.image_title
            } : null;

            const existingWork: Work = rows.find((r: Work) => r.id === row.id);

            if (existingWork) {
                if (image)
                    existingWork.images.push(image);
            } else {
                const work: Work = {
                    id: row.id,
                    date: row.date,
                    description: row.description,
                    link: row.link
                    title: row.title,
                    images: []
                }

                if (image)
                    work.images.push(image);

                rows.push(work);
            }
            return rows;
        }, []);

        return c.json(works, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch works.'}, 500);
    }
});

/**
 *  POST request to create a new work entry. It will insert the 
 *  new rows at the works, work_images and images tables
 */
works.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const work: WorkDTO = {
            date: data.get('date')!.toString(),
            description: data.get('description')!.toString(),
            link: data.get('link')!.toString(),
            title: data.get('title')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());
        const workQuery = await pool.query(`
            INSERT INTO 
                works (date, description, link, title)
            VALUES 
                ($1, $2, $3, $4)
            RETURNING 
                id;`,
            [work.date, work.description, work.link, work.title]
        );
        const workId = workQuery.rows[0].id
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
                    works_images (work_id, image_id)
                VALUES 
                    ($1, $2);`,
                [workId, imageId]);
        });

        return c.json(resultImages, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new work into DB'}, 500);
    }
});

/**
 *  PUT request to update an work based on its ID. It will 
 *  check its existence, fetch images associated with it, and update 
 *  all the fields available at the submission form, images included, 
 *  if needed
 */
works.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkWork = await pool.query(`
            SELECT 
                id 
            FROM 
                works 
            WHERE 
                id = $1;`,
            [id]);

        if(checkWork.rows.length === 0) {
            return c.json({ error: 'Work not found' }, 404);
        }

        const data = await c.req.formData();
        const work: WorkDTO = {
            date: data.get('date')!.toString(),
            description: data.get('description')!.toString(),
            link: data.get('link')!.toString(),
            title: data.get('title')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());

        await pool.query(`
            UPDATE 
                works 
            SET 
                date = $1, description = $2, link = $3, title = $4 
            WHERE 
                id = $5 
            RETURNING 
                id;`,
            [work.date, work.description, work.link, work.title, id]
        );
        
        const worksImagesResults = await pool.query(`
            SELECT 
                wki.image_id, wki.work_id, 
                im.id, im.path, im.description, im.title 
            FROM 
                works_images wki
            LEFT JOIN 
                images im ON im.id = wki.image_id
            WHERE 
                wki.work_id = $1;`,
            [id]
        );

        // separating between images to be deleted and upserted
        const imagesToDelete = worksImagesResults.
                               rows.filter(im => 
                                   !(images.map(i => i.id)).includes(im.image_id)
                               );
        const imagesToUpsert = images.filter(im => 
                                   !im.id || !(imagesToDelete.map(i => i.id)).includes(im.id)
                               );

        imagesToDelete.forEach(async (im) => {
            await pool.query(`
                DELETE FROM 
                    works_images 
                WHERE 
                    work_id = $1 AND image_id = $2`, 
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
                        works_images (work_id, image_id) 
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

        return c.json({ message: `Work ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new work into DB'}, 500);
    }
});

// DELETE request to delete a work based on its ID
works.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkWork = await pool.query(`
            SELECT id FROM works WHERE id = $1;`,
            [id]);
        const checkWorkImages = await pool.query(`
            SELECT work_id FROM works_images WHERE work_id = $1;`,
            [id]);

        if(checkWork.rows.length === 0) {
            return c.json({ error: 'Work not found' }, 404);
        }

        if(checkWorkImages.rows.length > 0) {
            await pool.query(`
                DELETE FROM works_images WHERE work_id = $1`, 
                [id]);
        }

        const resultWork = await pool.query(`
            DELETE FROM works WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({
            message: 'Work deleted successfully',
            id: resultWork.rows[0].id
        }, 200);
    } catch (error) {
        console.error('Error deleting work: ', error);
        return c.json({ error: 'Failed to delete work' }, 500)
    }
});

export default works;
