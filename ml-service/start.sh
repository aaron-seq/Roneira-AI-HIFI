#!/bin/bash
echo "Starting Roneira AI HIFI ML Service..."
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Starting Gunicorn server..."
exec gunicorn enhanced_app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 60