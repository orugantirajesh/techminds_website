import json
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import app

GOOD = {"name": "Jane Smith", "email": "jane@example.com", "company": "Acme", "phone": "0400 000 000",
        "service": "invoices-xero", "message": "We type every invoice into Xero by hand.",
        "website": "", "started": (time.time() - 30) * 1000}


class ValidateTests(unittest.TestCase):
    def test_good_submission(self):
        f, err, spam = app.validate(dict(GOOD), time.time())
        self.assertIsNone(err)
        self.assertFalse(spam)
        self.assertEqual(f["service"], "Invoices, receipts & Xero")

    def test_honeypot_and_speed_are_spam(self):
        self.assertTrue(app.validate(dict(GOOD, website="http://spam"), time.time())[2])
        self.assertTrue(app.validate(dict(GOOD, started=time.time() * 1000), time.time())[2])

    def test_errors(self):
        for bad, msg in [({"name": ""}, "name"), ({"email": "nope"}, "email"),
                         ({"service": "hack"}, "choose"), ({"message": " "}, "tell us"),
                         ({"message": "x" * 5001}, "too long")]:
            _, err, _ = app.validate(dict(GOOD, **bad), time.time())
            self.assertIn(msg, err.lower())

    def test_every_form_option_is_accepted(self):
        import re
        html = open(__file__.replace("contact-api/test_app.py", "site/contact.html")).read()
        options = [v for v in re.findall(r'<option value="([a-z-]+)"', html)]
        self.assertTrue(options)
        for value in options:
            _, err, _ = app.validate(dict(GOOD, service=value), time.time())
            self.assertIsNone(err, value)

    def test_header_injection_is_neutralised(self):
        f, _, _ = app.validate(dict(GOOD, name="Eve\r\nBcc: victim@example.com"), time.time())
        m = app.build_email(f, "me@gmail.com", "me@gmail.com")
        self.assertNotIn("\n", m["Subject"])
        self.assertIsNone(m["Bcc"])
        self.assertIn("jane@example.com", m["Reply-To"])

    def test_rate_limits(self):
        t = [1000.0]
        rl = app.RateLimiter(per_ip_per_hour=2, per_day=3, clock=lambda: t[0])
        self.assertTrue(rl.allow("a")); self.assertTrue(rl.allow("a")); self.assertFalse(rl.allow("a"))
        self.assertTrue(rl.allow("b")); self.assertFalse(rl.allow("c"))  # daily cap
        t[0] += 86401
        self.assertTrue(rl.allow("a"))


class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sent = []
        app.Handler.sender = staticmethod(lambda m, u, p: cls.sent.append(m))
        app.Handler.smtp_user = app.Handler.mail_to = "owner@gmail.com"
        app.Handler.smtp_password = "x"
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/api/contact"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def post(self, body, ctype="application/json"):
        req = urllib.request.Request(self.url, data=json.dumps(body).encode(), headers={"Content-Type": ctype})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_sends_email(self):
        app.Handler.limiter = app.RateLimiter(5, 50)
        status, body = self.post(GOOD)
        self.assertEqual((status, body["ok"]), (200, True))
        m = self.sent[-1]
        self.assertEqual(m["To"], "owner@gmail.com")
        self.assertIn("Jane Smith", m["Subject"])
        self.assertIn("We type every invoice", m.get_content())

    def test_spam_looks_successful_but_sends_nothing(self):
        before = len(self.sent)
        status, body = self.post(dict(GOOD, website="x"))
        self.assertEqual((status, body["ok"], len(self.sent)), (200, True, before))

    def test_validation_and_content_type(self):
        self.assertEqual(self.post(dict(GOOD, email="bad"))[0], 422)
        self.assertEqual(self.post(GOOD, ctype="text/plain")[0], 415)

    def test_rate_limited(self):
        app.Handler.limiter = app.RateLimiter(1, 50)
        self.assertEqual(self.post(GOOD)[0], 200)
        self.assertEqual(self.post(GOOD)[0], 429)


if __name__ == "__main__":
    unittest.main()
