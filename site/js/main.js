// TechMinds — shared behaviour: mobile menu, current-page nav, scroll reveal, contact form.
document.documentElement.classList.add("js");

const CONTACT_EMAIL = "techmindsconsulting@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu
  const toggle = document.querySelector(".nav-toggle");
  const links = document.getElementById("nav-links");
  if (toggle && links) {
    const setOpen = (open) => {
      links.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!links.classList.contains("open")));
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && links.classList.contains("open")) { setOpen(false); toggle.focus(); }
    });
  }

  // Mark the current page in the nav
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
  });

  // Reveal on scroll
  const revealEls = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  // Contact form: validate in the browser, then send to our own server, which emails the enquiry.
  const form = document.getElementById("contact-form");
  if (form) {
    const status = document.getElementById("form-status");
    const button = form.querySelector("button[type=submit]");
    const startedAt = Date.now();
    const showError = (field, message) => {
      const err = document.getElementById(`${field.id}-error`);
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (err) err.textContent = message || "";
    };
    const check = (field) => {
      if (field.validity.valueMissing) return "Please fill this in.";
      if (field.validity.typeMismatch) return "Please enter a valid email address.";
      return "";
    };
    const say = (text, isError) => {
      status.textContent = text;
      status.classList.toggle("error", Boolean(isError));
      status.classList.add("show");
      status.focus();
    };
    const fields = form.querySelectorAll("input:not([name=website]), select, textarea");
    fields.forEach((field) => {
      field.addEventListener("blur", () => { if (field.required || field.value) showError(field, check(field)); });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstInvalid = null;
      fields.forEach((field) => {
        const msg = check(field);
        showError(field, msg);
        if (msg && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      const payload = Object.fromEntries(new FormData(form).entries());
      payload.started = startedAt;
      button.disabled = true;
      const label = button.textContent;
      button.textContent = "Sending…";
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          form.reset();
          say("Thanks — your message has been sent. We’ll be in touch within one business day.");
        } else {
          say(`${data.error || "We couldn’t send your message just now."} You can also email us at ${CONTACT_EMAIL}.`, true);
        }
      } catch {
        say(`We couldn’t reach our server. Please try again, or email us at ${CONTACT_EMAIL}.`, true);
      } finally {
        button.disabled = false;
        button.textContent = label;
      }
    });
  }
});
