const pricingMatrix = {
  small: { basic: 45, full: 65, show: 90 },
  medium: { basic: 55, full: 80, show: 105 },
  large: { basic: 70, full: 95, show: 120 },
  xl: { basic: 85, full: 110, show: 140 },
};

const pickupFee = 15;
const storageKey = "cutAndCuddlePricing";

const priceForm = document.querySelector("#price-form");
const sizeSelect = document.querySelector("#dog-size");
const styleSelect = document.querySelector("#style");
const pickupToggle = document.querySelector("#pickup-toggle");
const priceOutput = document.querySelector("#price-output");
const yearEl = document.querySelector("#year");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  .matches;

function calculatePrice() {
  const size = sizeSelect.value;
  const style = styleSelect.value;
  const basePrice = pricingMatrix[size][style];
  const total = basePrice + (pickupToggle.checked ? pickupFee : 0);
  priceOutput.textContent = `$${total}`;
  return { size, style, pickup: pickupToggle.checked, total };
}

function loadPreferences() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      calculatePrice();
      return;
    }
    const prefs = JSON.parse(saved);
    if (prefs.size) sizeSelect.value = prefs.size;
    if (prefs.style) styleSelect.value = prefs.style;
    if (typeof prefs.pickup === "boolean") pickupToggle.checked = prefs.pickup;
  } catch (error) {
    console.warn("Unable to load preferences from localStorage.", error);
  } finally {
    calculatePrice();
  }
}

function savePreferences(event) {
  event.preventDefault();
  const data = calculatePrice();
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
    priceOutput.classList.add("saved");
    setTimeout(() => priceOutput.classList.remove("saved"), 800);
  } catch (error) {
    console.warn("Unable to save preferences to localStorage.", error);
  }
}

function initNav() {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    navToggle.setAttribute(
      "aria-expanded",
      navLinks.classList.contains("open") ? "true" : "false"
    );
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initScrollSpy() {
  const sections = document.querySelectorAll("section[id]");
  const navAnchors = Array.from(navLinks.querySelectorAll("a"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        const link = navAnchors.find((anchor) => anchor.getAttribute("href") === `#${id}`);
        if (!link) return;
        if (entry.isIntersecting) {
          navAnchors.forEach((anchor) => anchor.classList.remove("active"));
          link.classList.add("active");
        }
      });
    },
    {
      rootMargin: "-45% 0px -45% 0px",
      threshold: 0.1,
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function initReveal() {
  if (prefersReducedMotion) {
    document.querySelectorAll(".observe").forEach((el) => el.classList.add("in-view"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".observe").forEach((el) => revealObserver.observe(el));
}

function init() {
  loadPreferences();

  [sizeSelect, styleSelect, pickupToggle].forEach((field) => {
    field.addEventListener("change", calculatePrice);
  });

  priceForm.addEventListener("submit", savePreferences);

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  initNav();
  initScrollSpy();
  initReveal();
}

document.addEventListener("DOMContentLoaded", init);
