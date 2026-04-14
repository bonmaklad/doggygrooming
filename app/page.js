'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BOOKING_DAY_LABEL,
  BOOKING_SLOT_SUMMARY,
  BOOKING_TIME_LABEL,
} from "../lib/bookingConfig";
import heroPhoto from "./images/main.png";
import aboutPhoto from "./images/20260122_142420(1)(1).jpg";
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
  FaChevronLeft,
  FaChevronRight,
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

const beforeAfterImageContext = require.context(
  "./images/beforeafter",
  false,
  /\.(avif|gif|jpe?g|png|webp)$/i
);

const galleryImages = beforeAfterImageContext
  .keys()
  .sort((a, b) => a.localeCompare(b))
  .map((filePath) => {
    const fileName = filePath.replace("./", "");
    const readableName = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      key: fileName,
      src: beforeAfterImageContext(filePath),
      alt: readableName
        ? `Freshly groomed dog: ${readableName}`
        : "Freshly groomed dog",
    };
  });

const aboutHighlights = [
  { icon: FaBone, text: "Stress-free grooming suites" },
  { icon: FaPumpSoap, text: "Hypoallergenic shampoos" },
  { icon: FaHandsHelping, text: "Positive reinforcement" },
];

const bookingHighlights = [
  { icon: FaCalendarCheck, text: `${BOOKING_DAY_LABEL} at ${BOOKING_TIME_LABEL}` },
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

const CALENDAR_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALENDAR_TIME_ZONE = "Pacific/Auckland";

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
};

const getMonthKey = (dateKey) => dateKey.slice(0, 7);

const makeCalendarDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

const formatCalendarMonth = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(makeCalendarDate(year, month, 1));
};

