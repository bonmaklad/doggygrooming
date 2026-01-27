'use client';

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import galleryPhotoOne from "./images/5152210126990150542.jpg";
import galleryPhotoTwo from "./images/5152210126990150543.jpg";
import aboutPhoto from "./images/Media (1).jpeg";
import galleryPhotoFour from "./images/Media (2).jpeg";
import galleryPhotoFive from "./images/Media (3).jpeg";
import galleryPhotoSix from "./images/Media (4).jpeg";
import {
  FaPaw,
  FaLeaf,
  FaCut,
  FaBath,
  FaBone,
  FaHandsHelping,
  FaPumpSoap,
  FaCalendarCheck,
  FaEnvelope,
  FaPhone,
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaMapMarkerAlt,
  FaHeart,
} from "react-icons/fa";

const servicesOffered = [
  {
    title: "Wash & Blow Dry",
    description:
      "A thorough wash and gentle blow dry to leave your dog clean, fresh, and soft.",
    prices: [
      { label: "Small", value: 50 },
      { label: "Medium", value: 60 },
      { label: "Large", value: 70 },
    ],
    icon: FaPumpSoap,
    theme: "wash",
  },
  {
    title: "Basic Trim",
    description:
      "Tidy-up to maintain coat shape and overall appearance between full grooms.",
    prices: [
      { label: "Small", value: 65 },
      { label: "Medium", value: 75 },
      { label: "Large", value: 85 },
    ],
    icon: FaCut,
    theme: "trim",
  },
  {
    title: "Full Groom",
    description:
      "Complete grooming including bathing, drying, brushing, clipping, nail trimming, and finishing touches.",
    prices: [
      { label: "Small", value: 90 },
      { label: "Medium", value: 100 },
      { label: "Large", value: 120 },
    ],
    icon: FaBath,
    theme: "groom",
  },
  {
    title: "De-Shed Treatment",
    description:
      "Ideal for double-coated or heavy shedding breeds. Reduces excess fur and promotes coat health.",
    prices: [
      { label: "Small", value: 90 },
      { label: "Medium", value: 100 },
      { label: "Large", value: 130 },
    ],
    icon: FaLeaf,
    theme: "deshed",
  },
];

const bookingServices = [
  { value: "Wash & Blow Dry", label: "Wash & Blow Dry" },
  { value: "Basic Trim", label: "Basic Trim" },
  { value: "Full Groom", label: "Full Groom" },
  { value: "De-Shed Treatment", label: "De-Shed Treatment" },
];

const bookingDogSizes = [
  { value: "Small", label: "Small (up to 10kg)" },
  { value: "Medium", label: "Medium (11–20kg)" },
  { value: "Large", label: "Large (21–35kg)" },
];

const galleryImages = [
  {
    src: galleryPhotoOne,
    alt: "Groomed dog portrait in the salon",
  },
  {
    src: galleryPhotoTwo,
    alt: "Happy pup after a fresh trim",
  },
  {
    src: aboutPhoto,
    alt: "Fluffy pup showing off a tidy coat",
  },
  {
    src: galleryPhotoFour,
    alt: "Dog freshly groomed and camera ready",
  },
  {
    src: galleryPhotoFive,
    alt: "Pup with a clean, soft finish",
  },
  {
    src: galleryPhotoSix,
    alt: "Groomed dog smiling for the gallery",
  },
];

const aboutHighlights = [
  { icon: FaBone, text: "Stress-free grooming suites" },
  { icon: FaPumpSoap, text: "Hypoallergenic shampoos" },
  { icon: FaHandsHelping, text: "Positive reinforcement" },
];

const bookingHighlights = [
  { icon: FaCalendarCheck, text: "Friday 9–5 & Saturday 9–1" },
  { icon: FaPaw, text: "2-hour grooming slots" },
  { icon: FaEnvelope, text: "Email confirmation" },
];

const navItems = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Gallery", href: "#gallery" },
  { label: "Booking", href: "#booking" },
  { label: "Contact", href: "#contact" },
];

