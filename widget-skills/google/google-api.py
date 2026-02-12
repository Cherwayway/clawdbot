#!/usr/bin/env python3
"""
Google Calendar/Gmail SKILL — uses organics OAuth proxy.

OAuth flow:
1. Call POST /v1/oauth/get_access_token on organics with tg2app_bot_id=100001
2. If no token (user not authorized) → returns auth_url for user to click
3. If authorized → returns access_token, use it to call Google APIs directly

Scope management:
- Each action only checks its own required scope (fast path)
- When auth is needed, requests ALL scopes together to avoid overwriting
  previously authorized scopes (organics bug: new auth overwrites old token)
- `google auth check` shows per-scope authorization status
- `google auth setup` requests all scopes at once for initial setup
"""

import argparse
import json
import sys
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta, timezone

TG2APP_BOT_ID = 100001

# Scopes per service/action — only request what's needed for checking
SCOPES = {
    "calendar": ["https://www.googleapis.com/auth/calendar"],
    "gmail.list": ["https://www.googleapis.com/auth/gmail.readonly"],
    "gmail.read": ["https://www.googleapis.com/auth/gmail.readonly"],
    "gmail.send": ["https://www.googleapis.com/auth/gmail.send"],
}

# All unique scopes (used when requesting auth to avoid overwriting)
ALL_SCOPES = list(set(s for ss in SCOPES.values() for s in ss))

# Human-readable scope descriptions
SCOPE_NAMES = {
    "calendar": "Google Calendar (read/write events)",
    "gmail.list": "Gmail (read emails)",
    "gmail.read": "Gmail (read emails)",
    "gmail.send": "Gmail (send emails)",
    "https://www.googleapis.com/auth/calendar": "Google Calendar (read/write events)",
    "https://www.googleapis.com/auth/gmail.readonly": "Gmail (read emails)",
    "https://www.googleapis.com/auth/gmail.send": "Gmail (send emails)",
}


