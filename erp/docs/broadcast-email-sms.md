# Marketing broadcasts: Email and SMS

The marketing broadcast module now supports **Email** and **SMS**. WhatsApp is
no longer offered in the composer (the legacy route and historical rows remain
valid for backwards compatibility).

## Channels

| Channel | Recipient requirement | Body |
| --- | --- | --- |
| `EMAIL` | Customer has a non-empty `email` | Subject + HTML template (plain-text fallback optional) |
| `SMS` | Customer has a non-empty `phone` | Plain text, maximum 500 characters |
| `WHATSAPP` (legacy) | Customer has a phone | Plain text |

The audience count and preview endpoints take a `channel` parameter, so a
customer without an email address is excluded from an email send (and the same
for SMS/phone).

## Email templates and images

The composer ships four starter templates (`Blank`, `Promotion`, `Newsletter`,
`Birthday greeting`) and lets the author edit the raw HTML. Supported
placeholders:

- `{{name}}` — customer's first name
- `{{storeName}}` — tenant/business name

Placeholders are replaced per recipient in both the subject and body.

### Attaching images

1. Upload images through `POST /api/store/upload/broadcast-image` (JPEG, PNG,
   WebP, GIF, max 5 MB, up to 10 per broadcast). The response is
   `{ url, path }` with a public URL.
2. The composer shows thumbnails and lets the author remove any image.
3. At send time each image is:
   - appended to the HTML body as a gallery (unless the template already
     embeds that URL), and
   - passed to Resend as an email attachment (`path` + filename).

The message can be previewed in the composer and again in the confirmation
dialog using a sandboxed iframe (no `dangerouslySetInnerHTML`).

## API

### `POST /api/broadcast/send`

Permission: `broadcast:send`.

```jsonc
// Email
{
  "channel": "EMAIL",
  "subject": "{{name}}, a special offer from {{storeName}}",
  "html": "<p>Hi {{name}}, ...</p>",
  "message": "Hi {{name}}, ...",          // optional plain-text fallback
  "imageUrls": ["https://cdn.example.com/promo.jpg"],
  "filters": { "tags": "VIP", "gender": "FEMALE", "birthdayMonth": 11 }
}

// SMS
{
  "channel": "SMS",
  "message": "Hi {{name}}! Visit {{storeName}} this week.",
  "filters": { "minSpend": 5000 }
}
```

Responses:

- `202` — `{ broadcastId, channel, status: "SENDING", total, providerConfigured }`.
  The audit row is written before dispatch and the send loop continues after
  the response (M31-03).
- `422 NO_RECIPIENTS` — no reachable customers matched the filters.
- `400 VALIDATION_ERROR` — missing subject/body, an SMS over 500 characters, a
  bad image URL, or more than 10 images.

Email dispatch uses `sendEmail()` (Resend) with the subject, HTML, plain-text
fallback and image attachments. SMS dispatch uses `sendSmsMessage()`, which
posts to a generic gateway.

## Providers

Email (existing):

```
RESEND_API_KEY=...
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

SMS (new):

```
SMS_API_URL=https://gateway.example.com/send
SMS_API_KEY=...
SMS_SENDER_ID=AyurPOS
```

The gateway is expected to accept:

```http
POST SMS_API_URL
Authorization: Bearer <SMS_API_KEY>
Content-Type: application/json

{ "to": "+947XXXXXXXX", "message": "...", "sender": "AyurPOS" }
```

Missing credentials produce a structured `SMS_NOT_CONFIGURED` / email
`provider-not-configured` result; the send route returns `providerConfigured:
false` so the UI can warn before the user leaves the page.

`GET /api/health` exposes `integrations.sms.configured` once the two SMS
variables are present.

## Storage / history

Migration `20261106050000_broadcast_channels` adds:

- enum `BroadcastChannel` (`EMAIL`, `SMS`, `WHATSAPP`)
- `CustomerBroadcast.channel` (default `EMAIL`)
- `CustomerBroadcast.subject`
- `CustomerBroadcast.htmlBody`
- `CustomerBroadcast.imageUrls` (`TEXT[]`)

Status and counters remain in the existing `filters` JSON
(`{ criteria, status, analytics }`). The history page shows the channel badge,
subject (for email) and analytics; detail responses include the channel, subject,
HTML body and image URLs.

## Tests

- `src/lib/broadcast/__tests__/templates.test.ts` — personalisation, HTML
  fallback, image-gallery appending/deduplication, SMS rendering and the
  template catalogue.
- `src/lib/validators/__tests__/broadcast.validators.test.ts` — channel-specific
  payload validation (email subject/body, SMS limits, image URL/count bounds).
