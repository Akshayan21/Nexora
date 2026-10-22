# Connect Gmail locally

The Settings page supports connecting Gmail, displaying connected addresses, and disconnecting/revoking access. Credentials are encrypted in PostgreSQL with Fernet. The browser receives only connection metadata and an expiring HttpOnly OAuth handshake cookie. OAuth uses state validation, browser binding, workspace/user binding, a ten-minute expiry, and PKCE.

This feature requests Gmail read-only access to verify the mailbox. It does not send messages, synchronize the inbox, or start campaigns. The existing local development API bridge supports a single local user; production login remains separate work.

## Google setup

1. In https://console.cloud.google.com/, create/select your project and enable Gmail API.
2. Configure Google Auth Platform branding and audience. For external testing, add your Gmail address as a test user.
3. Create an OAuth client with application type **Web application**.
4. Add this exact authorized redirect URI:

   `http://localhost:3000/api/mailboxes/google/callback`

   This replaces the earlier planned callback on port 8000. Use the dashboard on localhost, not its LAN address. If you use a different dashboard port, update both Google's authorized redirect and GOOGLE_REDIRECT_URI to match.

5. Edit the ignored root `.env` locally:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/mailboxes/google/callback
   ```

   Do not paste your client secret into chat or commit `.env`.

6. Prepare encryption and the default callback, if needed:

   ```powershell
   .venv/Scripts/python.exe scripts/configure-gmail.py
   ```

   This preserves a valid TOKEN_ENCRYPTION_KEY. Keep this key stable and private: losing/changing it makes stored credentials unreadable.

## Start and connect

From the repository root, start the database and apply migrations:

```powershell
./scripts/start-database.ps1
```

In one terminal, start the backend (restart it after changing `.env`):

```powershell
cd services/control-api
.venv/Scripts/python.exe -m app.auth.bootstrap --email dev@outreach.invalid --workspace "Local development"
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, from the repository root:

```powershell
npm.cmd run dev
```

Visit http://localhost:3000/settings in **API data** mode (turn off **Mock data** if enabled), click **Connect Gmail**, choose your account, and grant permission. The page displays the connected address after Google redirects back. Disconnect revokes the Google grant and removes the encrypted credentials. Revocation can affect other connected mailboxes using the same Google OAuth grant in another workspace.

## Troubleshooting

- Setup error: fill in the Google credentials and ensure TOKEN_ENCRYPTION_KEY is a valid Fernet key, then restart the backend.
- Local API credentials expired: rerun the backend bootstrap and restart the dashboard.
- `redirect_uri_mismatch`: Google's authorized redirect must exactly match GOOGLE_REDIRECT_URI, including host, port, and path.
- Access denied: ensure your Google account is an allowed test user and your Workspace administrator permits the app.
- Cancelled/expired flow: click Connect Gmail again. Starting another connection replaces the pending sign-in in that browser.
- In external Testing mode, Google may expire the refresh token after seven days; reconnect when needed. Connection status reflects stored authorization, not a continuous check of access revoked outside the app.
- If disconnect cannot contact Google, retry or revoke the app through your Google Account permissions.

Reference: https://developers.google.com/identity/protocols/oauth2/web-server

## Verification

```powershell
.venv/Scripts/python.exe -m pytest tests/integration/test_gmail_api.py tests/integration/test_gmail_state.py -q
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run typecheck
```

API tests use local migrated PostgreSQL with rolled-back records and mocked Google responses. A real Google consent flow requires your own OAuth client and account.
