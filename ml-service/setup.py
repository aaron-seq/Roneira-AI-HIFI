from setuptools import setup, find_packages

setup(
    name="roneira-ml-service",
    version="1.0.0",
    description="ML Service for Roneira AI HIFI Stock Prediction",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "Flask>=2.3.3",
        "Flask-Cors>=4.0.0",
        "gunicorn>=21.2.0",
        "numpy>=1.24.3",
        "pandas>=2.0.3",
        "scikit-learn>=1.3.0",
        "yfinance>=0.2.18",
        "requests>=2.31.0",
        "joblib>=1.3.2",
        "python-dotenv>=1.0.0",
    ],
)
