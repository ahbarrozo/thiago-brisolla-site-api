import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { Image, ImageDTO } from './types/Image.type';
import { Album, AlbumDTO } from './types/Album.type';
import { authMiddleware } from './auth';

const albums = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all album while joining all the images associated
 *  with them and ordering by post date. Then the result is 
 *  parsed to include all images in a single array inside the 
 *  images attribute.
 */
albums.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT 
                al.id, al.date, al.description, al.title,  
                im.id AS image_id, im.path AS image_path,
                im.title AS image_title, im.description AS image_description 
            FROM 
                albums al
            LEFT JOIN
                albums_images ali ON al.id = ali.album_id
            LEFT JOIN
                images im ON ali.image_id = im.id;
        `);

        const albums = result.rows.reduce((rows, row) => {
            const image: Image | null = row.image_id ? 
            {
                id: row.image_id,
                description: row.image_description,
                path: row.image_path,
                title: row.image_title
            } : null;

            const existingAlbum: Album = rows.find((r: Album) => r.id === row.id);

            if (existingAlbum) {
                if (image)
                    existingAlbum.images.push(image);
            } else {
                const album: Album = {
                    id: row.id,
                    date: row.date,
                    description: row.description,
                    title: row.title,
                    images: []
                }

                if (image)
                    album.images.push(image);

                rows.push(album);
            }
            return rows;
        }, []);

        return c.json(albums, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch albums.'}, 500);
    }
});

/**
 *  POST request to create a new album entry. It will insert the 
 *  new rows at the albums, album_images and images tables
 */
albums.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const album: AlbumDTO = {
            date: data.get('date')!.toString(),
            description: data.get('description')!.toString(),
            title: data.get('title')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());
        const albumQuery = await pool.query(`
            INSERT INTO 
                albums (date, description, title)
            VALUES 
                ($1, $2, $3)
            RETURNING 
                id;`,
            [album.date, album.description, album.title]
        );
        const albumId = albumQuery.rows[0].id
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
                    albums_images (album_id, image_id)
                VALUES 
                    ($1, $2);`,
                [albumId, imageId]);
        });

        return c.json(resultImages, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new album into DB'}, 500);
    }
});

/**
 *  PUT request to update an album based on its ID. It will 
 *  check its existence, fetch images associated with it, and update 
 *  all the fields available at the submission form, images included, 
 *  if needed
 */
albums.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkAlbum = await pool.query(`
            SELECT 
                id 
            FROM 
                albums 
            WHERE 
                id = $1;`,
            [id]);

        if(checkAlbum.rows.length === 0) {
            return c.json({ error: 'album not found' }, 404);
        }

        const data = await c.req.formData();
        const album: AlbumDTO = {
            date: data.get('date')!.toString(),
            description: data.get('description')!.toString(),
            title: data.get('title')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());

        await pool.query(`
            UPDATE 
                albums 
            SET 
                date = $1, description = $2, title = $3 
            WHERE 
                id = $4 
            RETURNING 
                id;`,
            [album.date, album.description, album.title, id]
        );
        
        const albumsImagesResults = await pool.query(`
            SELECT 
                ali.image_id, ali.album_id, 
                im.id, im.path, im.description, im.title 
            FROM 
                albums_images ali
            LEFT JOIN 
                images im ON im.id = ali.image_id
            WHERE 
                ali.album_id = $1;`,
            [id]
        );

        // separating between images to be deleted and upserted
        const imagesToDelete = albumsImagesResults.
                               rows.filter(im => 
                                   !(images.map(i => i.id)).includes(im.image_id)
                               );
        const imagesToUpsert = images.filter(im => 
                                   !im.id || !(imagesToDelete.map(i => i.id)).includes(im.id)
                               );

        imagesToDelete.forEach(async (im) => {
            await pool.query(`
                DELETE FROM 
                    albums_images 
                WHERE 
                    album_id = $1 AND image_id = $2`, 
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
                        albums_images (album_id, image_id) 
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

        return c.json({ message: `Album ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new album into DB'}, 500);
    }
});

// DELETE request to delete an album based on its ID
albums.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');


    try {

        const checkAlbum = await pool.query(`
            SELECT id FROM albums WHERE id = $1;`,
            [id]);
        const checkAlbumImages = await pool.query(`
            SELECT album_id FROM albums_images WHERE album_id = $1;`,
            [id]);

        if(checkAlbum.rows.length === 0) {
            return c.json({ error: 'album not found' }, 404);
        }

        if(checkAlbumImages.rows.length > 0) {
            await pool.query(`
                DELETE FROM albums_images WHERE album_id = $1`, 
                [id]);
        }

        const resultAlbum = await pool.query(`
            DELETE FROM albums WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({
            message: 'Album deleted successfully',
            id: resultAlbum.rows[0].id
        }, 200);
    } catch (error) {
        console.error('Error deleting album: ', error);
        return c.json({ error: 'Failed to delete album' }, 500)
    }
});

export default albums;
