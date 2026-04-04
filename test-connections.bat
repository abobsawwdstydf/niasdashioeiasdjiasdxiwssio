@echo off
echo ========================================
echo Testing Database Connection (PostgreSQL)
echo ========================================
echo.

set DATABASE_URL=postgresql://neondb_owner:npg_HtISpB5j2how@ep-flat-haze-aijugpbg-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require

echo Testing connection to: ep-flat-haze-aijugpbg-pooler.c-4.us-east-1.aws.neon.tech
echo.
echo Note: This requires 'psql' to be installed.
echo If you don't have it, please install PostgreSQL client or use Docker:
echo   docker run --rm -it postgres:15 psql "%DATABASE_URL%"
echo.

REM Try to test with Node.js if available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Please install Node.js to run this test.
    goto :test_redis
)

echo Testing with Node.js...
echo.

node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); client.connect().then(() => { console.log('✓ Database connection successful!'); return client.query('SELECT NOW()'); }).then(res => { console.log('✓ Query executed:', res.rows[0].now); client.end(); process.exit(0); }).catch(err => { console.error('✗ Connection failed:', err.message); process.exit(1); });" 2>nul

if %errorlevel% neq 0 (
    echo.
    echo Trying alternative test...
    echo.
)

:test_redis
echo.
echo ========================================
echo Testing Redis Connection
echo ========================================
echo.

echo Testing REDIS_URL: redis-18158.c14.us-east-1-2.ec2.cloud.redislabs.com:18158
echo Testing REDIS_SESSION_URL: redis-13102.c17.us-east-1-4.ec2.cloud.redislabs.com:13102
echo.

node -e "const Redis = require('ioredis'); const redis = new Redis(process.env.REDIS_URL); redis.ping().then(res => { console.log('✓ Redis connection successful!'); redis.quit(); }).catch(err => { console.error('✗ Redis connection failed:', err.message); });" 2>nul

echo.
echo ========================================
echo Test Complete
echo ========================================
pause
