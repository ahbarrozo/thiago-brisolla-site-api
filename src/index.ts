import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from 'pg';

import { AppVariables } from './types/hono.types';
import aboutSections from './aboutSections';
import auth from './auth';
import blogPosts from './blogPosts';
import contacts from './contacts';
import events from './events';
import socialMedia from './socialMedia';
import works from './works';

const pool = new Pool({
    user: Bun.env.DB_USER,
    host: Bun.env.DB_HOST,
    port: Number(Bun.env.DB_PORT),
    database: Bun.env.DB_NAME,
    password: Bun.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: true
    }
});

const app = new Hono<{ Variables: AppVariables }>()

// Middleware to access DB
app.use('*', async (c, next) => {
    c.set('db', pool);
    await next();
});
app.use('*', cors({
    origin: [Bun.env.ALLOWED_ORIGIN as string, 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.route('/about_sections', aboutSections);
app.route('/auth', auth);
app.route('/blog_posts', blogPosts);
app.route('/contacts', contacts);
app.route('/events', events);
app.route('/social_media', socialMedia);
app.route('/works', works);

app.get('/', (c) => {
  return c.text('API connection established!')
})

// Run the server
const server = Bun.serve({
    port: Bun.env.PORT || 3000,
    fetch: app.fetch,
    hostname: "0.0.0.0"
});

console.log(`Server running at http://${server.hostname}:${server.port}`);
