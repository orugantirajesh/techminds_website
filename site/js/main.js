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

  // Contact form: validate, then open the visitor's email app with the message filled in.
  const form = document.getElementById("contact-form");
  if (form) {
    const status = document.getElementById("form-status");
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
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("blur", () => { if (field.required || field.value) showError(field, check(field)); });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let firstInvalid = null;
      form.querySelectorAll("input, select, textarea").forEach((field) => {
        const msg = check(field);
        showError(field, msg);
        if (msg && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      const v = (id) => document.getElementById(id).value.trim();
      const service = form.service.options[form.service.selectedIndex].text;
      const subject = `Project enquiry — ${service}${v("company") ? " — " + v("company") : ""}`;
      const details = [`Name: ${v("name")}`, `Email: ${v("email")}`];
      if (v("company")) details.push(`Company: ${v("company")}`);
      if (v("phone")) details.push(`Phone: ${v("phone")}`);
      details.push(`Service: ${service}`);
      const body = `${details.join("\n")}\n\n${v("message")}`;
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = `Your email app should now open with your message ready — just press Send. ` +
        `If nothing opened, email us directly at ${CONTACT_EMAIL}.`;
      status.classList.add("show");
      status.focus();
    });
  }
});