const buildCalendarMonths = (days) => {
  if (!days.length) return [];

  const first = parseDateKey(days[0].dateKey);
  const last = parseDateKey(days[days.length - 1].dateKey);
  const months = [];
  let year = first.year;
  let month = first.month;

  while (year < last.year || (year === last.year && month <= last.month)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

const buildCalendarDays = (monthKey, availabilityByDate) => {
  if (!monthKey) return [];

  const [year, month] = monthKey.split("-").map(Number);
  const firstOfMonth = makeCalendarDate(year, month, 1);
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const calendarDays = [];

  for (let blank = 0; blank < leadingBlanks; blank += 1) {
    calendarDays.push({ type: "blank", key: `blank-${monthKey}-${blank}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    calendarDays.push({
      type: "day",
      key: dateKey,
      dateKey,
      dayNumber: day,
      isAvailable: Boolean(availabilityByDate[dateKey]),
    });
  }

  return calendarDays;
};

export default function HomePage() {
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [visibleMonthKey, setVisibleMonthKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStatus, setBookingStatus] = useState({ state: "idle", message: "" });
  const [bookingErrors, setBookingErrors] = useState({});
  const [formValues, setFormValues] = useState({
    service: bookingServices[0].value,
    dogSize: bookingDogSizes[0].value,
    name: "",
    email: "",
    phone: "",
    dogName: "",
    notes: "",
  });
  const selectedDayKeyRef = useRef("");
  const visibleGallerySlides = 3;
  const galleryVisibleCount = Math.max(
    1,
    Math.min(visibleGallerySlides, galleryImages.length)
  );
  const maxGalleryIndex = Math.max(0, galleryImages.length - galleryVisibleCount);
  const galleryTranslateStep = 100 / galleryVisibleCount;
  const gallerySlidePositions = Array.from(
    { length: maxGalleryIndex + 1 },
    (_, index) => index
  );

  const fetchAvailability = useCallback(async () => {
    setAvailabilityStatus("loading");
    setAvailabilityError("");
    try {
      const response = await fetch("/api/availability");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load availability.");
      }
      const nextAvailability = data.slots || [];
      setAvailability(nextAvailability);
      if (nextAvailability.length) {
        const nextSelectedDayKey = nextAvailability.some(
          (day) => day.dateKey === selectedDayKeyRef.current
        )
          ? selectedDayKeyRef.current
          : nextAvailability[0].dateKey;
        setSelectedDayKey(nextSelectedDayKey);
        setVisibleMonthKey(getMonthKey(nextSelectedDayKey));
      } else {
        setSelectedDayKey("");
        setVisibleMonthKey("");
      }
      setAvailabilityStatus("ready");
    } catch (error) {
      setAvailabilityStatus("error");
      setAvailabilityError(error?.message || "Unable to load availability.");
    }
  }, []);

  useEffect(() => {
    selectedDayKeyRef.current = selectedDayKey;
  }, [selectedDayKey]);

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

  useEffect(() => {
    setActiveGalleryIndex((prev) => Math.min(prev, maxGalleryIndex));
  }, [maxGalleryIndex]);

  useEffect(() => {
    if (maxGalleryIndex < 1 || isGalleryPaused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveGalleryIndex((prev) => (prev >= maxGalleryIndex ? 0 : prev + 1));
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isGalleryPaused, maxGalleryIndex]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (bookingErrors[name]) {
      setBookingErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleDaySelect = (dayKey) => {
    setSelectedDayKey(dayKey);
    setSelectedSlot(null);
  };

  const validateBooking = (values, slot) => {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!values.name.trim()) {
      errors.name = "Please enter your name.";
    }
    if (!values.email.trim()) {
      errors.email = "Please enter your email.";
    } else if (!emailPattern.test(values.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (values.phone.trim()) {
      const phoneDigits = values.phone.replace(/\D/g, "");
      if (phoneDigits.length < 7) {
        errors.phone = "Please enter a valid phone number.";
      }
    }
    if (!slot) {
      errors.slot = "Please choose a time slot.";
    }

    return errors;
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    const errors = validateBooking(formValues, selectedSlot);
    if (Object.keys(errors).length) {
      setBookingErrors(errors);
      setBookingStatus({
        state: "error",
        message: "Please fix the highlighted fields and try again.",
      });
      return;
    }
    setBookingErrors({});
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
      setBookingErrors({});
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
  const availabilityByDate = availability.reduce((acc, day) => {
    acc[day.dateKey] = day;
    return acc;
  }, {});
  const calendarMonths = buildCalendarMonths(availability);
  const calendarDays = buildCalendarDays(visibleMonthKey, availabilityByDate);
  const visibleMonthIndex = calendarMonths.indexOf(visibleMonthKey);
  const visibleMonthLabel = visibleMonthKey ? formatCalendarMonth(visibleMonthKey) : "";

  const handleMonthSelect = (monthKey) => {
    if (!monthKey) return;
    setVisibleMonthKey(monthKey);
    const firstAvailableDay = availability.find((day) => getMonthKey(day.dateKey) === monthKey);
    if (firstAvailableDay) {
      setSelectedDayKey(firstAvailableDay.dateKey);
      setSelectedSlot(null);
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
                src={heroPhoto}
                alt="Freshly groomed dog smiling at the camera"
                width={640}
                height={760}
                className="hero-photo"
                priority
              />
              <div className="media-note">
                <FaHeart />
                KeriKeri Area on 020 446 4141
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
                Welcome to Cut &amp; Cuddle Dog Groomers, a professional dog
                grooming service based near Kerikeri.
              </p>
              <p>
                At Cut &amp; Cuddle, we are committed to delivering high-quality
                grooming in a calm, safe, and caring environment. Every dog is
                treated with patience, kindness, and respect, with grooming
                services tailored to suit their individual needs, coat type, and
                temperament.
              </p>
              <p>
                Our priority is ensuring your dog feels comfortable and relaxed
                throughout the grooming process while achieving reliable,
                professional results. Whether your dog requires a simple tidy-up
                or a complete full groom, you can be confident they will receive
                attentive care from start to finish.
              </p>
              <p>
                For added convenience, pick-up and drop-off services can be
                arranged upon request, making it easier for busy owners to keep
                their dogs well groomed. If you are seeking professional and
                dependable dog grooming services in Kerikeri and the surrounding
                areas, Cut &amp; Cuddle Dog Groomers would be delighted to care
                for your dog.
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
            {galleryImages.length ? (
              <div
                className="gallery-carousel observe"
                onMouseEnter={() => setIsGalleryPaused(true)}
                onMouseLeave={() => setIsGalleryPaused(false)}
              >
                <div className="gallery-viewport">
                  <div
                    className="gallery-track"
                    style={{
                      transform: `translateX(-${activeGalleryIndex * galleryTranslateStep}%)`,
                      "--gallery-visible-count": galleryVisibleCount,
                    }}
                  >
                    {galleryImages.map((image) => (
                      <figure className="gallery-slide" key={image.key}>
                        <div className="gallery-slide-frame">
                          <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            sizes="(max-width: 980px) 100vw, 33vw"
                          />
                        </div>
                      </figure>
                    ))}
                  </div>
                </div>
                {maxGalleryIndex > 0 && (
                  <div className="gallery-dots" aria-label="Gallery slide selector">
                    {gallerySlidePositions.map((index) => (
                      <button
                        type="button"
                        className={`gallery-dot${index === activeGalleryIndex ? " active" : ""}`}
                        key={`dot-${index}`}
                        onClick={() => setActiveGalleryIndex(index)}
                        aria-label={`Show slide ${index + 1}`}
                        aria-current={index === activeGalleryIndex ? "true" : "false"}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="gallery-empty">
                Add photos to <code>app/images/beforeafter</code> to display your gallery.
              </p>
            )}
          </div>
        </section>

        <section id="booking" className="section">
          <div className="container booking-grid observe">
            <div className="booking-content">
              <span className="tagline">Plan your visit</span>
              <h2>Book Your Pup’s Spa Day</h2>
              <p>
                Tell us about your pup, choose the service you need, and pick an open
                Monday to Thursday slot at 1pm or 3pm. We’ll send your confirmation
                by email.
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
              <form onSubmit={handleBookingSubmit} noValidate>
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
                      aria-invalid={bookingErrors.name ? "true" : "false"}
                      aria-describedby={bookingErrors.name ? "booking-name-error" : undefined}
                      required
                    />
                    {bookingErrors.name && (
                      <p className="field-error" id="booking-name-error">
                        {bookingErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-email">Email</label>
                    <input
                      id="booking-email"
                      name="email"
                      type="email"
                      value={formValues.email}
                      onChange={handleFormChange}
                      aria-invalid={bookingErrors.email ? "true" : "false"}
                      aria-describedby={bookingErrors.email ? "booking-email-error" : undefined}
                      required
                    />
                    {bookingErrors.email && (
                      <p className="field-error" id="booking-email-error">
                        {bookingErrors.email}
                      </p>
                    )}
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
                      aria-invalid={bookingErrors.phone ? "true" : "false"}
                      aria-describedby={bookingErrors.phone ? "booking-phone-error" : undefined}
                    />
                    {bookingErrors.phone && (
                      <p className="field-error" id="booking-phone-error">
                        {bookingErrors.phone}
                      </p>
                    )}
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

                <div className={`slot-picker${bookingErrors.slot ? " error" : ""}`}>
                  <div className="slot-picker-header">
                    <h3>Choose a day and time</h3>
                    <span>{BOOKING_SLOT_SUMMARY}</span>
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
                      <div className="slot-calendar">
                        <div className="slot-step-header">
                          <span className="slot-step-number">1</span>
                          <div>
                            <h4>Choose a day</h4>
                            <p className="slot-helper">
                              Available days are highlighted. Unavailable dates are blocked out.
                            </p>
                          </div>
                        </div>
                        <div className="calendar-shell">
                          <div className="calendar-toolbar">
                            <button
                              type="button"
                              className="calendar-nav"
                              onClick={() => handleMonthSelect(calendarMonths[visibleMonthIndex - 1])}
                              disabled={visibleMonthIndex <= 0}
                              aria-label="Show previous month"
                            >
                              <FaChevronLeft />
                            </button>
                            <span className="calendar-month">{visibleMonthLabel}</span>
                            <button
                              type="button"
                              className="calendar-nav"
                              onClick={() => handleMonthSelect(calendarMonths[visibleMonthIndex + 1])}
                              disabled={visibleMonthIndex === -1 || visibleMonthIndex >= calendarMonths.length - 1}
                              aria-label="Show next month"
                            >
                              <FaChevronRight />
                            </button>
                          </div>
                          <div className="calendar-weekdays" aria-hidden="true">
                            {CALENDAR_WEEKDAYS.map((weekday) => (
                              <span key={weekday} className="calendar-weekday">
                                {weekday}
                              </span>
                            ))}
                          </div>
                          <div className="calendar-days">
                            {calendarDays.map((day) =>
                              day.type === "blank" ? (
                                <span
                                  key={day.key}
                                  className="calendar-day-spacer"
                                  aria-hidden="true"
                                />
                              ) : (
                                <button
                                  key={day.key}
                                  type="button"
                                  className={`calendar-day${
                                    day.isAvailable ? " available" : " unavailable"
                                  }${selectedDayKey === day.dateKey ? " selected" : ""}`}
                                  onClick={() => handleDaySelect(day.dateKey)}
                                  disabled={!day.isAvailable}
                                  aria-pressed={selectedDayKey === day.dateKey}
                                >
                                  <span className="calendar-day-number">{day.dayNumber}</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="slot-day">
                        <div className="slot-step-header">
                          <span className="slot-step-number">2</span>
                          <div>
                            <h4>Choose a time</h4>
                            <p className="slot-helper">
                              {selectedDay
                                ? `Showing times for ${selectedDay.dateLabel}.`
                                : "Select an available day to see time slots."}
                            </p>
                          </div>
                        </div>
                        {selectedDay ? (
                          <>
                            <span className="slot-date">{selectedDay.dateLabel}</span>
                            <div className="slot-times">
                              {selectedDay.slots.map((slot) => (
                                <button
                                  key={slot.start}
                                  type="button"
                                  className={`slot-button${
                                    selectedSlot?.start === slot.start ? " selected" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedSlot({
                                      ...slot,
                                      dateLabel: selectedDay.dateLabel || "",
                                    });
                                    if (bookingErrors.slot) {
                                      setBookingErrors((prev) => {
                                        const nextErrors = { ...prev };
                                        delete nextErrors.slot;
                                        return nextErrors;
                                      });
                                    }
                                  }}
                                >
                                  {slot.label}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="slot-message">No available day selected yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {bookingErrors.slot && (
                    <p className="field-error" id="booking-slot-error">
                      {bookingErrors.slot}
                    </p>
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
                    <span className="contact-value">020 446 4141</span>
                  </span>
                </a>
              </div>
            </div>
            <div className="visit-card">
              <div className="hours">
                <h3>Hours</h3>
                <ul>
                  <li>Monday–Thursday: 1:00pm &amp; 3:00pm</li>
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
          <a href="tel:+64204464141">
            <FaPhone /> (020) 4464141
          </a>
          <a href="mailto:cutandcuddle01@gmail.com">
            <FaEnvelope /> cutandcuddle01@gmail.com
          </a>
        </div>
      </footer>
    </>
  );
}
