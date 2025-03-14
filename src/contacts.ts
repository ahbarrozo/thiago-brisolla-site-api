import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { ContactDTO } from './types/Contact.type';
import { authMiddleware } from './auth';

const contacts = new Hono<{ Variables: AppVariables }>();

/**
 *  GET all contacts.
 */
contacts.get('/', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const result = await pool.query(`
            SELECT * FROM contacts;
        `);

        return c.json(result.rows, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to fetch contacts.'}, 500);
    }
});

/**
 *  POST request to create a new contact entry.
 */
contacts.post('/', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const contact: ContactDTO = {
            address: data.get('address')! && data.get('address')!.toString(), // nullable field
            contact: data.get('contact')!.toString(),
            mail: data.get('mail')!.toString(),
            name: data.get('name')!.toString(),
            phone: data.get('phone')! && data.get('phone')!.toString(), // nullable field
        };
        const result = await pool.query(`
            INSERT INTO 
                contacts (address, contact, mail, name, phone)
            VALUES 
                ($1, $2, $3, $4, $5)
            RETURNING 
                id;`,
            [contact.address, contact.contact, contact.mail, contact.name, contact.phone]
        );

        return c.json({ message: `Contact ${result.rows[0].id} created successfully.`}, 201);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new contact into DB'}, 500);
    }
});

/**
 *  PUT request to update a contact based on its ID. It will 
 *  check its existence and updateall the fields available at 
 *  the submission form.
 */
contacts.put('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');

    try {
        const checkContact = await pool.query(`
            SELECT 
                id 
            FROM 
                contacts 
            WHERE 
                id = $1;`,
            [id]);

        if(checkContact.rows.length === 0) {
            return c.json({ error: 'contact not found' }, 404);
        }

        const data = await c.req.formData();
        const contact: ContactDTO = {
            address: data.get('address')! && data.get('address')!.toString(), // nullable field
            contact: data.get('contact')!.toString(),
            mail: data.get('mail')!.toString(),
            name: data.get('name')!.toString(),
            phone: data.get('phone')! && data.get('phone')!.toString(), // nullable field
        };

        await pool.query(`
            UPDATE 
                contacts 
            SET 
                address = $1, contact = $2, mail = $3, name = $4, phone = $5 
            WHERE 
                id = $6 
            RETURNING 
                id;`,
            [contact.address, contact.contact, contact.mail, contact.name, contact.phone, id]
        );

        return c.json({ message: `Contact ${id} updated successfully` }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Failed to insert new contact into DB'}, 500);
    }
});

/**
 *  DELETE request to delete a contact row based on its ID
 */
contacts.delete('/:id', authMiddleware, async (c) => {
    const pool: Pool = c.get('db');
    const id = c.req.param('id');


    try {
        const checkContact = await pool.query(`
            SELECT id FROM contacts WHERE id = $1;`,
            [id]);

        if(checkContact.rows.length === 0) {
            return c.json({ error: 'contact not found' }, 404);
        }

        await pool.query(`
            DELETE FROM contacts WHERE id = $1 RETURNING id`, 
            [id]);

        return c.json({ message: 'Contact deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting contact: ', error);
        return c.json({ error: 'Failed to delete contact' }, 500)
    }
});

export default contacts;
