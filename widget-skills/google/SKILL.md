---
name: google
description: Google Calendar and Gmail integration via OAuth. View/create calendar events, read/send emails.
metadata: {"clawdbot":{"emoji":"📅","requires":{"bins":["python3","google"]}}}
---

# Google Services (Calendar + Gmail)

Access user's Google Calendar and Gmail through OAuth authorization.

## Authorization

Each feature requires its own permission. When a user first uses a feature, the script outputs an authorization link if they haven't granted the required permission yet. Send this link to the user.

### Check Authorization Status

```bash
# Show which permissions are authorized and which need setup
google auth check
```

### Setup Permissions

```bash
# Request authorization for ALL permissions at once (recommended)
google auth setup

# Request specific permissions only
google auth setup --scopes calendar
google auth setup --scopes gmail-read,gmail-send
```

Available scopes: `calendar`, `gmail-read`, `gmail-send`

### Authorization Flow

1. When user tries a feature they haven't authorized, the script outputs an auth link
2. The auth link requests ALL permissions so user can authorize everything at once
3. On Google's consent screen, user sees all requested permissions and can approve
4. After authorization, the feature works automatically
5. If user needs additional permissions later, a new auth link is provided

## Calendar Commands

```bash
# List upcoming events (default: next 7 days)
google calendar list

# List events for specific date range
google calendar list --from 2026-02-10 --to 2026-02-17

# Create a calendar event
google calendar create --title "Team meeting" --start "2026-02-11T14:00:00" --end "2026-02-11T15:00:00"

# Create event with description and location
google calendar create --title "Lunch" --start "2026-02-11T12:00:00" --end "2026-02-11T13:00:00" --description "At the Italian place" --location "123 Main St"

# Delete an event by ID
google calendar delete --event-id abc123
```

## Gmail Commands

```bash
# List recent emails (default: 10)
google gmail list

# List unread emails only
google gmail list --unread

# List more emails
google gmail list --max 20

# Read a specific email by ID
google gmail read --id 18d5a2b3c4e5f6

# Send an email
google gmail send --recipient user@example.com --subject "Hello" --body "Message content"
```

## Permissions

| Scope | Permission | Actions |
|-------|-----------|---------|
| `calendar` | Google Calendar (read/write) | calendar list, create, delete |
| `gmail-read` | Gmail (read emails) | gmail list, gmail read |
| `gmail-send` | Gmail (send emails) | gmail send |

## Notes

- First call outputs an OAuth link if user hasn't authorized the required permission — send it to the user
- Use `google auth check` to see which permissions are granted
- Use `google auth setup` to authorize all permissions at once
- After authorization, tokens are managed automatically (auto-refresh)
- Each API call is lightweight and does not consume user energy
