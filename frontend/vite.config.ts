import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true, // Needed for Docker container port mapping
        strictPort: true,
        port: 3000,
        watch: {
            usePolling: true,
        },
    },
    optimizeDeps: {
        include: [
            'react-window',
            'react',
            'react-dom',
            'framer-motion',
        ],
    },
});
