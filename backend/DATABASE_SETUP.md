# Database Setup Guide

## Prerequisites
1. PostgreSQL installed and running
2. PostgreSQL user with CREATE DATABASE permissions

## Step 1: Create Environment File

Create a `.env` file in the backend directory with the following content:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gaslink_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Firebase Admin Configuration (optional for now)
FIREBASE_PROJECT_ID=your_firebase_project_id

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Step 2: Update Database Credentials

Replace the following values in your `.env` file:
- `DB_USER`: Your PostgreSQL username (usually `postgres`)
- `DB_PASSWORD`: Your PostgreSQL password
- `DB_NAME`: Database name (default: `gaslink_db`)

## Step 3: Run Database Setup

```bash
cd backend
node setup-database.js
```

This script will:
1. Create the database if it doesn't exist
2. Create all tables and schema
3. Insert sample data for testing

## Step 4: Verify Setup

```bash
node test-db.js
```

You should see:
- ✅ Database connected successfully
- ✅ All tables created
- 📊 Sample data counts

## Troubleshooting

### Connection Error: "client password must be a string"
- Make sure your `.env` file exists and has the correct password
- Check that PostgreSQL is running
- Verify your PostgreSQL credentials

### Permission Error: "permission denied to create database"
- Make sure your PostgreSQL user has CREATE DATABASE permissions
- You may need to run as a superuser or grant permissions

### Port Already in Use
- Change the PORT in your `.env` file
- Or stop any existing PostgreSQL instances

## Sample Data

The setup script creates:
- 1 Demo Distributor
- 1 Admin User
- 3 Cylinder Types (12.5kg, 25kg, 50kg)
- 2 Sample Customers
- Sample Inventory for each cylinder type 