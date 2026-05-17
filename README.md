# Index0

**Index0** is a minimal, underground-style Discord-inspired chat interface built with plain HTML, CSS, and JavaScript.

No frameworks. No build tools. No database yet. No complicated setup.

The current version is designed as a clean static prototype that can run locally or be deployed to Vercel for testing.

---

## Table of Contents

- [Project Philosophy](#project-philosophy)
- [Current Status](#current-status)
- [Folder Structure](#folder-structure)
- [How to Run Locally](#how-to-run-locally)
- [How to Deploy on Vercel](#how-to-deploy-on-vercel)
- [Core Files](#core-files)
- [Current Features](#current-features)
- [Commands](#commands)
- [Storage Model](#storage-model)
- [Configuration Guide](#configuration-guide)
- [Development Rules](#development-rules)
- [Roadmap](#roadmap)
- [Future Server Plan](#future-server-plan)
- [Security and Moderation Notes](#security-and-moderation-notes)
- [Troubleshooting](#troubleshooting)
- [Git Workflow](#git-workflow)

---

## Project Philosophy

Index0 is intended to be:

- simple
- lightweight
- private-feeling
- easy to understand
- easy to modify
- slow and steady in development
- free from unnecessary frameworks for now

The goal is not to clone Discord immediately.

The goal is to build the feeling and structure first, then slowly add real functionality when the base is stable.

Current direction:

```txt
Prototype first.
Structure second.
Backend later.
Complexity only when needed.
```

---

## Current Status

Index0 is currently a **static front-end prototype**.

That means:

- it runs in the browser
- messages are stored in `localStorage`
- channels are local to each browser
- DMs are local to each browser
- users are simulated/local
- unread indicators are structural/local
- it can deploy to Vercel as a static site

It does **not** yet have:

- real accounts
- real authentication
- real-time multiplayer chat
- database persistence
- server-side message sync
- cross-device message sync

This is expected for the current phase.

---

## Folder Structure

Recommended structure:

```txt
Index0/
├── index.html
├── README.md
├── css/
│   └── style.css
└── js/
    ├── state.js
    ├── storage.js
    ├── ui.js
    ├── commands.js
    └── app.js
```

### Why this structure?

Each file has one main job.

This keeps the project clean as it grows.

```txt
state.js     = app state and defaults
storage.js   = localStorage logic
ui.js        = rendering and visual updates
commands.js  = slash command handling
app.js       = startup and event listeners
style.css    = all styling
index.html   = page layout only
```

Avoid putting everything back into one giant file unless you are making a very small test.

---

## How to Run Locally

### Option 1: Open directly

You can open `index.html` directly in your browser.

```txt
Index0/index.html
```

This is fine for early testing.

### Option 2: Use a simple local server

If you want a more realistic local test, use a small static server.

If Python is installed:

```bash
python -m http.server 5500
```

Then open:

```txt
http://localhost:5500
```

This better matches how the site behaves when deployed.

---

## How to Deploy on Vercel

Index0 can currently deploy as a static site.

### Basic Vercel setup

1. Push the project to GitHub.
2. Go to Vercel.
3. Import the GitHub repo.
4. Keep framework settings as static/default.
5. Deploy.

For the current version, no build command is needed.

```txt
Build Command: leave empty
Output Directory: leave empty
Install Command: leave empty
```

### Important

Make sure `index.html` is in the project root.

Vercel should be able to serve it directly.

---

## Core Files

### `index.html`

The main page layout.

It should contain:

- left sidebar
- channel list container
- DM list container
- main chat area
- top bar
- nickname input
- message input
- right user list
- script imports

Keep this file mostly structural.

Avoid putting big JavaScript logic directly in here.

---

### `css/style.css`

Controls the look of the site.

Current visual direction:

- black background
- cyan accent
- monospace font
- minimal Discord-like layout
- underground/terminal feel

Keep all visual changes here.

Examples:

- sidebar width
- colors
- spacing
- message appearance
- mobile layout

---

### `js/state.js`

Stores default app state.

This includes:

- current nickname
- current mode
- current channel
- current DM
- known channels
- known DMs
- known users
- unread state
- anti-spam timing

Example responsibilities:

```txt
What room am I in?
What is my nickname?
What users are known locally?
What channels exist locally?
```

Do not put rendering code here.

---

### `js/storage.js`

Handles browser storage.

This file manages:

- saving core state
- loading messages
- saving messages
- adding messages
- unread indicators
- active storage keys

Current storage is based on `localStorage`.

Later, when a backend exists, this file will likely be replaced or expanded.

---

### `js/ui.js`

Handles rendering.

This includes:

- rendering messages
- rendering channels
- rendering DMs
- rendering users
- updating the header
- opening DMs from user clicks
- generating handle colors

Rule of thumb:

```txt
If it changes what the user sees, it probably belongs in ui.js.
```

---

### `js/commands.js`

Handles slash commands.

Current commands include:

- `/help`
- `/nick`
- `/join`
- `/dm`
- `/users`
- `/clear`
- `/me`

Rule of thumb:

```txt
If it starts with /, commands.js should deal with it.
```

---

### `js/app.js`

Starts the app.

This file handles:

- button click events
- Enter key events
- nickname setting
- message sending
- startup initialization
- basic rate limiting

Keep this file as the controller.

It should connect the other files together, not contain everything itself.

---

## Current Features

### Channels

Channels behave like local rooms.

Example:

```txt
/join main
/join random
/join dev
```

Each channel has its own local message history.

---

### Direct Messages

DMs are currently local-only.

Example:

```txt
/dm ghost
/dm cipher
```

Clicking a user in the user list also opens a DM.

---

### User List

The user list currently shows known local users.

Default users may include:

```txt
system
ghost
cipher
```

When you set your nickname, your nickname is added to the local user list.

This is not a real online presence system yet.

---

### Unread Indicators

Unread indicators are supported structurally.

They appear as small cyan dots beside channels or DMs.

In the current local-only version, unread behavior is mostly groundwork for the future real-time version.

---

### Nicknames

Nicknames are stored locally.

Set a nickname with:

```txt
/nick yourname
```

Or use the nickname input box.

Spaces are converted to underscores.

---

### Local Persistence

Messages remain after refresh because they are stored in `localStorage`.

Clearing browser data will remove local messages.

---

## Commands

### `/help`

Shows available commands.

```txt
/help
```

---

### `/nick NAME`

Sets your handle.

```txt
/nick logic
```

Spaces become underscores.

```txt
/nick logic user
```

Becomes:

```txt
logic_user
```

---

### `/join ROOM`

Joins or creates a local channel.

```txt
/join dev
```

If the channel does not exist locally, it is added to the sidebar.

---

### `/dm USER`

Opens a local DM with a user.

```txt
/dm ghost
```

If the user does not exist locally, they are added to the known user list.

---

### `/users`

Shows known local users.

```txt
/users
```

---

### `/clear`

Clears the currently active chat.

```txt
/clear
```

This only clears the current channel or DM in the current browser.

---

### `/me ACTION`

Adds an action-style system message.

```txt
/me waves
```

Example output:

```txt
* logic waves
```

---

## Storage Model

Index0 currently uses browser `localStorage`.

### Core keys

```txt
index0_nick
index0_mode
index0_current_channel
index0_current_dm
index0_channels
index0_dms
index0_users
index0_unread
```

### Channel message keys

```txt
index0_channel_main
index0_channel_random
index0_channel_dev
```

### DM message keys

```txt
index0_dm_ghost
index0_dm_cipher
```

### Message shape

Messages currently look like this:

```js
{
    time: "21:15:30",
    text: "hello world",
    handle: "logic",
    type: "user"
}
```

System messages look like this:

```js
{
    time: "21:15:30",
    text: "Joined #dev",
    handle: "SYSTEM",
    type: "system"
}
```

---

## Configuration Guide

This section is for when the project becomes complex.

### Change default channels

Edit `js/state.js`:

```js
channels: JSON.parse(localStorage.getItem('index0_channels') || '["main","random"]')
```

Example:

```js
channels: JSON.parse(localStorage.getItem('index0_channels') || '["main","dev","logs"]')
```

---

### Change default users

Edit `js/state.js`:

```js
users: JSON.parse(localStorage.getItem('index0_users') || '["system","ghost","cipher"]')
```

Example:

```js
users: JSON.parse(localStorage.getItem('index0_users') || '["system","admin","guest"]')
```

---

### Change message limit

Edit `js/storage.js`:

```js
JSON.stringify(messages.slice(-250))
```

Example:

```js
JSON.stringify(messages.slice(-500))
```

This keeps the last 500 messages per channel or DM.

---

### Change anti-spam delay

Edit `js/app.js`:

```js
if (now - state.lastMessageTime < 400) {
    return;
}
```

Higher number means slower sending.

Lower number means faster sending.

---

### Change visual theme

Edit `css/style.css` variables:

```css
:root {
    --bg: #000000;
    --panel: #050505;
    --accent: #00f0ff;
}
```

Main useful values:

```txt
--bg          main background
--panel       sidebar and userbar background
--accent      cyan highlight color
--text        normal text
--muted       secondary text
--border      borders
```

---

## Development Rules

To keep Index0 clean, follow these rules.

### 1. No frameworks yet

Avoid:

- React
- Vue
- Angular
- Next.js
- Svelte
- heavy build tools

Plain HTML/CSS/JS is enough for now.

---

### 2. One file, one job

Do not put everything into `app.js`.

Use this pattern:

```txt
State changes      -> state.js
Saving/loading     -> storage.js
Visual updates     -> ui.js
Slash commands     -> commands.js
Startup/events     -> app.js
```

---

### 3. Add features slowly

Before adding a feature, ask:

```txt
Does this help the core chat experience?
Can this be done simply?
Will this make future server work easier?
```

---

### 4. Keep UI minimal

Index0 should feel:

- quiet
- sharp
- minimal
- slightly hidden
- fast

Avoid bloated UI.

---

### 5. Avoid unsafe rendering

Prefer `textContent` instead of `innerHTML` for user messages.

Reason:

Users may type HTML-like text.

Using `textContent` prevents that text from being treated as real HTML.

---

## Roadmap

### Phase 1: Local Prototype

Status: mostly done

- static HTML/CSS/JS
- local messages
- nickname system
- channels
- DMs
- user list
- sidebar
- unread structure

---

### Phase 2: Better Local Testing

Suggested next features:

- fake user command
- fake incoming messages
- better unread testing
- simple settings panel
- export/import local chat logs

Possible command:

```txt
/fake ghost hello from another user
```

This would let you test multi-user style behavior before adding a server.

---

### Phase 3: Real-Time Server Prep

Before adding the server, decide:

- what a user object looks like
- what a message object looks like
- what a room object looks like
- what events the client sends
- what events the server sends

Example events:

```txt
client:join_channel
client:send_message
client:open_dm
server:new_message
server:user_joined
server:user_left
```

---

### Phase 4: Real-Time Server

Future stack idea:

```txt
Frontend: plain HTML/CSS/JS
Server: Node.js
Realtime: WebSocket
Storage: JSON file first, database later
```

Do not jump straight to a database unless needed.

A simple server can come first.

---

### Phase 5: Accounts and Access

Future possibilities:

- invite codes
- basic usernames
- room passwords
- hidden room names
- admin/mod roles
- private server deployment

---

### Phase 6: Moderation and Rules

Future moderation tools:

- delete message
- mute user
- ban user
- lock channel
- slow mode
- simple audit log

---

## Future Server Plan

When Index0 becomes real-time, the architecture will change.

Current:

```txt
Browser
└── localStorage
```

Future:

```txt
Browser
└── WebSocket connection
    └── Node.js server
        └── storage layer
```

Possible future files:

```txt
Index0/
├── public/
│   ├── index.html
│   ├── css/
│   └── js/
├── server/
│   ├── server.js
│   ├── rooms.js
│   ├── users.js
│   └── messages.js
├── data/
│   └── messages.json
├── package.json
└── README.md
```

But this is later.

For now, keep the static version clean.

---

## Security and Moderation Notes

Index0 should eventually include rules and protections.

Important future concerns:

- user-generated content
- spam
- impersonation
- abusive messages
- room access control
- moderation tools
- message deletion
- logs and auditability

For now, because this is local-only, security risk is limited.

But once a server exists, moderation should become a core feature, not an afterthought.

---

## Troubleshooting

### CSS is not loading

Check `index.html`.

The stylesheet link should look like this:

```html
<link rel="stylesheet" href="css/style.css">
```

Not plain text.

---

### JavaScript is not loading

Script tags should look like this:

```html
<script src="js/state.js"></script>
<script src="js/storage.js"></script>
<script src="js/ui.js"></script>
<script src="js/commands.js"></script>
<script src="js/app.js"></script>
```

Order matters.

`app.js` should load last.

---

### Messages disappeared

Possible reasons:

- browser localStorage was cleared
- you switched channels
- you cleared the chat with `/clear`
- you are using a different browser/device

Remember: messages are local for now.

---

### Vercel deployed but page is blank

Check:

- `index.html` exists in the root folder
- script tags are correct
- file names match exactly
- folder names are lowercase as expected
- browser console for errors

---

### Sidebar channels disappeared

Channels are stored in localStorage.

If browser storage is cleared, custom local channels reset.

Default channels come from `js/state.js`.

---

## Git Workflow

Basic workflow:

```bash
git status
git add .
git commit -m "Describe the change"
git push origin main
```

Recommended commit style:

```txt
Add channel sidebar
Add local DM system
Improve README documentation
Fix script paths
Update chat styling
```

Avoid vague commit messages like:

```txt
update
stuff
changes
final
```

---

## Suggested Commit for This README

```bash
git add README.md
git commit -m "Add organised project README"
git push origin main
```

---

## Current Recommended Next Step

Add a local testing command for fake users.

Example:

```txt
/fake ghost testing unread indicators
```

This would help test:

- unread dots
- other-user messages
- user list behavior
- future server-like flow

without building the real server yet.

---

## Project Motto

```txt
Slow and steady wins the race.
Simple first. Strong later.
```
