# AI Usage Dashboard

Claude + GitHub Copilot usage dashboard for Zyte.

## Setup (2 minutes)

### 1. Install Node.js
Download from https://nodejs.org (LTS version)

### 2. Extract this folder, open terminal inside it, run:
```
npm install
npm start
```

### 3. Open your browser at:
```
http://localhost:3000
```

---

## API Keys Needed

### Claude Tab
- Go to **console.anthropic.com** → Settings → API Keys
- Create an **Admin** key (not a regular API key)
- Paste it into the Claude tab

### Copilot Tab
- Go to **github.com** → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
- Required scopes: `manage_billing:copilot`, `read:org`
- Paste token + your org name (e.g. `Zyte`) into the Copilot tab

---

## Notes
- Keys are never stored — they stay in your browser session only
- The server runs locally; no data leaves your machine except to the official APIs
- Port 3000 is used by default; change `PORT` in server.js if needed
