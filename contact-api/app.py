"""Contact form endpoint for techmindsconsulting.com.au.

POST /api/contact (JSON) -> validates, applies spam/abuse limits, emails the owner via Gmail SMTP.
Standard library only. Runs behind Traefik, which passes the visitor's IP in X-Real-Ip.

Config (environment / secret file):
  SMTP_USER          Gmail address that sends (and receives) the enquiries
  SMTP_APP_PASSWORD  Gmail app password for that account
  MAIL_TO            where enquiries go (defaults to SMTP_USER)
"""

import json
import logging
import os
import re
import smtplib
import ssl
import threading
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

log = logging.getLogger("contact")

SERVICES = {
    "audit": "Free automation audit",
    "email-whatsapp": "Email alerts on WhatsApp",
    "invoices-xero": "Invoices, receipts & Xero",
    "whatsapp-assistant": "A WhatsApp assistant",
    "dashboard": "One dashboard for everything",
    "reports": "Reports & daily digests",
    "other": "Something else",
}
LIMITS = {"name": 100, "email": 200, "company": 150, "phone": 40, "message": 5000}
EMAIL_RE = re.compile(r"^[^@\s<>\"',;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$")
MAX_BODY = 20_000
MIN_FILL_SECONDS = 3          # humans take longer than this to fill the form
PER_IP_PER_HOUR = 5
PER_DAY = 50


class RateLimiter:
    def __init__(self, per_ip_per_hour: int, per_day: int, clock=time.time) -> None:
        self.per_ip, self.per_day, self.clock = per_ip_per_hour, per_day, clock
        self.by_ip: dict[str, deque] = defaultdict(deque)
        self.all: deque = deque()
        self.lock = threading.Lock()

    def allow(self, ip: str) -> bool:
        now = self.clock()
        with self.lock:
            q = self.by_ip[ip]
            while q and now - q[0] > 3600:
                q.popleft()
            while self.all and now - self.all[0] > 86400:
                self.all.popleft()
            if len(q) >= self.per_ip or len(self.all) >= self.per_day:
                return False
            q.append(now)
            self.all.append(now)
            return True


def clean(value: object, limit: int) -> str:
    """Single-line text: strip control characters (blocks header injection), trim, cap length."""
    text = "" if value is None else str(value)
    text = re.sub(r"[\x00-\x1f\x7f]", " ", text)
    return " ".join(text.split())[:limit]


def validate(data: dict, now: float) -> tuple[dict | None, str | None, bool]:
    """Returns (fields, error, is_spam). Spam is accepted silently so bots learn nothing."""
    if clean(data.get("website"), 200):  # honeypot: hidden from people, filled by bots
        return None, None, True
    try:
        started = float(data.get("started", 0)) / 1000
    except (TypeError, ValueError):
        started = 0
    if started and now - started < MIN_FILL_SECONDS:
        return None, None, True

    f = {k: clean(data.get(k), n) for k, n in LIMITS.items() if k != "message"}
    msg = "" if data.get("message") is None else str(data.get("message"))
    msg = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", msg).strip()
    if len(msg) > LIMITS["message"]:
        return None, "Your message is too long.", False
    f["message"] = msg
    f["service"] = SERVICES.get(str(data.get("service", "")))
    if not f["name"]:
        return None, "Please enter your name.", False
    if not EMAIL_RE.match(f["email"]):
        return None, "Please enter a valid email address.", False
    if not f["service"]:
        return None, "Please choose what you'd like to automate.", False
    if not f["message"]:
        return None, "Please tell us a little about it.", False
    return f, None, False


def build_email(f: dict, sender: str, to: str) -> EmailMessage:
    m = EmailMessage()
    m["Subject"] = f"Website enquiry: {f['service']} — {f['name']}"
    m["From"] = formataddr(("TechMinds website", sender))
    m["To"] = to
    m["Reply-To"] = formataddr((f["name"], f["email"]))
    m["Message-ID"] = make_msgid(domain="techmindsconsulting.com.au")
    lines = [f"Name:     {f['name']}", f"Email:    {f['email']}"]
    if f["company"]:
        lines.append(f"Business: {f['company']}")
    if f["phone"]:
        lines.append(f"Phone:    {f['phone']}")
    lines += [f"Wants:    {f['service']}", "", f["message"], "", "—", "Sent from the contact form on techmindsconsulting.com.au. Reply to this email to answer them."]
    m.set_content("\n".join(lines))
    return m


def send(message: EmailMessage, user: str, password: str) -> None:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=20) as s:
        s.login(user, password)
        s.send_message(message)


class Handler(BaseHTTPRequestHandler):
    limiter = RateLimiter(PER_IP_PER_HOUR, PER_DAY)
    smtp_user = ""
    smtp_password = ""
    mail_to = ""
    sender = staticmethod(send)

    def log_message(self, fmt, *args):  # no access log with visitor details
        pass

    def _reply(self, status: int, body: dict) -> None:
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/api/health":
            return self._reply(200, {"ok": True})
        self._reply(404, {"ok": False})

    def do_POST(self):
        if self.path != "/api/contact":
            return self._reply(404, {"ok": False})
        if "application/json" not in self.headers.get("Content-Type", ""):
            return self._reply(415, {"ok": False, "error": "Unsupported request."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY:
            return self._reply(413, {"ok": False, "error": "Your message is too long."})
        try:
            data = json.loads(self.rfile.read(length))
            assert isinstance(data, dict)
        except Exception:  # noqa: BLE001
            return self._reply(400, {"ok": False, "error": "Something went wrong — please try again."})

        fields, error, spam = validate(data, time.time())
        if spam:
            log.info("Dropped a likely-spam submission")
            return self._reply(200, {"ok": True})
        if error:
            return self._reply(422, {"ok": False, "error": error})

        ip = self.headers.get("X-Real-Ip") or self.client_address[0]
        if not self.limiter.allow(ip):
            log.warning("Rate limit hit")
            return self._reply(429, {"ok": False, "error": "Too many messages — please email us directly."})
        try:
            self.sender(build_email(fields, self.smtp_user, self.mail_to), self.smtp_user, self.smtp_password)
        except Exception as e:  # noqa: BLE001
            log.error("Sending failed: %s", type(e).__name__)
            return self._reply(502, {"ok": False, "error": "We couldn't send your message just now."})
        log.info("Enquiry sent (%s)", fields["service"])
        self._reply(200, {"ok": True})


def load_secrets(path: str) -> None:
    """Read KEY=value lines from a secret file into the environment (values never logged)."""
    if path and os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    load_secrets(os.environ.get("CONTACT_SECRETS_FILE", "/run/secrets/contact_env"))
    Handler.smtp_user = os.environ.get("SMTP_USER", "")
    Handler.smtp_password = os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", "")
    Handler.mail_to = os.environ.get("MAIL_TO") or Handler.smtp_user
    if not (Handler.smtp_user and Handler.smtp_password):
        log.warning("SMTP_USER / SMTP_APP_PASSWORD not set - every send will fail until they are")
    server = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    log.info("Contact API listening on :8080")
    server.serve_forever()


if __name__ == "__main__":
    main()
