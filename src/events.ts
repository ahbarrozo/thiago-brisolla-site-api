import { Hono } from 'hono';
import { Pool } from 'pg';

import { AppVariables } from './types/hono.types';
import { Event, EventDTO } from './types/Event.type';
import { authMiddleware } from './auth';

const events = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all events.
 */
events.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT * FROM events;
        `);

        const eventsList = result.rows.map((e: Event) => { return { ...e, dates: e.dates.split(' ') }});
        return c.json(eventsList, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch events.'}, 500);
    }
});

/**
 *  POST request to create a new event entry.
 */
events.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const event: EventDTO = {
            dates: data.get('dates')!.toString(),
            location: data.get('location')!.toString(),
            name: data.get('name')!.toString(),
            link: data.get('link')! && data.get('link')!.toString(), // nullable field
        };
        const result = await pool.query(`
            INSERT INTO 
                events (dates, location, name, link)
            VALUES 
                ($1, $2, $3, $4)
            RETURNING 
                id;`,
            [event.dates, event.location, event.name, event.link]
        );

        return c.json({ message: `Event ${result.rows[0].id} created successfully.`}, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new contact into DB'}, 500);
    }
});

/**
 *  PUT request to update an event based on its ID. It will 
 *  check its existence and updateall the fields available at 
 *  the submission form.
 */
events.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkEvent = await pool.query(`
            SELECT 
                id 
            FROM 
                events 
            WHERE 
                id = $1;`,
            [id]);

        if(checkEvent.rows.length === 0) {
            return c.json({ error: 'Event not found' }, 404);
        }

        const data = await c.req.formData();
        const event: EventDTO = {
            dates: data.get('dates')!.toString(),
            location: data.get('location')!.toString(),
            name: data.get('name')!.toString(),
            link: data.get('link')! && data.get('link')!.toString(), // nullable field
        };

        await pool.query(`
            UPDATE 
                events 
            SET 
                dates = $1, location = $2, name = $3, link = $4 
            WHERE 
                id = $5 
            RETURNING 
                id;`,
            [event.dates, event.location, event.name, event.link, id]
        );

        return c.json({ message: `Event ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new event into DB'}, 500);
    }
});

/**
 *  DELETE request to delete an event row based on its ID
 */
events.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkEvent = await pool.query(`
            SELECT id FROM events WHERE id = $1;`,
            [id]);

        if(checkEvent.rows.length === 0) {
            return c.json({ error: 'Event not found' }, 404);
        }

        await pool.query(`
            DELETE FROM events WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({ message: 'Event deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting event: ', error);
        return c.json({ error: 'Failed to delete event' }, 500)
    }
});

export default events;
