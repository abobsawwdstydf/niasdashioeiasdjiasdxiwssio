# QR Code & Auth Key Implementation Plan

## QR Code Login
- Generate QR code on server side
- Contains session token + auth URL
- User scans QR with mobile app
- App connects to server and authenticates

## Auth Key (37 characters)
- Format: `nexo-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (37 chars)
- Generated on server when user requests QR/auth key
- Can be used instead of scanning QR
- Valid for 5 minutes

## Implementation
1. Add QR code button to auth page (side panel)
2. Click shows modal with:
   - QR code image (generated)
   - 37-char auth key (copyable)
   - Option to enter key manually
3. Server endpoint to generate auth session
4. Mobile apps can scan QR or enter key

## Server Endpoints
- POST /api/auth/qr-session - Generate new QR session
- GET /api/auth/qr-session/:id - Check if session authenticated
- POST /api/auth/key-login - Login with auth key
