// TechMinds — shared site behavior: mobile nav, scroll reveal, header shadow,
// active nav highlighting, contact form (client-side only — see contact.html).

document.addEventListener("DOMContentLoaded", () => {
  // Mobile nav toggle
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
  }

  // Highlight the current page in the nav
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const target = a.getAttribute("href");
    if (target === here || (here === "" && target === "index.html")) {
      a.classList.add("active");
    }
  });

  // Reveal-on-scroll
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  // Spotlight cards — pointer-follow glow (vanilla port of 21st.dev feature-08)
  document.querySelectorAll(".spotlight").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
  });

  // Count-up stats (vanilla port of 21st.dev number-ticker-05)
  const counters = document.querySelectorAll("[data-count]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const runCount = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window && counters.length) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => {
      if (!reduceMotion) el.textContent = "0";
      cio.observe(el);
    });
  } else {
    counters.forEach((el) => (el.textContent = el.dataset.count));
  }

  // Contact form — client-side only. No backend is wired up yet; this just
  // validates and shows a confirmation. Replace with a real submit handler
  // (e.g. POST to your own API, or a form service) when you're ready.
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      document.getElementById("form-success").classList.add("show");
      form.reset();
      document.getElementById("form-success").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
});
