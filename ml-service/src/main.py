#!/usr/bin/env python3
"""
Roneira Financial Intelligence ML Service
"""

import sys
from pathlib import Path

# Add src directory to Python path
src_directory = Path(__file__).parent
sys.path.insert(0, str(src_directory))

from application_factory import create_financial_intelligence_application  # noqa: E402
from configuration.environment_config import EnvironmentConfiguration  # noqa: E402
from utilities.application_logger import ApplicationLogger  # noqa: E402

# Initialize logger
logger = ApplicationLogger.get_instance()


def initialize_application_server():
    """
    Initialize and configure the ML service application
    """
    try:
        # Load configuration
        environment_config = EnvironmentConfiguration()

        # Create Flask application
        flask_app = create_financial_intelligence_application(environment_config)

        logger.info("Financial Intelligence ML Service initialized successfully")
        logger.info(f"Environment: {environment_config.environment_type}")
        logger.info(f"Debug mode: {environment_config.debug_mode}")

        return flask_app

    except Exception as initialization_error:
        logger.error(f"Failed to initialize application: {initialization_error}")
        sys.exit(1)


def start_development_server(flask_application, configuration):
    """
    Start the development server
    """
    logger.info("Starting development server...")
    flask_application.run(
        host=configuration.server_host,
        port=configuration.server_port,
        debug=configuration.debug_mode,
        threaded=True,
    )


def main():
    """
    Main application entry point
    """
    logger.info("🚀 Starting Roneira Financial Intelligence ML Service")

    # Initialize application
    application = initialize_application_server()

    # Get configuration
    config = EnvironmentConfiguration()

    # Check if running in production mode
    if config.is_production_environment():
        logger.info("Production mode detected - use Gunicorn to serve")
        logger.info(
            f"Command: gunicorn -w 4 -b {config.server_host}:{config.server_port} main:application"
        )
        return application
    else:
        # Development mode - start Flask dev server
        start_development_server(application, config)


if __name__ == "__main__":
    main()
else:
    # For WSGI servers (Gunicorn, uWSGI, etc.)
    application = initialize_application_server()
