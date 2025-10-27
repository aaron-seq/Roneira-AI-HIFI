# Use Python 3.11 slim image for better performance and security
FROM python:3.11-slim AS production_base

# Set working directory
WORKDIR /application

# Install system dependencies for compilation and security
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements file for better Docker layer caching
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --no-cache-dir --upgrade pip==23.3.1 && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash --uid 1001 application_user && \
    chown -R application_user:application_user /application

# Switch to non-root user
USER application_user

# Expose application port
EXPOSE 5000

# Configure health check using requests instead of curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health', timeout=5)" || exit 1

# Set environment variables for production
ENV FLASK_ENV=production
ENV PYTHONPATH=/application
ENV PYTHONUNBUFFERED=1

# Start application with gunicorn for production deployment
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "--max-requests", "1000", "--preload", "enhanced_app:app"]