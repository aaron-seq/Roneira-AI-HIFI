#!/bin/bash
echo "🚀 Starting build process for Roneira AI HIFI ML Service..."
echo "📦 Upgrading pip, setuptools, and wheel..."
pip install --upgrade pip setuptools wheel
echo "📋 Installing requirements..."
pip install -r requirements.txt
echo "✅ Build completed successfully!"