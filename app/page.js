'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  FaPaw,
  FaLeaf,
  FaBone,
  FaHandsHelping,
  FaPumpSoap,
  FaCalendarCheck,
  FaEnvelope,
  FaCarSide,
  FaPhone,
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaMapMarkerAlt,
  FaHeart,
} from "react-icons/fa";

const pricingMatrix = {
  small: { basic: 45, full: 65, show: 90 },
  medium: { basic: 55, full: 80, show: 105 },
  large: { basic: 70, full: 95, show: 120 },
  xl: { basic: 85, full: 110, show: 140 },
};

const dogSizes = [
  { value: "small", label: "Small (up to 10kg)" },
  { value: "medium", label: "Medium (11–20kg)" },
  { value: "large", label: "Large (21–35kg)" },
  { value: "xl", label: "XL (36kg+)" },
];

const styleOptions = [
  { value: "basic", label: "Basic Trim" },
  { value: "full", label: "Full Groom" },
  { value: "show", label: "Show Style" },
];

const services = [
  {
    title: "Basic Trim",
    description: "Bath, blow-dry, tidy trim, nail clipping, and ear cleaning.",
    image: "https://images.pexels.com/photos/7717424/pexels-photo-7717424.jpeg",
    alt: "Dog receiving a brush",
  },
  {
    title: "Full Groom",
    description: "Full-body clip, style finish, teeth cleaning, and paw balm.",
    image: "https://images.pexels.com/photos/5731918/pexels-photo-5731918.jpeg",
    alt: "Dog getting a full groom",
  },
  {
    title: "Show Style",
    description:
      "Breed-specific cut, coat brightening treatment, and finishing spray.",
    image: "https://images.pexels.com/photos/7210453/pexels-photo-7210453.jpeg",
    alt: "Show dog in grooming process",
  },
];

const galleryImages = [
  {
    src: "https://images.pexels.com/photos/4577807/pexels-photo-4577807.jpeg",
    alt: "Small white dog with bow after grooming",
  },
  {
    src: "https://images.pexels.com/photos/7210539/pexels-photo-7210539.jpeg",
    alt: "Happy dog with fresh haircut",
  },
  {
    src: "https://images.pexels.com/photos/7210436/pexels-photo-7210436.jpeg",
    alt: "Corgi being combed at groomer",
  },
  {
    src: "https://images.pexels.com/photos/9769850/pexels-photo-9769850.jpeg",
    alt: "Fluffy dog with a bandana",
  },
  {
    src: "https://images.pexels.com/photos/7210531/pexels-photo-7210531.jpeg",
    alt: "Poodle with fresh trim",
  },
  {
    src: "https://images.pexels.com/photos/7210527/pexels-photo-7210527.jpeg",
    alt: "Dog posing after grooming session",
  },
];

const aboutHighlights = [
  { icon: FaBone, text: "Stress-free grooming suites" },
  { icon: FaPumpSoap, text: "Hypoallergenic shampoos" },
  { icon: FaHandsHelping, text: "Positive reinforcement" },
];

const bookingHighlights = [
  { icon: FaCalendarCheck, text: "Live availability updates" },
  { icon: FaEnvelope, text: "Email confirmation within 24 hours" },
  { icon: FaCarSide, text: "Add pick-up & drop-off at checkout" },
];

const navItems = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Gallery", href: "#gallery" },
  { label: "Booking", href: "#booking" },
  { label: "Contact", href: "#contact" },
];

const storageKey = "cutAndCuddlePricing";
const pickupFee = 15;

const calculateTotal = (size, style, pickup) => {
  const base = pricingMatrix[size][style];
  return base + (pickup ? pickupFee : 0);
};

