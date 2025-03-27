import { Context, Hono, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { AppVariables } from './types/hono.types';
import { User, UserLogin } from './types/User.type';

const auth = new Hono<{ Variables: AppVariables }>();
const JWT_SECRET = Bun.env.JWT_SECRET;
const JWT_EXPIRES_IN = Bun.env.JWT_EXPIRES_IN;

/**
 *  POST request to login. It will perform a check of username
 *  and a password hash using a PostgreSQL custom function
 */
auth.post('/login', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const userLogin: UserLogin = {
            username: data.get('username')!.toString(),
            password: data.get('password')!.toString(),
        };
        const result = await pool.query(`
            SELECT  
                *
            FROM 
                authenticate_user($1, $2);`,
            [userLogin.username, userLogin.password]
        );

        if (result.rows.length === 0 || result.rows[0].username !== userLogin.username) {
            return c.json({ error: 'Invalid credentials.' }, 401);
        }

        const user: User = result.rows[0];

        // Generate JWT
        // @ts-ignore
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        return c.json({ token, user }, 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Login failed'}, 500);
    }
});

/**
 *  POST request to change password. It will perform a check of username
 *  and a password hash using a PostgreSQL custom function
 */
auth.post('/reset', async (c) => {
    const pool: Pool = c.get('db');

    try {
        const data = await c.req.formData();
        const user: UserLogin & { oldPassword: string } = {
            username: data.get('username')!.toString(),
            oldPassword: data.get('oldPassword')!.toString(),
            password: data.get('password')!.toString(),
        };
        const result = await pool.query(`
            SELECT  
                *
            FROM 
                reset_password($1, $2, $3);`,
            [user.username, user.oldPassword, user.password]
        );

        return c.json(result.rows[0], 200);
    } catch (error) {
        console.error('Database error: ', error);
        return c.json({ error: 'Login failed'}, 500);
    }
});

auth.post('/verify_token', async (c) => {
    try {
        const data = await c.req.formData();
        const token = data.get('token')?.toString();

        const decoded = jwt.verify(token, JWT_SECRET);

        return c.json({ message: 'Token is valid!' }, 200);
    } catch (error) {
        console.error('Error during token verification: ', error);
        return c.json({ error: 'Token verification error'}, 500);
    }
});

export const authMiddleware = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
  
    const token = authHeader.split(' ')[1];
  
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as User;
        c.set('user', decoded);
        await next();
    } catch (error) {
        return c.json({ error: 'Invalid or expired token' }, 401)
    }
}

export default auth;
