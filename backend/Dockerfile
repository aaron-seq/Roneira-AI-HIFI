# Multi-stage build for production optimization
FROM node:18-alpine AS development_dependencies

# Set working directory
WORKDIR /application

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including development packages
RUN npm ci --include=dev

# Copy source code
COPY src/ ./src/

# Build TypeScript application
RUN npm run build

# Production stage for optimized deployment
FROM node:18-alpine AS production_deployment

# Create application directory
WORKDIR /application

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs_group && \
    adduser -S nodejs_user -u 1001 -G nodejs_group

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from development stage
COPY --from=development_dependencies /application/dist ./dist

# Create health check script
RUN echo '#!/bin/sh\n\
wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1' > /usr/local/bin/health_check.sh && \
chmod +x /usr/local/bin/health_check.sh

# Install wget for health checks
RUN apk add --no-cache wget

# Change ownership to non-root user
RUN chown -R nodejs_user:nodejs_group /application
USER nodejs_user

# Expose application port
EXPOSE 3001

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD /usr/local/bin/health_check.sh

# Start the application
CMD ["node", "dist/src/server.js"]