export default function HomePage() {
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [size, setSize] = useState("small");
  const [style, setStyle] = useState("basic");
  const [pickup, setPickup] = useState(false);
  const [saved, setSaved] = useState(false);

  const total = useMemo(() => calculateTotal(size, style, pickup), [size, style, pickup]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedPrefs = window.localStorage.getItem(storageKey);
      if (!savedPrefs) return;
      const parsed = JSON.parse(savedPrefs);
      if (parsed.size) setSize(parsed.size);
      if (parsed.style) setStyle(parsed.style);
      if (typeof parsed.pickup === "boolean") setPickup(parsed.pickup);
    } catch (error) {
      console.warn("Unable to load preferences from localStorage.", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sections = document.querySelectorAll("section[id]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            if (id) setActiveSection(id);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0.1 }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const elements = document.querySelectorAll(".observe");
    if (!elements.length) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      elements.forEach((el) => el.classList.add("in-view"));
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

    elements.forEach((el) => revealObserver.observe(el));

    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(false), 900);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  const handleSavePreferences = (event) => {
    event.preventDefault();
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ size, style, pickup })
      );
      setSaved(true);
    } catch (error) {
      console.warn("Unable to save preferences to localStorage.", error);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      <header className="site-header">
        <div className="container">
          <nav className="nav">
            <a className="brand" href="#hero">
              Cut &amp; Cuddle
            </a>
            <button
              className="nav-toggle"
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={navOpen ? "true" : "false"}
              onClick={() => setNavOpen((open) => !open)}
            >
              <span className="hamburger" />
            </button>
            <ul className={`nav-links${navOpen ? " open" : ""}`}>
              {navItems.map(({ label, href }) => (
                <li key={href}>
                  <a
                    className={`nav-link${activeSection === href.slice(1) ? " active" : ""}`}
                    href={href}
                    onClick={() => setNavOpen(false)}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main>
        <section id="hero" className="hero section">
          <div className="container hero-grid">
            <div className="hero-content observe">
              <span className="tagline">Loving care, spotless style</span>
              <h1>Cut &amp; Cuddle Dog Grooming</h1>
              <p>
                From first brush to final bow, we treat every pup like family. Enjoy
                gentle grooming, premium products, and a calming spa experience
                tailored to your dog’s needs.
              </p>
              <div className="hero-actions">
                <a className="btn primary" href="#booking">
                  View Availability
                </a>
                <a className="btn ghost" href="#services">
                  See Services
                </a>
              </div>
              <div className="hero-badges">
                <span>
                  <FaPaw /> Fear-free certified stylists
                </span>
                <span>
                  <FaLeaf /> Eco-friendly wash products
                </span>
              </div>
            </div>
            <div className="hero-media observe">
              <Image
                src="https://images.pexels.com/photos/3299908/pexels-photo-3299908.jpeg"
                alt="Freshly groomed dog smiling at the camera"
                width={640}
                height={760}
                className="hero-photo"
                priority
              />
              <div className="media-note">
                <FaHeart />
                Tailored trims &amp; cuddles in Whanganui
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section soft-bg">
          <div className="container about-grid observe">
            <div className="about-image">
              <Image
                src="https://images.pexels.com/photos/7210666/pexels-photo-7210666.jpeg"
                alt="Groomer blow-drying a small dog"
                width={560}
                height={600}
              />
            </div>
            <div className="about-content">
              <h2>Meet Cut &amp; Cuddle</h2>
              <p>
                We are a Whanganui-based grooming studio delivering calm, caring
                experiences for every dog who walks through our doors. Our team
                specializes in gentle handling, breed-specific styling, and creating
                a spa day that feels like a hug.
              </p>
              <ul className="pill-list">
                {aboutHighlights.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <Icon /> {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="services" className="section">
          <div className="container">
            <div className="section-header observe">
              <span className="tagline">Tailored trims</span>
              <h2>Services &amp; Pricing</h2>
              <p>
                Choose the perfect pamper for your pup. Pricing updates instantly—
                and you can save your preferences for next time.
              </p>
            </div>
            <div className="services-grid">
              {services.map((service) => (
                <article className="service-card observe" key={service.title}>
                  <Image
                    src={service.image}
                    alt={service.alt}
                    width={480}
                    height={360}
                  />
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="calculator observe">
              <h3>Instant Price Calculator</h3>
              <form onSubmit={handleSavePreferences}>
                <div className="form-group">
                  <label htmlFor="dog-size">Dog Size</label>
                  <select
                    id="dog-size"
                    name="dog-size"
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                  >
                    {dogSizes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="style">Hair Style</label>
                  <select
                    id="style"
                    name="style"
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                  >
                    {styleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group toggle">
                  <label htmlFor="pickup-toggle">Pick-up &amp; Drop-off</label>
                  <label className="switch">
                    <input
                      id="pickup-toggle"
                      type="checkbox"
                      checked={pickup}
                      onChange={(event) => setPickup(event.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                  <span className="toggle-note">Add concierge transport for ${pickupFee}</span>
                </div>
                <div className="price-display">
                  <span>Total estimate</span>
                  <strong className={saved ? "saved" : undefined}>${total}</strong>
                </div>
                <button type="submit" className="btn primary">
                  Save Preferences
                </button>
              </form>
              <p className="calculator-note">
                * Price is an estimate. Final quotes depend on coat condition and styling
                time.
              </p>
            </div>
          </div>
        </section>

        <section id="gallery" className="section soft-bg">
          <div className="container">
            <div className="section-header observe">
              <span className="tagline">Happy clients</span>
              <h2>Freshly Groomed Smiles</h2>
              <p>
                Every dog leaves Cut &amp; Cuddle feeling confident, comfortable, and
                camera-ready.
              </p>
            </div>
            <div className="gallery-grid">
              {galleryImages.map((image) => (
                <figure className="gallery-item observe" key={image.src}>
                  <Image src={image.src} alt={image.alt} width={480} height={480} />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="booking" className="section">
          <div className="container booking-grid observe">
            <div className="booking-content">
              <span className="tagline">Plan your visit</span>
              <h2>Book Your Pup’s Spa Day</h2>
              <p>
                View our availability and request your appointment straight from
                Google Calendar. Choose a time that suits you, and we’ll confirm by
                email.
              </p>
              <ul className="pill-list">
                {bookingHighlights.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <Icon /> {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="calendar-wrapper">
              <iframe
                title="Cut & Cuddle Booking Calendar"
                src="https://calendar.google.com/calendar/embed?src=c_995f0cf1bcd8044b0d62424a0c5a577db96ac58de1a3a98753f6ad1988dd9eb9%40group.calendar.google.com&ctz=Pacific/Auckland"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section id="contact" className="section soft-bg">
          <div className="container contact-grid observe">
            <div className="contact-card">
              <h2>Let’s Chat</h2>
              <p>
                Ready to schedule or have a question? Send us a note and we’ll be in
                touch within one business day.
              </p>
              <form
                className="contact-form"
                action="mailto:hello@cutandcuddle.co.nz"
                method="post"
                encType="text/plain"
              >
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" type="text" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required />
                </div>
                <div className="form-group">
                  <label htmlFor="message">Message</label>
                  <textarea id="message" name="message" rows={4} required />
                </div>
                <button type="submit" className="btn primary">
                  Send Message
                </button>
              </form>
            </div>
            <div className="visit-card">
              <div className="hours">
                <h3>Hours</h3>
                <ul>
                  <li>Mon–Fri: 8:30am – 6:00pm</li>
                  <li>Saturday: 9:00am – 4:00pm</li>
                  <li>Sunday: By appointment</li>
                </ul>
              </div>
              <div className="location">
                <h3>Visit Us</h3>
                <p>
                  <FaMapMarkerAlt /> 42 Riverbank Road, Whanganui, New Zealand
                </p>
              </div>
              <div className="map-wrapper">
                <iframe
                  title="Cut & Cuddle Location in Whanganui"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d101383.83988387658!2d175.0137754!3d-39.925039299999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6d4014ca7f818ef9%3A0x500ef6143a2f4d0!2sWhanganui!5e0!3m2!1sen!2snz!4v1709964582523"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="socials">
                <a href="https://www.facebook.com" aria-label="Facebook" target="_blank" rel="noreferrer">
                  <FaFacebookF />
                </a>
                <a href="https://www.instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer">
                  <FaInstagram />
                </a>
                <a href="https://www.tiktok.com" aria-label="TikTok" target="_blank" rel="noreferrer">
                  <FaTiktok />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <p>&copy; {currentYear} Cut &amp; Cuddle Grooming. All rights reserved.</p>
          <a href="tel:+6465551234">
            <FaPhone /> (06) 555 1234
          </a>
          <a href="mailto:hello@cutandcuddle.co.nz">
            <FaEnvelope /> hello@cutandcuddle.co.nz
          </a>
        </div>
      </footer>
    </>
  );
}
