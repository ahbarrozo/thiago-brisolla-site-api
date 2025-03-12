import app from './app';

// Start the server
const server = Bun.serve({
    port: Bun.env.PORT || 3000,
    fetch: app.fetch,
});

console.log(`Server running at ${Bun.env.HOST}:${Bun.env.PORT}`)

export default server;
