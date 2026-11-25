(function () {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const main = document.querySelector("main");
  const footer = document.querySelector(".site-footer");
  let currentTheme = "dark";

  const styles = ["apple", "paper", "night", "move", "windows", "macos"];
  let dragReady = false;
  const styleSwitch = document.querySelector(".style-switch");
  const styleButtons = styleSwitch ? Array.from(styleSwitch.querySelectorAll("[data-style]")) : [];

  function paintChrome() {
    if (!themeMeta) return;
    const token = nav.dataset.theme === "dark" ? "--theme-dark" : "--theme-light";
    const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    if (color) themeMeta.setAttribute("content", color);
  }

  function applyStyle(name) {
    if (!styles.includes(name)) return;
    document.documentElement.dataset.style = name;
    styleButtons.forEach((button) => {
      const active = button.dataset.style === name;
      button.setAttribute("aria-checked", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    try {
      localStorage.setItem("site-style", name);
    } catch (error) {}
    paintChrome();
    syncDragMode();
  }

  function applyTheme(theme) {
    nav.dataset.theme = theme;
    paintChrome();
  }

  applyStyle(document.documentElement.dataset.style || "apple");

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

  styleButtons.forEach((button, index) => {
    button.addEventListener("click", () => applyStyle(button.dataset.style));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = styleButtons[(index + step + styleButtons.length) % styleButtons.length];
      applyStyle(next.dataset.style);
      next.focus();
    });
  });

  document.querySelectorAll("[data-animate='stagger']").forEach((container) => {
    container.querySelectorAll(":scope > *").forEach((child, index) => {
      child.style.setProperty("--index", index);
    });
  });

  const clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length) {
    const format = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
    });
    const paintClock = () => {
      const now = new Date();
      const text = format.format(now);
      const stamp = now.toISOString();
      clocks.forEach((clock) => {
        clock.textContent = text;
        clock.setAttribute("datetime", stamp);
      });
    };
    paintClock();
    window.setInterval(paintClock, 1000);
  }

  const dragSelectors = [
    ".hero-copy",
    ".stage",
    ".proof li",
    "#craft .narrow",
    ".craft li",
    ".tile",
    ".pull blockquote",
    ".steps li",
    ".specs > div",
    "#contact .container",
    ".footer-grid > div",
  ];
  const tilts = [-1.6, 1.3, -1.1, 1.8, -1.4, 0.9, 1.5, -0.7, 1.2, -1.8, 0.8, -1.2, 1.6, -0.5, 1.1, -1.5, 0.6];
  const dragItems = [];
  dragSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el, index) => {
      if (el.dataset.dragId) return;
      el.dataset.dragId = selector + ":" + index;
      dragItems.push(el);
    });
  });

  const desktopSelectors = [".hero", "#craft", "#services", ".pull", "#process", "#budget", "#contact", ".site-footer"];
  const desktopItems = [];
  desktopSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el, index) => {
      el.dataset.dragId = "desktop:" + selector + ":" + index;
      desktopItems.push(el);
    });
  });

  const hint = document.querySelector(".drag-hint");
  const hintText = hint ? hint.querySelector("p") : null;
  const resetButton = document.querySelector(".drag-reset");
  let dragPositions = {};
  try {
    dragPositions = JSON.parse(localStorage.getItem("site-drag") || "{}");
  } catch (error) {
    dragPositions = {};
  }

  function rememberDrag() {
    try {
      localStorage.setItem("site-drag", JSON.stringify(dragPositions));
    } catch (error) {}
  }

  function readOffset(el) {
    const raw = (el.style.translate || "0 0").replace(/px/g, "").trim().split(/\s+/);
    return { x: Number(raw[0]) || 0, y: Number(raw[1]) || 0 };
  }

  function currentDragItems() {
    const style = document.documentElement.dataset.style;
    if (style === "move") return dragItems;
    if (style === "windows" || style === "macos") return desktopItems;
    return [];
  }

  function syncDragMode() {
    if (!dragReady) return;
    const style = document.documentElement.dataset.style;
    const active = currentDragItems();
    const desktop = style === "windows" || style === "macos";
    if (hint) hint.hidden = active.length === 0;
    if (hintText) {
      hintText.textContent = desktop
        ? "Тяните за шапку окна."
        : "Тяните мышью. На телефоне — за метку.";
    }
    dragItems.concat(desktopItems).forEach((el, index) => {
      const on = active.indexOf(el) !== -1;
      el.classList.toggle("drag-item", on);
      if (!on) {
        el.style.translate = "";
        el.style.rotate = "";
        el.classList.remove("is-dragging");
        return;
      }
      if (!el.querySelector(":scope > .drag-grip")) {
        const grip = document.createElement("button");
        grip.type = "button";
        grip.className = "drag-grip";
        grip.setAttribute("aria-label", "Перетащить");
        grip.innerHTML = "<span></span>";
        el.appendChild(grip);
      }
      el.style.rotate = style === "move" ? tilts[index % tilts.length] + "deg" : "";
      const saved = dragPositions[el.dataset.dragId];
      el.style.translate = saved ? saved.x + "px " + saved.y + "px" : "0 0";
    });
  }

  let drag = null;

  document.addEventListener("pointerdown", (event) => {
    const style = document.documentElement.dataset.style;
    if ((style !== "move" && style !== "windows" && style !== "macos") || event.button > 0) return;
    const item = event.target.closest(".drag-item");
    if (!item || (hint && hint.contains(event.target))) return;
    const grip = event.target.closest(".drag-grip");
    if (event.pointerType !== "mouse" && !grip) return;
    const origin = readOffset(item);
    drag = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: origin.x,
      y: origin.y,
      moved: false,
    };
    if (grip) event.preventDefault();
  });

  document.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.item.classList.add("is-dragging");
      try {
        if (!drag.item.hasPointerCapture(event.pointerId)) {
          drag.item.setPointerCapture(event.pointerId);
        }
      } catch (error) {}
    }
    drag.item.style.translate = drag.x + dx + "px " + (drag.y + dy) + "px";
  });

  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const item = drag.item;
    if (drag.moved) {
      const offset = readOffset(item);
      dragPositions[item.dataset.dragId] = offset;
      rememberDrag();
      item.dataset.justDragged = "1";
    }
    item.classList.remove("is-dragging");
    drag = null;
  }

  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  document.addEventListener("click", (event) => {
    const item = event.target.closest(".drag-item");
    if (!item || item.dataset.justDragged !== "1") return;
    event.preventDefault();
    event.stopPropagation();
    item.dataset.justDragged = "0";
  }, true);

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const items = currentDragItems();
      items.forEach((el) => {
        delete dragPositions[el.dataset.dragId];
      });
      rememberDrag();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      items.forEach((el) => {
        if (!reduce) el.classList.add("is-resetting");
        el.style.translate = "0 0";
      });
      window.setTimeout(() => {
        items.forEach((el) => el.classList.remove("is-resetting"));
      }, 480);
    });
  }

  dragReady = true;
  syncDragMode();

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
