import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { Image, ImageDTO } from './types/Image.type';
import { BlogPost, BlogPostDTO } from './types/BlogPost.type';

const blogPosts = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all blog posts while joining all the images associated
 *  with them and ordering by post date. Then the result is 
 *  parsed to include all images in a single array inside the 
 *  images attribute.
 */
blogPosts.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT 
                bp.id, bp.title, bp.subtitle, bp.text, bp.date, 
                im.id AS image_id, im.path AS image_path,
                im.title AS image_title, im.description AS image_description 
            FROM 
                blog_posts bp
            LEFT JOIN
                blog_posts_images bpi ON bp.id = bpi.blog_post_id
            LEFT JOIN
                images im ON bpi.image_id = im.id
            ORDER BY
                bp.date
        `);

        const blogPosts = result.rows.reduce((rows, row) => {
            const image: Image | null = row.image_id ? 
            {
                id: row.image_id,
                description: row.image_description,
                path: row.image_path,
                title: row.image_title
            } : null;

            const existingBlogPost: BlogPost = rows.find((r: BlogPost) => r.id === row.id);

            if (existingBlogPost) {
                if (image)
                    existingBlogPost.images.push(image);
            } else {
                const blogPost: BlogPost = {
                    id: row.id,
                    title: row.title,
                    subtitle: row.subtitle,
                    text: row.text,
                    date: row.date,
                    images: []
                }

                if (image)
                    blogPost.images.push(image);

                rows.push(blogPost);
            }
            return rows;
        }, []);

        return c.json(blogPosts, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch blog_posts.'}, 500);
    }
});

/**
 *  POST request to create a new blog entry. It will insert the 
 *  new rows at the blog_posts, blog_post_images and images tables
 */
blogPosts.post('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const blogPost: BlogPostDTO = {
            title: data.get('title')!.toString(),
            subtitle: data.get('subtitle')!.toString(),
            text: data.get('text')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());
        const blogPostQuery = await pool.query(`
            INSERT INTO blog_posts (title, subtitle, text)
            VALUES ($1, $2, $3)
            RETURNING id;`,
            [blogPost.title, blogPost.subtitle, blogPost.text]
        );
        const blogPostId = blogPostQuery.rows[0].id
        const resultImagesPromises = images.map(async (image) => {
            const result = await pool.query(`
                INSERT INTO images (description, path, title)
                VALUES ($1, $2, $3)
                RETURNING id;`, 
                [image.description, image.path, image.title]);

            return result.rows[0].id;
        });

        const resultImages = await Promise.all(resultImagesPromises);
        resultImages.forEach(async (imageId) => {
            await pool.query(`
                INSERT INTO blog_posts_images (blog_post_id, image_id)
                VALUES ($1, $2);`,
                [blogPostId, imageId]);
        });

        return c.json(resultImages, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new blog content into DB'}, 500);
    }
});

/**
 *  POST request to create a new blog entry. It will insert the 
 *  new rows at the blog_posts, blog_post_images and images tables
 */
blogPosts.put('/:id', async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkBlogPost = await pool.query(`
            SELECT id FROM blog_posts WHERE id = $1;`,
            [id]);

        if(checkBlogPost.rows.length === 0) {
            return c.json({ error: 'Blog post not found' }, 404);
        }
        const data = await c.req.formData();
        const blogPost: BlogPostDTO = {
            title: data.get('title')!.toString(),
            subtitle: data.get('subtitle')!.toString(),
            text: data.get('text')!.toString(),
        };
        const images: ImageDTO[] = JSON.parse(data.get('images')!.toString());
        const blogPostResults = await pool.query(`
            UPDATE blog_posts 
            SET title = $1, subtitle = $2, text = $3
            WHERE id = $4
            RETURNING id;`,
            [blogPost.title, blogPost.subtitle, blogPost.text, id]
        );

        const blogPostsImagesResults = await pool.query(`
            SELECT * FROM blog_posts_images WHERE blog_post_id = $1;`,
            [id]
        );

        
        const resultImagesPromises = images.map(async (image) => {
            const result = await pool.query(`
                INSERT INTO images (description, path, title)
                VALUES ($1, $2, $3)
                RETURNING id;`, 
                [image.description, image.path, image.title]);

            return result.rows[0].id;
        });

        const resultImages = await Promise.all(resultImagesPromises);
        resultImages.forEach(async (imageId) => {
            await pool.query(`
                INSERT INTO blog_posts_images (blog_post_id, image_id)
                VALUES ($1, $2);`,
                [id, imageId]);
        });

        return c.json(resultImages, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new blog content into DB'}, 500);
    }
});

blogPosts.delete('/:id', async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {

        const checkBlogPost = await pool.query(`
            SELECT id FROM blog_posts WHERE id = $1;`,
            [id]);
        const checkBlogPostImages = await pool.query(`
            SELECT blog_post_id FROM blog_posts_images WHERE blog_post_id = $1;`,
            [id]);

        if(checkBlogPost.rows.length === 0) {
            return c.json({ error: 'Blog post not found' }, 404);
        }

        if(checkBlogPostImages.rows.length > 0) {
            await pool.query(`
                DELETE FROM blog_posts_images WHERE blog_post_id = $1`, 
                [id]);
        }

        const resultBlogPost = await pool.query(`
            DELETE FROM blog_posts WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({
            message: 'Blog post deleted successfully',
            id: resultBlogPost.rows[0].id
        }, 200);
    } catch (error) {
        console.error('Error deleting blog post: ', error);
        return c.json({ error: 'Failed to delete blog post' }, 500)
    }
});

export default blogPosts;
