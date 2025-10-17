# User Dashboard

A simple dashboard to monitor active users, sessions, and messages from your PostgreSQL database.

## Features

- View active users based on time period (7, 30, or 90 days)
- Display user details: name, email, company, and last activity
- Show key metrics: total users, active users, active sessions, and total messages
- **Feedback Analysis**: Track positive/negative feedback with detailed reasons
- Filter feedback by type (all, positive, negative)
- Display feedback stats: total count, positive/negative breakdown, positive rate
- Simple and clean UI with TailwindCSS
- Easy to update and scale

## Tech Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express + PostgreSQL
- **Database:** PostgreSQL

## Prerequisites

- **Option 1 (Docker - Recommended):**
  - Docker and Docker Compose installed

- **Option 2 (Manual):**
  - Node.js (v16 or higher)

- **Database:**
  - PostgreSQL database with your existing tables:
    - `users`
    - `chat_sessions`
    - `chat_messages`
    - `chat_feedbacks`

## Quick Start with Docker (Recommended)

### 1. Configure Environment

Edit the `.env` file in the root directory with your PostgreSQL credentials:

```env
DB_HOST=your_database_host
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
```

### 2. Run with One Command

```bash
docker-compose up -d
```

That's it! The dashboard will be available at:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:3001

### Stop the Application

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

### Rebuild After Changes

```bash
docker-compose up -d --build
```

---

## Manual Setup Instructions (Without Docker)

### 1. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit the `.env` file with your PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=3001
```

### 2. Frontend Setup

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend Server

```bash
# From backend folder
cd backend
npm start

# Or with auto-reload during development
npm run dev
```

The backend API will run on `http://localhost:3001`

### Start Frontend

```bash
# From frontend folder (in a new terminal)
cd frontend
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is busy)

## API Endpoints

### GET /api/active-users

Get list of active users based on time period.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Example:**
```
GET http://localhost:3001/api/active-users?days=30
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "email": "user@example.com",
      "company_name": "Company Inc",
      "first_name": "John",
      "last_name": "Doe",
      "last_activity": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### GET /api/stats

Get dashboard statistics including feedback metrics.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Example:**
```
GET http://localhost:3001/api/stats?days=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 100,
    "activeUsers": 45,
    "activeSessions": 120,
    "totalMessages": 850,
    "totalFeedback": 234,
    "positiveFeedback": 189,
    "negativeFeedback": 45,
    "positiveRate": 81,
    "period": "30 days"
  }
}
```

### GET /api/feedbacks

Get list of feedback with user details.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)
- `type` (optional): Filter by type - `all`, `positive`, `negative` (default: all)

**Example:**
```
GET http://localhost:3001/api/feedbacks?days=30&type=negative
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "chat_feedback_id": "uuid",
      "is_positive": false,
      "negative_reason": {
        "checkedReasons": ["Incomplete Response"],
        "inputReason": "需要更详细的解释"
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "user_id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Company Inc"
    }
  ],
  "count": 1
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "message": "Server is running"
}
```

## How Active Users are Defined

Active users are identified based on activity in the selected time period (7, 30, or 90 days):

- Users who created chat sessions in the time period
- Users who updated chat sessions in the time period
- Users who sent messages in the time period

The dashboard shows the most recent activity across all these metrics.

## Project Structure

```
Dashboard/
├── backend/
│   ├── server.js          # Express server with API endpoints
│   ├── db.js              # PostgreSQL connection
│   ├── package.json       # Backend dependencies
│   └── .env.example       # Environment variables template
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main dashboard component
│   │   └── index.css      # TailwindCSS styles
│   ├── package.json       # Frontend dependencies
│   ├── tailwind.config.js # TailwindCSS configuration
│   └── postcss.config.js  # PostCSS configuration
│
└── README.md              # This file
```

## Customization

### Add More Time Periods

Edit [frontend/src/App.jsx](frontend/src/App.jsx) and add more options to the select dropdown:

```jsx
<select value={timePeriod} onChange={(e) => setTimePeriod(Number(e.target.value))}>
  <option value={1}>Last 24 hours</option>
  <option value={7}>Last 7 days</option>
  <option value={30}>Last 30 days</option>
  <option value={90}>Last 90 days</option>
  <option value={365}>Last year</option>
</select>
```

### Add More Statistics

1. Add a new query in [backend/server.js](backend/server.js) in the `/api/stats` endpoint
2. Add a new stats card in [frontend/src/App.jsx](frontend/src/App.jsx)

### Modify Table Columns

Edit the table in [frontend/src/App.jsx](frontend/src/App.jsx) to add or remove columns.

## Troubleshooting

### Backend won't connect to database

- Check your `.env` file has correct database credentials
- Ensure PostgreSQL is running
- Verify the database name, user, and password are correct

### Frontend shows connection error

- Make sure backend is running on port 3001
- Check browser console for CORS errors
- Verify API_URL in [frontend/src/App.jsx](frontend/src/App.jsx) matches your backend port

### No users showing up

- Check your database has data in `users`, `chat_sessions`, and `chat_messages` tables
- Verify users have activity in the selected time period
- Check browser console and backend logs for errors

## Future Enhancements

Simple additions you can make:

1. **Export to CSV** - Add button to download user list
2. **Search/Filter** - Add search box to filter users by name or email
3. **Pagination** - Add pagination for large user lists
4. **User Details** - Click on user to see detailed activity
5. **Charts** - Add simple charts for user growth over time

## License

MIT