def api_request(url, method="GET", headers=None, data=None, timeout=30):
    """Make HTTP request and return parsed JSON."""
    headers = headers or {}
    # Use curl User-Agent to avoid Cloudflare WAF blocking Python-urllib
    if "User-Agent" not in headers:
        headers["User-Agent"] = "curl/7.88.1"
    req_data = json.dumps(data).encode() if data else None
    if req_data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        try:
            return json.loads(body)
        except Exception:
            return {"_http_error": e.code, "_body": body[:500]}
    except urllib.error.URLError as e:
        print(f"Error: Connection failed - {e.reason}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# OAuth token management — via organics proxy
# ---------------------------------------------------------------------------

def request_token(api_base, user_id, scopes):
    """Request token from organics. Returns (token, auth_url, error_msg)."""
    url = f"{api_base}/v1/oauth/get_access_token"
    body = {
        "userId": int(user_id),
        "providerName": "google",
        "scopes": scopes,
        "tg2appBotId": TG2APP_BOT_ID,
    }
    resp = api_request(url, method="POST", data=body)

    # Check for HTTP errors
    if resp.get("_http_error"):
        code = resp["_http_error"]
        err_body = resp.get("_body", "")
        if code == 500:
            return None, None, (
                "Google authorization may have been revoked or expired.\n"
                "The backend failed to refresh the token. Please try re-authorizing.\n"
                f"\nTechnical details: HTTP {code} - {err_body[:200]}"
            )
        return None, None, f"OAuth endpoint returned HTTP {code}: {err_body}"

    # Protobuf JSON uses camelCase: accessToken, authUrl
    token = resp.get("accessToken") or resp.get("access_token")
    if token:
        return token, None, None

    auth_url = resp.get("authUrl") or resp.get("auth_url")
    if auth_url:
        return None, auth_url, None

    return None, None, (
        "Google authorization may have been revoked. "
        "Please ask an admin to clear the old token, then try again.\n"
        f"\nTechnical details: response had no accessToken or authUrl: {json.dumps(resp)[:300]}"
    )


def get_token_or_auth(api_base, user_id, action_scopes, scope_key):
    """Get token for an action, or show auth URL with ALL scopes if needed.

    Strategy:
    1. Check if the action's specific scope is authorized (fast path)
    2. If not, request auth with ALL scopes to avoid overwriting existing ones
       (organics overwrites the token on new auth — requesting all scopes
       ensures the user doesn't lose previously authorized scopes)
    """
    # Fast path: check if this action's scope is already authorized
    token, auth_url, error = request_token(api_base, user_id, action_scopes)

    if token:
        return token

    if error:
        print(error, file=sys.stderr)
        sys.exit(1)

    # Auth needed — request ALL scopes to avoid overwriting existing ones
    scope_name = SCOPE_NAMES.get(scope_key, scope_key)
    print(f"Google authorization required for: **{scope_name}**\n")

    # Get auth URL with all scopes (prevents losing previously authorized scopes)
    _, all_auth_url, all_error = request_token(api_base, user_id, ALL_SCOPES)
    final_url = all_auth_url or auth_url

    if final_url:
        print("Please click the link below to connect your Google account:")
        print("(You can select which permissions to grant on the Google consent screen)\n")
        print(final_url)
        print("\nAvailable permissions:")
        for scope in ALL_SCOPES:
            marker = "→" if scope in action_scopes else " "
            print(f"  {marker} {SCOPE_NAMES.get(scope, scope)}")
        print(f"\nAfter authorizing, please try the command again.")
    else:
        print(f"Error getting authorization URL: {all_error}", file=sys.stderr)

    sys.exit(0)


def check_google_api_error(resp, api_base, user_id, scope_key):
    """Check Google API response for auth errors. Returns True if error handled."""
    error = resp.get("error", {})
    if not isinstance(error, dict):
        return False

    code = error.get("code", 0)
    message = error.get("message", "")

    if code == 401 or (code == 403 and "insufficient" in message.lower()):
        scope_name = SCOPE_NAMES.get(scope_key, scope_key)
        print(f"Google API error: {message}")
        print(f"\nThe permission for **{scope_name}** may have been revoked or was not granted.")
        print(f"Please re-authorize by running the same command again.")
        sys.exit(1)

    if code in (403, 400):
        print(f"Google API error (HTTP {code}): {message}", file=sys.stderr)
        sys.exit(1)

    return False


# ---------------------------------------------------------------------------
# Google Calendar API
# ---------------------------------------------------------------------------

GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

def calendar_list(token, api_base, user_id, date_from=None, date_to=None):
    """List calendar events."""
    now = datetime.now(timezone.utc)
    if not date_from:
        time_min = now.isoformat()
    else:
        time_min = f"{date_from}T00:00:00Z"
    if not date_to:
        time_max = (now + timedelta(days=7)).isoformat()
    else:
        time_max = f"{date_to}T23:59:59Z"

    params = urllib.parse.urlencode({
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "50",
    })
    url = f"{GOOGLE_CALENDAR_API}/calendars/primary/events?{params}"
    resp = api_request(url, headers={"Authorization": f"Bearer {token}"})
    check_google_api_error(resp, api_base, user_id, "calendar")

    events = resp.get("items", [])
    if not events:
        print("No upcoming events found.")
        return

    print(f"## Calendar Events ({date_from or 'now'} to {date_to or '7 days'})\n")
    for event in events:
        start = event.get("start", {})
        start_time = start.get("dateTime", start.get("date", ""))
        summary = event.get("summary", "(No title)")
        location = event.get("location", "")
        event_id = event.get("id", "")

        # Format time for display
        if "T" in start_time:
            try:
                dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                start_display = dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                start_display = start_time
        else:
            start_display = start_time  # All-day event

        line = f"- **{summary}** | {start_display}"
        if location:
            line += f" | {location}"
        line += f" | ID: `{event_id}`"
        print(line)


def calendar_create(token, api_base, user_id, title, start, end=None, description="", location=""):
    """Create a calendar event."""
    if not end:
        try:
            start_dt = datetime.fromisoformat(start)
            end_dt = start_dt + timedelta(hours=1)
            end = end_dt.isoformat()
        except Exception:
            end = start

    event_body = {
        "summary": title,
        "start": {"dateTime": start, "timeZone": "UTC"},
        "end": {"dateTime": end, "timeZone": "UTC"},
    }
    if description:
        event_body["description"] = description
    if location:
        event_body["location"] = location

    url = f"{GOOGLE_CALENDAR_API}/calendars/primary/events"
    resp = api_request(url, method="POST",
                       headers={"Authorization": f"Bearer {token}"},
                       data=event_body)
    check_google_api_error(resp, api_base, user_id, "calendar")

    event_id = resp.get("id", "")
    html_link = resp.get("htmlLink", "")
    print(f"Event created: **{title}**")
    print(f"- ID: `{event_id}`")
    if html_link:
        print(f"- Link: {html_link}")


def calendar_delete(token, event_id):
    """Delete a calendar event."""
    url = f"{GOOGLE_CALENDAR_API}/calendars/primary/events/{event_id}"
    try:
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "curl/7.88.1",
        }, method="DELETE")
        urllib.request.urlopen(req, timeout=30)
        print(f"Event `{event_id}` deleted successfully.")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Error: Event `{event_id}` not found.")
        elif e.code in (401, 403):
            print(f"Error: Permission denied. Your Google Calendar authorization may need to be renewed.")
        else:
            print(f"Error: Failed to delete event (HTTP {e.code})")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Gmail API
