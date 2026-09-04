import fastify from 'fastify';
export async function createServer() {
    const server = fastify({
        logger: true,
    });
    server.get('/health', async () => {
        return { status: 'ok' };
    });
    return server;
}
export async function startServer() {
    const server = await createServer();
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3000');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map