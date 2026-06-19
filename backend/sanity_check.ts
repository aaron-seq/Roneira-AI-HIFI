import BackendServer from './src/server';
try {
    const server = new BackendServer();
} catch (e) {
    console.error('Server instantiation failed:', e);
}
