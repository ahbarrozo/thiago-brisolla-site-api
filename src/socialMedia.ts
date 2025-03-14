import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { SocialMediaDTO } from './types/SocialMedia.type';
import { authMiddleware } from './auth';

const socialMedia = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all social media rows.
 */
socialMedia.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT * FROM social_media;
        `);

        return c.json(result.rows, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch socialMedias.'}, 500);
    }
});

/**
 *  POST request to create a new social media entry.
 */
socialMedia.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const socialMediaDTO: SocialMediaDTO = {
            link: data.get('link')!.toString(),
            name: data.get('name')!.toString(),
        };
        const result = await pool.query(`
            INSERT INTO 
                social_media (link, name)
            VALUES 
                ($1, $2)
            RETURNING 
                id;`,
            [socialMediaDTO.link, socialMediaDTO.name]
        );

        return c.json({ message: `SocialMedia ${result.rows[0].id} created successfully.`}, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new socialMedia into DB'}, 500);
    }
});

/**
 *  PUT request to update a social media based on its ID. It will 
 *  check its existence, and update all the fields available at the 
 *  submission form
 */
socialMedia.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkSocialMedia = await pool.query(`
            SELECT 
                id 
            FROM 
                social_media 
            WHERE 
                id = $1;`,
            [id]);

        if(checkSocialMedia.rows.length === 0) {
            return c.json({ error: 'Social Media not found' }, 404);
        }

        const data = await c.req.formData();
        const socialMediaDTO: SocialMediaDTO = {
            link: data.get('link')!.toString(),
            name: data.get('name')!.toString(),
        };

        await pool.query(`
            UPDATE 
                social_media 
            SET 
                link = $1, name = $2 
            WHERE 
                id = $3 
            RETURNING 
                id;`,
            [socialMediaDTO.link, socialMediaDTO.name, id]
        );

        return c.json({ message: `Social Media ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new social Media into DB'}, 500);
    }
});

/** 
 *  DELETE request to delete a social media entry based 
 *  on its ID
 */  
socialMedia.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');


    try {
        const checkSocialMedia = await pool.query(`
            SELECT id FROM social_media WHERE id = $1;`,
            [id]);

        if(checkSocialMedia.rows.length === 0) {
            return c.json({ error: 'socialMedia not found' }, 404);
        }

        await pool.query(`
            DELETE FROM social_media WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({ message: 'Social Media deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting social Media: ', error);
        return c.json({ error: 'Failed to delete social Media' }, 500)
    }
});

export default socialMedia;