# ---------------------------------------------------------------------------

GOOGLE_GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

def gmail_list(token, api_base, user_id, unread=False, max_results=10):
    """List recent emails."""
    query = "is:unread" if unread else ""
    params = urllib.parse.urlencode({
        "maxResults": str(max_results),
        "q": query,
    })
    url = f"{GOOGLE_GMAIL_API}/messages?{params}"
    resp = api_request(url, headers={"Authorization": f"Bearer {token}"})
    check_google_api_error(resp, api_base, user_id, "gmail.list")

    messages = resp.get("messages", [])
    if not messages:
        print("No emails found." if not unread else "No unread emails.")
        return

    label = "Unread emails" if unread else "Recent emails"
    print(f"## {label} (showing {len(messages)})\n")

    for msg_ref in messages:
        msg_id = msg_ref["id"]
        msg_url = f"{GOOGLE_GMAIL_API}/messages/{msg_id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date"
        msg = api_request(msg_url, headers={"Authorization": f"Bearer {token}"})

        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        subject = headers.get("Subject", "(No subject)")
        sender = headers.get("From", "Unknown")
        date = headers.get("Date", "")
        snippet = msg.get("snippet", "")

        print(f"- **{subject}**")
        print(f"  From: {sender} | {date}")
        print(f"  {snippet[:120]}...")
        print(f"  ID: `{msg_id}`")
        print()


def gmail_read(token, api_base, user_id, message_id):
    """Read a specific email."""
    url = f"{GOOGLE_GMAIL_API}/messages/{message_id}?format=full"
    msg = api_request(url, headers={"Authorization": f"Bearer {token}"})
    check_google_api_error(resp=msg, api_base=api_base, user_id=user_id, scope_key="gmail.read")

    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    subject = headers.get("Subject", "(No subject)")
    sender = headers.get("From", "Unknown")
    to = headers.get("To", "")
    date = headers.get("Date", "")

    print(f"## {subject}\n")
    print(f"- **From:** {sender}")
    print(f"- **To:** {to}")
    print(f"- **Date:** {date}")
    print()

    body = extract_body(msg.get("payload", {}))
    if body:
        print(body)
    else:
        print(msg.get("snippet", "(No content)"))


