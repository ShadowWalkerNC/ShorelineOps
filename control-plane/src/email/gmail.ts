// Gmail HTTPS OAuth2 adapter. Uses the Gmail REST API only — no SMTP protocol
// code and no mail dependency. Reads GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET /
// GMAIL_REFRESH_TOKEN / GMAIL_SENDER from the environment; values are never
// logged, returned, or persisted.
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

interface GmailCreds {
  id: string
  secret: string
  refresh: string
  sender: string
}

function creds(): GmailCreds | null {
  const id = (process.env.GMAIL_CLIENT_ID ?? '').trim()
  const secret = (process.env.GMAIL_CLIENT_SECRET ?? '').trim()
  const refresh = (process.env.GMAIL_REFRESH_TOKEN ?? '').trim()
  const sender = (process.env.GMAIL_SENDER ?? '').trim()
  if (!id || !secret || !refresh || !/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(sender)) return null
  return { id, secret, refresh, sender }
}

// Honest gate: callers report `configured: false` as unavailable, never as sent.
export function gmailStatus(): { configured: boolean } {
  return { configured: creds() !== null }
}

export type GmailSendResult = { ok: true } | { ok: false; unavailable?: boolean; error?: string }

export async function sendViaGmail(to: string, subject: string, text: string): Promise<GmailSendResult> {
  const c = creds()
  if (!c) return { ok: false, unavailable: true }
  if (/[\r\n]/.test(to + subject)) return { ok: false, error: 'invalid_mail_header' }
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.id,
        client_secret: c.secret,
        refresh_token: c.refresh,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!tokenRes.ok) return { ok: false, error: `token_refresh_${tokenRes.status}` }
    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    if (!tokenJson.access_token) return { ok: false, error: 'token_refresh_no_token' }

    const raw = Buffer.from(
      `From: ${c.sender}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}`,
      'utf8'
    ).toString('base64url')
    const sendRes = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(10000),
    })
    if (!sendRes.ok) return { ok: false, error: `gmail_send_${sendRes.status}` }
    const sent = await sendRes.json() as { id?: string }
    return typeof sent.id === 'string' && sent.id ? { ok: true } : { ok: false, error: 'gmail_send_no_receipt' }
  } catch (err) {
    return { ok: false, error: 'send_failed' }
  }
}
