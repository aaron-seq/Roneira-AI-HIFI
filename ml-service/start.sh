#!/bin/bash
echo "Starting Roneira AI HIFI ML Service..."
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Starting Uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