export default function HomePage() {
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [availability, setAvailability] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStatus, setBookingStatus] = useState({ state: "idle", message: "" });
  const [formValues, setFormValues] = useState({
    service: bookingServices[0].value,
    dogSize: bookingDogSizes[0].value,
    name: "",
    email: "",
    phone: "",
    dogName: "",
    notes: "",
  });

  const fetchAvailability = useCallback(async () => {
    setAvailabilityStatus("loading");
    setAvailabilityError("");
    try {
      const response = await fetch("/api/availability");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load availability.");
      }
      setAvailability(data.slots || []);
      if (data.slots?.length) {
        setSelectedDayKey((prev) =>
          data.slots.some((day) => day.dateKey === prev) ? prev : data.slots[0].dateKey
        );
      }
      setAvailabilityStatus("ready");
    } catch (error) {
      setAvailabilityStatus("error");
      setAvailabilityError(error?.message || "Unable to load availability.");
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
    fetchAvailability();
  }, [fetchAvailability]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleDaySelect = (dayKey) => {
    setSelectedDayKey(dayKey);
    setSelectedSlot(null);
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    if (!selectedSlot) {
      setBookingStatus({ state: "error", message: "Please choose a time slot first." });
      return;
    }
    setBookingStatus({ state: "loading", message: "Booking your appointment..." });

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formValues,
          start: selectedSlot.start,
          end: selectedSlot.end,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete booking.");
      }

      setBookingStatus({
        state: "success",
        message: "Booked! Check your email for confirmation.",
      });
      setSelectedSlot(null);
      fetchAvailability();
    } catch (error) {
      setBookingStatus({
        state: "error",
        message: error?.message || "Unable to complete booking.",
      });
    }
  };

  const selectedDay =
    availability.find((day) => day.dateKey === selectedDayKey) || availability[0];

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
                KeriKeri Area on 021 934 841
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section soft-bg">
          <div className="container about-grid observe">
            <div className="about-image">
              <Image
                src={aboutPhoto}
                alt="Groomer blow-drying a small dog"
                width={560}
                height={600}
              />
            </div>
            <div className="about-content">
              <h2>Meet Cut &amp; Cuddle</h2>
              <p>
                We are a KeriKeri-based grooming studio delivering calm, caring
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
            <div className="section-header observe services-header">
              <h2>Services Offered</h2>
              <p>
                At Cut &amp; Cuddle Dog Groomers, I provide professional grooming
                services tailored to your dog&apos;s individual needs. Every service
                is carried out with care, patience, and a focus on your dog&apos;s wellbeing.
              </p>
            </div>
            <div className="services-divider" aria-hidden="true">
              <span />
              <FaHeart />
              <span />
            </div>
            <div className="services-offered">
              {servicesOffered.map((service) => {
                const Icon = service.icon;
                return (
                  <article
                    className={`service-band ${service.theme} observe`}
                    key={service.title}
                  >
                    <div className="service-icon">
                      <Icon />
                    </div>
                    <div className="service-content">
                      <div className="service-heading">
                        <h3>{service.title}</h3>
                        {/* <span>Prices From</span> */}
                      </div>
                      <p>{service.description}</p>
                      <div className="service-prices">
                        {service.prices.map((price) => (
                          <span key={price.label}>
                            {price.label}: ${price.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="services-disclaimer">
              Prices may vary depending on coat condition, size, temperament, and grooming requirements.
            </p>
            <div className="services-cta">
              <h3>Book Your Groom Today!</h3>
              <a className="btn primary" href="#booking">
                Book Now
              </a>
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
                Tell us about your pup, choose the service you need, and pick an open
                Friday or Saturday slot. We’ll send your confirmation by email.
              </p>
              <ul className="pill-list">
                {bookingHighlights.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <Icon /> {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="booking-form-card">
              <form onSubmit={handleBookingSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="booking-service">Service</label>
                    <select
                      id="booking-service"
                      name="service"
                      value={formValues.service}
                      onChange={handleFormChange}
                    >
                      {bookingServices.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-dog-size">Dog Size</label>
                    <select
                      id="booking-dog-size"
                      name="dogSize"
                      value={formValues.dogSize}
                      onChange={handleFormChange}
                    >
                      {bookingDogSizes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-dog-name">Dog Name</label>
                    <input
                      id="booking-dog-name"
                      name="dogName"
                      type="text"
                      value={formValues.dogName}
                      onChange={handleFormChange}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-name">Your Name</label>
                    <input
                      id="booking-name"
                      name="name"
                      type="text"
                      value={formValues.name}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-email">Email</label>
                    <input
                      id="booking-email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-phone">Phone</label>
                    <input
                      id="booking-phone"
                      name="phone"
                      type="tel"
                      value={formValues.phone}
                      onChange={handleFormChange}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="booking-notes">Notes</label>
                  <textarea
                    id="booking-notes"
                    name="notes"
                    rows={3}
                    value={formValues.notes}
                    onChange={handleFormChange}
                    placeholder="Allergies, coat condition, or special requests."
                  />
                </div>

                <div className="slot-picker">
                  <div className="slot-picker-header">
                    <h3>Choose a time</h3>
                    <span>2-hour sessions · Friday 9–5 · Saturday 9–1</span>
                  </div>
                  {availabilityStatus === "loading" && (
                    <p className="slot-message">Loading available times…</p>
                  )}
                  {availabilityStatus === "error" && (
                    <p className="slot-message error">{availabilityError}</p>
                  )}
                  {availabilityStatus === "ready" && availability.length === 0 && (
                    <p className="slot-message">No availability found. Please check back soon.</p>
                  )}
                  {availabilityStatus === "ready" && availability.length > 0 && (
                    <div className="slot-grid">
                      <div className="slot-day-picker">
                        {availability.map((day) => (
                          <button
                            key={day.dateKey}
                            type="button"
                            className={`slot-button${
                              selectedDayKey === day.dateKey ? " selected" : ""
                            }`}
                            onClick={() => handleDaySelect(day.dateKey)}
                          >
                            {day.dateLabel}
                          </button>
                        ))}
                      </div>
                      <div className="slot-day">
                        <span className="slot-date">{selectedDay?.dateLabel}</span>
                        <div className="slot-times">
                          {selectedDay?.slots.map((slot) => (
                              <button
                                key={slot.start}
                                type="button"
                                className={`slot-button${
                                  selectedSlot?.start === slot.start ? " selected" : ""
                                }`}
                                onClick={() =>
                                  setSelectedSlot({
                                    ...slot,
                                    dateLabel: selectedDay?.dateLabel || "",
                                  })
                                }
                              >
                                {slot.label}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedSlot && (
                    <p className="slot-selected">
                      Selected: {selectedSlot.dateLabel} at {selectedSlot.label}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={bookingStatus.state === "loading"}
                >
                  {bookingStatus.state === "loading" ? "Booking…" : "Book Appointment"}
                </button>
                {bookingStatus.message && (
                  <p className={`status-message ${bookingStatus.state}`}>
                    {bookingStatus.message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>

        <section id="contact" className="section soft-bg">
          <div className="container contact-grid observe">
            <div className="contact-card">
              <h2>Let’s Chat</h2>
              <p>
                Ready to schedule or have a question? Reach out and we’ll be in touch
                within one business day.
              </p>
              <div className="contact-links">
                <a className="contact-link" href="mailto:cutandcuddle01@gmail.com">
                  <span className="contact-icon">
                    <FaEnvelope />
                  </span>
                  <span>
                    <span className="contact-label">Email</span>
                    <span className="contact-value">cutandcuddle01@gmail.com</span>
                  </span>
                </a>
                <a className="contact-link" href="tel:+6421934841">
                  <span className="contact-icon">
                    <FaPhone />
                  </span>
                  <span>
                    <span className="contact-label">Phone</span>
                    <span className="contact-value">021 934 841</span>
                  </span>
                </a>
              </div>
            </div>
            <div className="visit-card">
              <div className="hours">
                <h3>Hours</h3>
                <ul>
                  <li>Fri: 9:00am – 5:00pm</li>
                  <li>Saturday: 9:00am – 1:00pm</li>
                  {/* <li>Sunday: By appointment</li> */}
                </ul>
              </div>
              <div className="location">
                <h3>Visit Us</h3>
                <p>
                  <FaMapMarkerAlt /> 6033 State Highway 12 Ohaeawai
                </p>
              </div>
              <div className="map-wrapper">
                <iframe
                  title="Cut & Cuddle Location in Ohaeawai"
                  src="https://www.google.com/maps?q=6033+State+Highway+12,+Ohaeawai,+New+Zealand&output=embed"
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
                {/* <a href="https://www.tiktok.com" aria-label="TikTok" target="_blank" rel="noreferrer">
                  <FaTiktok />
                </a> */}
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
          <a href="mailto:cutandcuddle01@gmail.com">
            <FaEnvelope /> cutandcuddle01@gmail.com
          </a>
        </div>
      </footer>
    </>
  );
}
