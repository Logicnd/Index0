# Index0

Index0 is a dark, Discord-inspired chat app with file-backed authentication, Socket.IO messaging, and persisted room history.

## Setup

```bash
cd server
npm install
```

If you want the dependency shortcut script, you can also run:

```bash
npm run setup
```

## Run

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## What It Stores

- `server/users.json` stores hashed user accounts.
- `server/messages.json` stores room history for channels and DMs.
- Browser session data uses `index0_token` and `index0_user` in `localStorage`.

## Auth Flow

The app opens on the login/signup modal when there is no valid session.

- Sign up validates usernames as 3-20 characters with letters, numbers, or underscores.
- Passwords must be at least 4 characters.
- Successful login or signup stores a JWT for 7 days and reconnects automatically.

## Socket Events

Client to server:

- `join_room`
- `leave_room`
- `send_message`
- `typing`

Server to client:

- `new_message`
- `system_message`
- `user_joined`
- `user_left`
- `user_list_update`

## Verification

1. Sign up two different users in separate browser windows.
2. Send messages in `#general` and in direct messages.
3. Refresh one window and confirm the session restores.
4. Stop and restart the server, then confirm messages still load.
5. Try a duplicate username and a wrong password to confirm user-facing errors.

## Troubleshooting

- If you see an invalid token message, clear browser storage and log in again.
- If the socket refuses to connect, make sure the server is running on port 3000.
- If messages do not appear after a restart, confirm `server/messages.json` is writable.
