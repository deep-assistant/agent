---
'@link-assistant/agent': patch
---

fix: Google OAuth authentication race condition

Previously, when running `agent auth login` with Google OAuth, the authentication
would fail with a redirect to `localhost:0` because of a race condition in port
assignment. The redirect URI was built before the server port was actually assigned.

Root cause: `server.listen(0, callback)` assigns the port asynchronously in the
callback, but the redirect URI was built before the callback fired.

Now, when authenticating with Google:

- Port is discovered and assigned before building the redirect URI
- Supports `GOOGLE_OAUTH_CALLBACK_PORT` environment variable for containers
- Follows Google's recommended localhost redirect flow for installed applications

This fix resolves issue #78 ("Не работает авторизация в Google").
