// Shared portal helper: JSON fetch + accessible result announcements.
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  let body = {}
  try { body = await res.json() } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, body }
}

function say(message, isError) {
  const el = document.getElementById('result')
  if (!el) return
  el.textContent = message
  el.setAttribute('data-state', isError ? 'error' : 'ok')
}

function wireForm(id, handler) {
  const form = document.getElementById(id)
  if (!form) return
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    say('Working…', false)
    try {
      await handler(new FormData(form))
    } catch {
      say('Something went wrong. Try again.', true)
    }
  })
}

const page = document.body.dataset.page

if (page === 'signup') {
  wireForm('signup-form', async (fd) => {
    const { ok, body } = await postJSON('/api/accounts/signup', {
      email: fd.get('email'), password: fd.get('password'),
    })
    say(body.emailStatus === 'unavailable' ? 'Email verification is required before sign-in. Delivery is currently unavailable.' : body.message || body.error || 'Done.', !ok)
  })
  wireForm('resend-form', async (fd) => {
    const { ok, body } = await postJSON('/api/accounts/resend', { email: fd.get('email') })
    say(body.message || body.error || 'Done.', !ok)
  })
}

if (page === 'login') {
  wireForm('login-form', async (fd) => {
    const { ok, body } = await postJSON('/api/accounts/login', {
      email: fd.get('email'), password: fd.get('password'),
    })
    say(ok ? 'Logged in. Opening your account…' : (body.error || 'Login failed.'), !ok)
    if (ok) window.location.assign('/account.html')
  })
}

if (page === 'verify') {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token')
  window.history.replaceState(null, '', window.location.pathname)
  wireForm('verify-form', async () => {
    if (!token) { say('This verification link is incomplete.', true); return }
    try {
      const { ok, body } = await postJSON('/api/accounts/verify', { token })
      say(body.message || body.error || 'Done.', !ok)
    } catch { say('Something went wrong. Try again.', true) }
  })
}

if (page === 'reset') {
  const preset = new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token')
  window.history.replaceState(null, '', window.location.pathname)
  if (preset) {
    const input = document.getElementById('token')
    if (input) input.value = preset
  }
  wireForm('request-form', async (fd) => {
    const { body } = await postJSON('/api/accounts/password/request', { email: fd.get('email') })
    say(body.message || body.error || 'Done.', !!body.error)
  })
  wireForm('confirm-form', async (fd) => {
    const { ok, body } = await postJSON('/api/accounts/password/confirm', {
      token: fd.get('token'), password: fd.get('password'),
    })
    say(body.message || body.error || 'Done.', !ok)
  })
}

if (page === 'account') {
  ;(async () => {
    try {
      const res = await fetch('/api/portal/status')
      const body = await res.json()
      if (!res.ok) { say('Your session expired. Please log in again.', true); return }
      document.getElementById('status-email').textContent = body.email || '—'
      document.getElementById('status-verified').textContent = body.emailVerified ? 'verified' : 'unverified'
      document.getElementById('status-mail').textContent = body.sender && body.sender.configured
        ? 'configured' : 'unavailable — verification mail is paused until a sender is configured'
      const facility = body.provisioning
      document.getElementById('status-activation').textContent = facility.status === 'ready'
        ? 'Facility activated by owner.' : facility.status === 'awaiting-owner-activation'
          ? 'Awaiting owner activation. No resources are created automatically.' : 'No cloud activation requested.'
      document.getElementById('activation-form').hidden = facility.status === 'ready'
      if (facility.appOrigin) {
        const paragraph = document.getElementById('facility-link')
        const link = document.createElement('a')
        link.href = facility.appOrigin
        link.textContent = 'Open your facility'
        paragraph.appendChild(link)
        paragraph.hidden = false
      }
      if (facility.setupKey) {
        const paragraph = document.getElementById('facility-key')
        paragraph.textContent = 'Private first-run setup key: ' + facility.setupKey + '. Use it only in your facility setup screen; keep it confidential.'
        paragraph.hidden = false
      }
    } catch { say('Could not load account status.', true) }
  })()
  wireForm('activation-form', async (fd) => {
    const { ok, body } = await postJSON('/api/portal/activation-request', { plan: fd.get('plan') })
    if (ok) document.getElementById('status-activation').textContent = 'Awaiting owner activation. No resources are created automatically.'
    say(ok ? 'Your request was recorded for manual review.' : body.error || 'Request failed.', !ok)
  })
  wireForm('logout-form', async () => {
    const { ok } = await postJSON('/api/accounts/logout', {})
    if (ok) window.location.assign('/')
    else say('Logout failed. Try again.', true)
  })
}