def extract_body(payload):
    """Extract plain text body from Gmail message payload."""
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        import base64
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            import base64
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
        result = extract_body(part)
        if result:
            return result
    return None


def gmail_send(token, api_base, user_id, to, subject, body):
    """Send an email."""
    import base64
    raw_message = f"To: {to}\r\nSubject: {subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{body}"
    encoded = base64.urlsafe_b64encode(raw_message.encode()).decode()

    url = f"{GOOGLE_GMAIL_API}/messages/send"
    resp = api_request(url, method="POST",
                       headers={"Authorization": f"Bearer {token}"},
                       data={"raw": encoded})
    check_google_api_error(resp, api_base, user_id, "gmail.send")

    msg_id = resp.get("id", "")
    print(f"Email sent successfully.")
    print(f"- To: {to}")
    print(f"- Subject: {subject}")
    print(f"- Message ID: `{msg_id}`")


# ---------------------------------------------------------------------------
# Auth management
# ---------------------------------------------------------------------------

# Unique scopes for status checking (deduplicated)
AUTH_CHECK_SCOPES = {
    "calendar": {
        "scopes": ["https://www.googleapis.com/auth/calendar"],
        "name": "Google Calendar (read/write events)",
        "actions": "calendar list, calendar create, calendar delete",
    },
    "gmail-read": {
        "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
        "name": "Gmail (read emails)",
        "actions": "gmail list, gmail read",
    },
    "gmail-send": {
        "scopes": ["https://www.googleapis.com/auth/gmail.send"],
        "name": "Gmail (send emails)",
        "actions": "gmail send",
    },
}


def auth_check(api_base, user_id):
    """Check authorization status for each scope."""
    print("## Google Authorization Status\n")

    authorized = []
    not_authorized = []

    for key, info in AUTH_CHECK_SCOPES.items():
        token, auth_url, error = request_token(api_base, user_id, info["scopes"])
        if token:
            authorized.append(info)
            print(f"- ✅ **{info['name']}** — authorized")
            print(f"  Actions: {info['actions']}")
        elif auth_url:
            not_authorized.append((info, auth_url))
            print(f"- ❌ **{info['name']}** — not authorized")
            print(f"  Actions: {info['actions']}")
        else:
            not_authorized.append((info, None))
            print(f"- ⚠️ **{info['name']}** — error: {error}")
        print()

    if not not_authorized:
        print("All permissions are authorized. You can use all Google features.")
    else:
        print(f"\n{len(not_authorized)} permission(s) need authorization.")
        print("Use `google auth setup` to authorize all permissions at once.")


