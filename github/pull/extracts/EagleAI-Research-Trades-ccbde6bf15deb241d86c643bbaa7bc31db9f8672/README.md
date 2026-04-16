# Trades

A Python-based cryptocurrency trading service with automated execution capabilities for the Apex Omni exchange.

## Overview

Trades is a Flask-based REST API service designed for algorithmic trading on the Apex Omni cryptocurrency exchange. The platform provides:

- Automated trade execution (LIMIT, MARKET, STOP_LIMIT orders)
- Real-time account and position management
- Historical trade data and P&L tracking
- Secure credential management with encryption
- JWT-based authentication
- Background tweet monitoring for market sentiment

## Features

### Trading Operations

- **Order Placement**: Create LIMIT, MARKET, STOP_LIMIT, and TAKE_PROFIT_MARKET orders
- **Order Management**: Cancel and track orders
- **Position Monitoring**: View open positions and filled orders
- **Account Management**: Check balances and set leverage/margin rates
- **Historical Data**: Access trade history and P&L analytics
- **Symbol Information**: Retrieve available trading pairs

### Security

- Encrypted credential storage using AES encryption
- JWT token-based authentication
- PostgreSQL database with SSL certificate support

### API Documentation

- Interactive Swagger documentation available at `/apidocs`
- Full API specification with request/response examples

## Architecture

**Single Python Service** built with:

- **Flask**: Web framework and REST API
- **Gunicorn**: Production WSGI server
- **PostgreSQL**: Primary database for trades and credentials
- **MongoDB**: Tweet storage (optional feature)
- **APScheduler**: Background job scheduling
- **Apex Omni SDK**: Exchange integration

## Getting Started

### Prerequisites

- Docker (recommended) or Python 3.11+
- PostgreSQL database
- SSL certificates for secure database connections
- Apex Omni API credentials

### Environment Variables

Create a `.env` file with the following variables:

```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
POSTGRES_HOST=your_host
POSTGRES_PORT=5432
POSTGRES_DB=your_database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

ENCRYPTION_KEY=your_encryption_key
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_key
X_API_KEY=your_twitter_api_key
MONGO_URI=mongodb://your_mongo_uri
```

### Running the Service

1. Clone the repository

   ```bash
   git clone https://github.com/EagleAI-Research/Stream.git
   cd stream
   ```

2. Set up environment variables

   ```bash
   cp .env.local
   cp .env
   # Edit .env with your configuration
   ```

3. Start the service using Docker Compose

   ```bash
   docker-compose up -d
   ```

4. Or run the service individually with Make

   ```bash
   make python
   ```

   The service will run on port 4001.

## License

Not licensed for external use
