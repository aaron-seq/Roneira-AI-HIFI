import BackendServer from './src/server';
try {
    console.log('Attempting to instantiate server...');
    const server = new BackendServer();
    console.log('Server instantiated successfully');
} catch (e) {
    console.error('Server instantiation failed:', e);
}
