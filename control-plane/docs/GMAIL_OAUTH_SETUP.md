# Gmail OAuth2 sender setup (local authorization guide)

No credentials appear in this guide or in the repository. All values below live
only in the operator's machine and the hosting provider's environment settings.

## What this enables

The control plane sends account verification and password-reset mail through
the Gmail REST API as the operator-selected sender mailbox. Required variable
names (values never committed):

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER` (the selected sender mailbox address)

Until all four are set, the service reports mail as `unavailable`: signups stay
unverified, resend answers `503 EMAIL_UNAVAILABLE`, and portal status shows
`sender.configured: false`. Nothing is ever reported as sent when it was not.

## Steps (operator machine only)

1. In Google Cloud Console, create (or reuse) a project and enable the
   **Gmail API**.
2. Configure the OAuth consent screen for the sender mailbox account.
   Request only the `https://www.googleapis.com/auth/gmail.send` scope.
3. Create an OAuth client (Desktop type for a one-time local authorization).
   Record the client ID and client secret in the hosting provider's secret
   store — never in git, chat, or a `.env` file in this repo.
4. Run a one-time local OAuth authorization loopback flow in a browser on the
   operator machine to approve `gmail.send` for the sender mailbox, and copy
   the resulting **refresh token** into the hosting provider's secret store.
5. Set `GMAIL_SENDER` to the sender mailbox address exactly as shown in Gmail.
6. Restart (or redeploy) the control-plane service and check
   `GET /api/portal/status` while logged in: `sender.configured` should be
   `true`. Queued outbox rows then dispatch with retries and backoff.

On Windows the repository provides a helper for step 4:

```powershell
node control-plane/scripts/authorize-gmail.cjs C:\path\outside-repository\client.json sender@example.com
```

Use the selected real sender address in place of the example. The helper opens
Google's consent screen with PKCE and state validation and receives the code
on a temporary loopback port. It never sends mail or prints credential values.
It writes the four settings as a DPAPI-encrypted SecureString bundle at
`%LOCALAPPDATA%\ShorelineOps-control\gmail-oauth.xml`, readable by the same
Windows user. This local bundle is not a Railway deployment configuration.
Keep the downloaded client JSON outside the repository too. Hosting secret
injection and an actual verification/recovery delivery test are separate steps.

## Rotation and revocation

- Rotate by issuing a new refresh token (repeat step 4) and replacing the
  stored value; no code change is needed.
- Revoke at any time from the Google account's third-party access page. Delivery
  then fails and retries with a redacted error. `sender.configured` describes
  environment configuration, not whether Google still accepts the grant.
- If mail must pause, unset any one of the four variables: the gate fails
  closed to `unavailable` with queued mail retained for later dispatch.

External OAuth apps in Google's Testing status normally receive refresh tokens
that expire after seven days for this scope. Configure the publishing status
and meet Google's applicable requirements before unattended production use.
Do not treat a successful one-time consent as ongoing delivery acceptance.

Official references:
- [Desktop loopback authorization](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Refresh-token expiration](https://developers.google.com/identity/protocols/oauth2)
- [Gmail send API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
