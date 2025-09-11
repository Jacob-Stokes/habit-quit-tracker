# Habit/Quit Tracker PWA

A simple self-hosted Progressive Web App for tracking habits and quits.

## Project Structure

```
habit-quit-tracker/
├── src/
│   ├── controllers/     # Route handlers and business logic
│   ├── models/         # Database models and queries
│   ├── routes/         # API route definitions
│   ├── middleware/     # Express middleware
│   ├── utils/          # Helper functions
│   └── config/         # Configuration files
├── public/             # Static files (CSS, JS, images)
├── database/           # Database files and migrations
├── tests/              # Test files
├── logs/               # Application logs
├── .env.example        # Environment variables template
└── package.json        # Dependencies and scripts
```

## Getting Started

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npm run db:setup
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and go to `http://localhost:3000`

## Docker Deployment

### Quick Start with Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/Jacob-Stokes/habit-quit-tracker.git
   cd habit-quit-tracker
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```

3. Access the app at `http://localhost:8882`

### Docker Compose Configuration

The app runs on **port 8882** (mapped from container port 3000) with:
- **Persistent data**: Database stored in `./data` directory
- **Persistent logs**: Application logs in `./logs` directory  
- **Health checks**: Automatic container health monitoring
- **Auto-restart**: Container restarts unless manually stopped

### Docker Commands

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild and restart
docker-compose up --build -d

# View container status
docker-compose ps
```

### Data Persistence

- **Database**: `./data/database.sqlite` (created automatically)
- **Logs**: `./logs/` directory
- **Backups**: Simply backup the `./data` directory

## Quick Start Guide

1. **Create an account**: Register a new user account on the login page
2. **Add your first activity**: Click "+ Add Activity" and choose whether it's a habit (something you want to do) or a quit (something you want to stop)
3. **Log events**: Use the big buttons on each activity card to quickly log when you do something
4. **Track progress**: View your streaks and statistics on the dashboard

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm run db:setup` - Set up the SQLite database
- `npm test` - Run tests (when implemented)
- `npm run lint` - Check code style
- `npm run lint:fix` - Fix code style issues

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/status` - Check auth status

### Activities
- `GET /api/activities` - Get all user activities
- `GET /api/activities/:id` - Get specific activity
- `POST /api/activities` - Create new activity
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Archive activity
- `GET /api/activities/:id/stats` - Get activity statistics

### Events
- `GET /api/events` - Get all user events
- `GET /api/events/:id` - Get specific event
- `POST /api/events` - Create new event
- `POST /api/events/quick-log` - Quick log an event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - Path to SQLite database file
- `SESSION_SECRET` - Secret key for sessions (change in production!)
- `FRONTEND_URL` - Frontend URL for CORS

## Features

- Track habits (things you want to do regularly)
- Track quits (things you want to stop doing)
- One-tap logging for quick entry
- Streak counting and statistics
- Offline-first PWA functionality
- Self-hosted with SQLite database

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite
- **Frontend**: Vanilla JS with PWA features
- **Authentication**: Session-based auth