def auth_setup(api_base, user_id, scope_filter=None):
    """Request authorization for all scopes (or specific ones)."""
    if scope_filter:
        # Request specific scopes
        scopes = []
        for key in scope_filter:
            if key in AUTH_CHECK_SCOPES:
                scopes.extend(AUTH_CHECK_SCOPES[key]["scopes"])
            else:
                print(f"Unknown scope: {key}. Available: {', '.join(AUTH_CHECK_SCOPES.keys())}")
                sys.exit(1)
        scopes = list(set(scopes))
    else:
        scopes = ALL_SCOPES

    token, auth_url, error = request_token(api_base, user_id, scopes)

    if token:
        print("All requested permissions are already authorized.")
        return

    if auth_url:
        print("## Google Authorization Setup\n")
        print("Please click the link below to authorize your Google account:\n")
        print(auth_url)
        print("\nPermissions being requested:")
        for scope in scopes:
            print(f"  - {SCOPE_NAMES.get(scope, scope)}")
        print("\nAfter authorizing, run `google auth check` to verify.")
    elif error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Google Calendar/Gmail SKILL")
    parser.add_argument("--api-base", required=True, help="OAuth API base URL")
    parser.add_argument("--user-id", required=True, help="MyShell user ID for OAuth")
    parser.add_argument("service", choices=["calendar", "gmail", "auth"], help="Google service")
    parser.add_argument("action", nargs="?", default="check", help="Action to perform")
    parser.add_argument("--from", dest="date_from", help="Calendar: start date (YYYY-MM-DD)")
    parser.add_argument("--to", dest="date_to", help="Calendar: end date (YYYY-MM-DD)")
    parser.add_argument("--title", help="Calendar: event title")
    parser.add_argument("--start", help="Calendar: event start (ISO 8601)")
    parser.add_argument("--end", help="Calendar: event end (ISO 8601)")
    parser.add_argument("--description", default="", help="Calendar: event description")
    parser.add_argument("--location", default="", help="Calendar: event location")
    parser.add_argument("--event-id", help="Calendar: event ID for delete")
    parser.add_argument("--unread", action="store_true", help="Gmail: unread only")
    parser.add_argument("--max", type=int, default=10, help="Gmail: max results")
    parser.add_argument("--id", dest="message_id", help="Gmail: message ID for read")
    parser.add_argument("--recipient", help="Gmail send: recipient email address")
    parser.add_argument("--subject", help="Gmail send: subject")
    parser.add_argument("--body", help="Gmail send: body text")
    parser.add_argument("--scopes", help="Auth: comma-separated scope names (calendar,gmail-read,gmail-send)")

    args = parser.parse_args()

    # --- Auth management ---
    if args.service == "auth":
        if args.action in ("check", "status"):
            auth_check(args.api_base, args.user_id)
        elif args.action == "setup":
            scope_filter = args.scopes.split(",") if args.scopes else None
            auth_setup(args.api_base, args.user_id, scope_filter)
        else:
            print(f"Error: Unknown auth action '{args.action}'. Use: check, setup")
            sys.exit(1)
        return

    # --- Resolve scopes for the action ---
    scope_key = f"{args.service}.{args.action}" if args.service == "gmail" else args.service
    scopes = SCOPES.get(scope_key, SCOPES.get(args.service, []))
    if not scopes:
        print(f"Error: Unknown service/action for scope resolution: {scope_key}", file=sys.stderr)
        sys.exit(1)

    # Get OAuth token (checks per-action scope, requests all scopes if auth needed)
    token = get_token_or_auth(args.api_base, args.user_id, scopes, scope_key)

    # --- Dispatch ---
    if args.service == "calendar":
        if args.action == "list":
            calendar_list(token, args.api_base, args.user_id, args.date_from, args.date_to)
        elif args.action == "create":
            if not args.title or not args.start:
                print("Error: --title and --start are required for calendar create")
                sys.exit(1)
            calendar_create(token, args.api_base, args.user_id, args.title, args.start, args.end, args.description, args.location)
        elif args.action == "delete":
            if not args.event_id:
                print("Error: --event-id is required for calendar delete")
                sys.exit(1)
            calendar_delete(token, args.event_id)
        else:
            print(f"Error: Unknown calendar action '{args.action}'. Use: list, create, delete")
            sys.exit(1)

    elif args.service == "gmail":
        if args.action == "list":
            gmail_list(token, args.api_base, args.user_id, args.unread, args.max)
        elif args.action == "read":
            if not args.message_id:
                print("Error: --id is required for gmail read")
                sys.exit(1)
            gmail_read(token, args.api_base, args.user_id, args.message_id)
        elif args.action == "send":
            if not args.recipient or not args.subject or not args.body:
                print("Error: --recipient, --subject, and --body are required for gmail send")
                sys.exit(1)
            gmail_send(token, args.api_base, args.user_id, args.recipient, args.subject, args.body)
        else:
            print(f"Error: Unknown gmail action '{args.action}'. Use: list, read, send")
            sys.exit(1)


if __name__ == "__main__":
    main()
