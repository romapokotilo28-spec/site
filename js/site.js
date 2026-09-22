(function () {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const main = document.querySelector("main");
  const footer = document.querySelector(".site-footer");
  let currentTheme = "dark";

  function applyTheme(theme) {
    nav.dataset.theme = theme;
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "dark" ? "#000000" : "#f5f5f7");
    }
  }

  function setTheme(theme) {
    currentTheme = theme;
    if (!nav.classList.contains("is-open")) applyTheme(theme);
  }

  const zone = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (hit) setTheme(hit.target.dataset.header);
    },
    { rootMargin: "-49px 0px -62% 0px", threshold: [0, 0.2, 0.45] }
  );

  document.querySelectorAll("[data-header]").forEach((section) => zone.observe(section));

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    if (open) {
      applyTheme("light");
      const first = menu.querySelector("a");
      if (first) first.focus();
    } else {
      applyTheme(currentTheme);
    }
  }

  toggle.addEventListener("click", () => {
    setMenu(!menu.classList.contains("is-open"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });

  document.querySelectorAll("[data-animate='stagger']").forEach((container) => {
    container.querySelectorAll(":scope > *").forEach((child, index) => {
      child.style.setProperty("--index", index);
    });
  });

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animated = document.querySelectorAll("[data-animate]");
  const progress = document.querySelector(".scroll-progress");

  if (!motion.matches && progress && !CSS.supports("animation-timeline: scroll()")) {
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? window.scrollY / max : 0;
      progress.style.transform = `scaleX(${value})`;
    };
    paint();
    window.addEventListener("scroll", paint, { passive: true });
  }

  if (motion.matches) {
    animated.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        reveal.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.18 }
  );

  animated.forEach((el) => reveal.observe(el));
})();
