import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FaLocationDot, FaMagnifyingGlass, FaMoneyBillWave, FaRoute, FaPerson, FaPersonDress } from "react-icons/fa6";
import { searchPGs, searchColleges } from "../api";
import PGMap from "../components/PGMap";
import Reveal from "../components/Reveal";
import FacilityIcon from "../components/FacilityIcon";

const RENT_FILTERS = [
  { key: "all",     label: "Any budget",      min: null, max: null },
  { key: "under5k", label: "Under ₹5,000",    min: null, max: 5000 },
  { key: "mid",     label: "₹5,000–₹7,000",   min: 5000, max: 7000 },
  { key: "over7k",  label: "Above ₹7,000",    min: 7000, max: null },
];

const DISTANCE_OPTIONS = [
  { value: "1", label: "Within 1 km" },
  { value: "3", label: "Within 3 km" },
  { value: "5", label: "Within 5 km" },
  { value: "10", label: "Within 10 km" },
  { value: "20", label: "Within 20 km" },
];

const GENDER_FILTERS = [
  { key: "any",    label: "Anyone",  icon: null },
  { key: "male",   label: "Boys",    icon: FaPerson },
  { key: "female", label: "Girls",   icon: FaPersonDress },
];

const JOURNEY = [
  {
    step: "1",
    title: "Find a PG",
    text: "Search by college, compare rent & distance to choose where you want to live.",
  },
  {
    step: "2",
    title: "Check facilities",
    text: "AC, WiFi, study table, fridge, meals — see exactly what each PG offers.",
  },
  {
    step: "3",
    title: "Find a roommate",
    text: "Post a roommate request or apply to join one that fits your budget and vibe.",
  },
  {
    step: "4",
    title: "Join the group & pay",
    text: "Once the owner accepts you, join the PG group and track rent & bills together.",
  },
];

const MARQUEE_COLLEGES = [
  "YCCE Nagpur",
  "VNIT Nagpur",
  "COEP Pune",
  "Fergusson College Pune",
  "IIT Bombay",
  "VJTI Mumbai",
];

const TRUST_ITEMS = ["No brokerage", "Facility-wise comparison", "Roommate matching", "Rent & bill tracking"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [college, setCollege] = useState(null);
  const [radius, setRadius] = useState("3");
  const [gender, setGender] = useState("any");
  const [rentFilter, setRentFilter] = useState("all");
  const [pgs, setPgs] = useState(null);
  const [allPgs, setAllPgs] = useState(null);
  const [center, setCenter] = useState({ lat: 18.5295, lng: 73.8569 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchColleges(query);
        setSuggestions(data.colleges);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function pickCollege(c) {
    setCollege(c);
    setQuery(c.name);
    setSuggestions([]);
  }

  async function runSearch(c, r, rf, g) {
    const filter = RENT_FILTERS.find((f) => f.key === rf);
    setLoading(true);
    setError("");
    try {
      const data = await searchPGs(
        c.latitude,
        c.longitude,
        r,
        filter.min,
        filter.max,
        c.name,
        g === "any" ? "" : g
      );
      setAllPgs(data.pgs);
      setPgs(data.pgs);
      setCenter({ lat: Number(c.latitude), lng: Number(c.longitude) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!college) {
      setError("Pick a college from the suggestions first.");
      return;
    }
    await runSearch(college, radius, rentFilter, gender);
  }

  async function handleGender(key) {
    setGender(key);
    if (college) await runSearch(college, radius, rentFilter, key);
  }

  // Rent filter applies instantly to the results already loaded (no server round-trip).
  function handleRentFilter(key) {
    setRentFilter(key);
    const filter = RENT_FILTERS.find((f) => f.key === key);
    const list = allPgs || [];
    setPgs(
      filter.min == null && filter.max == null
        ? list
        : list.filter(
            (p) =>
              (filter.min == null || Number(p.monthly_rent) >= filter.min) &&
              (filter.max == null || Number(p.monthly_rent) < filter.max)
          )
    );
  }

  function splitFacilities(pg) {
    return pg.facilities ? pg.facilities.split(", ").slice(0, 4) : [];
  }

  function SkeletonCard() {
    return (
      <div className="col-md-6 col-lg-4">
        <div className="fn-skeleton" style={{ height: "100%", minHeight: 360 }}>
          <div className="fn-skel-img fn-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="fn-hero">
        <div className="fn-blob fn-blob-1" />
        <div className="fn-blob fn-blob-2" />
        <div className="fn-blob fn-blob-3" />
        <div className="container position-relative">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <Reveal>
                <span className="fn-hero-badge">Zero brokerage · Verified listings</span>
                <h1>
                  Find your perfect <em className="fn-grad-text">PG</em>
                  <br />
                  near your college
                </h1>
                <p className="fn-hero-sub">
                  Compare facilities and rent, find a roommate, and track payments
                  with your group — all in one place.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <div className="fn-search-card">
                  <form onSubmit={handleSearch}>
                    {/* Row 1: location + search */}
                    <div className="fn-search-row">
                      <div className="fn-autocomplete" ref={dropdownRef}>
                        <span className="fn-input-icon fn-input-icon-loc">
                          <FaLocationDot />
                        </span>
                        <input
                          className="fn-input-with-icon"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search college or area, e.g. YCCE Nagpur"
                          autoComplete="off"
                        />
                        {suggestions.length > 0 && (
                          <ul className="fn-suggestions">
                            {suggestions.map((c) => (
                              <li key={c.id} onClick={() => pickCollege(c)}>
                                <span className="fw-semibold">{c.name}</span>
                                <span className="text-secondary small">{c.city}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button type="submit" className="btn btn-primary fn-search-btn fn-btn-shine" disabled={loading}>
                        <FaMagnifyingGlass className="me-1" />
                        {loading ? "Searching..." : "Search"}
                      </button>
                    </div>

                    {/* Row 2: distance + budget + gender */}
                    <div className="fn-search-filters">
                      <div className="fn-filter-group">
                        <span className="fn-filter-ico"><FaRoute /></span>
                        <select
                          className="fn-filter-select"
                          value={radius}
                          onChange={(e) => setRadius(e.target.value)}
                          aria-label="Search radius"
                        >
                          {DISTANCE_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="fn-filter-group">
                        <span className="fn-filter-ico"><FaMoneyBillWave /></span>
                        <select
                          className="fn-filter-select"
                          value={rentFilter}
                          onChange={(e) => handleRentFilter(e.target.value)}
                          aria-label="Budget"
                        >
                          {RENT_FILTERS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="fn-gender-pills">
                        {GENDER_FILTERS.map((g) => {
                          const Icon = g.icon;
                          return (
                            <button
                              key={g.key}
                              type="button"
                              className={`fn-gender-pill ${gender === g.key ? "active" : ""}`}
                              onClick={() => handleGender(g.key)}
                            >
                              {Icon && <Icon />} {g.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>
                </div>
              </Reveal>

              <Reveal delay={220}>
                <div className="fn-trust">
                  {TRUST_ITEMS.map((t) => (
                    <span key={t}>
                      <i>✓</i> {t}
                    </span>
                  ))}
                </div>
              </Reveal>

              {error && <p className="text-danger mt-2 mb-0">{error}</p>}
            </div>

            {/* CSS-only illustration on the right */}
            <div className="col-lg-5 d-none d-lg-block">
              <Reveal delay={160}>
                <div className="fn-hero-art">
                  <div className="fn-art-card fn-art-card-1">
                    <div className="fn-art-glass">
                      <div className="fn-art-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m3 10 9-7 9 7" />
                          <path d="M5 9v11h14V9" />
                          <path d="M9 20v-6h6v6" />
                        </svg>
                      </div>
                      <div>
                        <div className="fn-art-label">Sunrise PG</div>
                        <div className="fn-art-sub">2.1 km · Rs 7,200</div>
                      </div>
                    </div>
                  </div>
                  <div className="fn-art-card fn-art-card-2">
                    <div className="fn-art-glass">
                      <div className="fn-art-icon fn-art-icon-accent">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21h18" />
                          <path d="M5 21V7l7-5 7 5v14" />
                          <path d="M9 21v-6h6v6" />
                        </svg>
                      </div>
                      <div>
                        <div className="fn-art-label">Green Residency</div>
                        <div className="fn-art-sub">1 room left</div>
                      </div>
                    </div>
                  </div>
                  <div className="fn-art-card fn-art-card-3">
                    <div className="fn-art-glass">
                      <div className="fn-art-icon fn-art-icon-paid">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <path d="m9 11 3 3L22 4" />
                        </svg>
                      </div>
                      <div>
                        <div className="fn-art-label">Rent paid</div>
                        <div className="fn-art-sub">August · all clear</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Animated marquee of colleges ---------- */}
      <div className="fn-marquee">
        <div className="fn-marquee-track">
          {[...MARQUEE_COLLEGES, ...MARQUEE_COLLEGES].map((c, i) => (
            <span key={i}>
              <em>★</em> PGs near {c}
            </span>
          ))}
        </div>
      </div>

      <div className="container my-5">
        {/* ---------- The journey ---------- */}
        <section className="fn-journey">
          <Reveal>
            <h2 className="fn-section-title text-center fn-flourish">How MyNest works</h2>
            <p className="fn-section-sub text-center">
              From finding a PG to paying rent together — four simple steps
            </p>
          </Reveal>
          <div className="row g-4">
            {JOURNEY.map((s, i) => (
              <div className="col-md-6 col-lg-3" key={s.step}>
                <Reveal delay={i * 120}>
                  <div className="fn-journey-card">
                    <span className="fn-journey-num">{s.step}</span>
                    <h6>{s.title}</h6>
                    <p className="mb-0">{s.text}</p>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </section>

        {college && (
          <Reveal>
            <p className="text-muted mb-3">
              Showing PGs within <strong>{radius} km</strong> of{" "}
              <strong>{college.name}</strong>
            </p>
          </Reveal>
        )}

        {/* Results summary strip */}
        {!loading && pgs && (
          <Reveal>
            <div className="fn-rent-bar">
              <span className="fn-rent-label">
                {pgs.length} result{pgs.length !== 1 && "s"}
              </span>
              <span className="fn-result-chip">
                <FaRoute /> {radius} km
              </span>
              <span className="fn-result-chip">
                <FaMoneyBillWave />{" "}
                {RENT_FILTERS.find((f) => f.key === rentFilter)?.label}
              </span>
              {gender !== "any" && (
                <span className="fn-result-chip">
                  {gender === "male" ? <FaPerson /> : <FaPersonDress />}{" "}
                  {gender === "male" ? "Boys only" : "Girls only"}
                </span>
              )}
            </div>
          </Reveal>
        )}

        {/* Results first, map below */}
        {loading ? (
          <div className="row g-4">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : (
          pgs && (
            <>
              <Reveal>
                <h2 className="fn-section-title mb-3">
                  {pgs.length} PG{pgs.length !== 1 && "s"} found
                </h2>
              </Reveal>
              <div className="row g-4 mb-5">
                {pgs.map((pg, i) => (
                  <div className="col-md-6 col-lg-4" key={pg.id}>
                    <Reveal delay={i * 100}>
                      <Link to={`/pg/${pg.id}`} className="text-decoration-none">
                        <div className="card fn-pg-card h-100">
                          {pg.photo_url && (
                            <div className="fn-pg-img-wrap">
                              <img
                                src={pg.photo_url}
                                className="fn-pg-img"
                                alt={pg.name}
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start">
                              <h5 className="card-title mb-0 fn-pg-name">{pg.name}</h5>
                              <span className="fn-distance">{Number(pg.distance_km).toFixed(1)} km</span>
                            </div>
                            <p className="card-text text-muted small mb-2">
                              {pg.address}, {pg.city}
                            </p>
                            <div className="fn-fac-badges mb-2">
                              {splitFacilities(pg).map((f) => (
                                <span key={f} className="fn-fac-badge">
                                  <FacilityIcon name={f} /> {f}
                                </span>
                              ))}
                            </div>
                            <div className="d-flex justify-content-between align-items-end">
                              <p className="fn-price mb-0">
                                Rs {pg.monthly_rent} <span className="small text-muted">/month</span>
                              </p>
                              <div className="d-flex align-items-center gap-1">
                                {pg.gender === "male" ? (
                                  <span className="fn-gender-badge" title="Boys only"><FaPerson /> Boys</span>
                                ) : pg.gender === "female" ? (
                                  <span className="fn-gender-badge fn-gender-badge-f" title="Girls only"><FaPersonDress /> Girls</span>
                                ) : null}
                                <span className="fn-verified-badge">✓ Verified</span>
                              </div>
                            </div>
                            <span className="btn btn-primary btn-sm w-100 fn-view-btn mt-3">
                              View details
                            </span>
                          </div>
                        </div>
                      </Link>
                    </Reveal>
                  </div>
                ))}
              </div>

              <Reveal>
                <h2 className="fn-section-title mb-3">On the map</h2>
                <div className="mb-4">
                  <PGMap center={center} pgs={pgs} />
                </div>
              </Reveal>
            </>
          )
        )}
      </div>

      {/* ---------- Contact / report ---------- */}
      <section className="fn-contact">
        <div className="container">
          <Reveal>
            <h2 className="fn-section-title text-center fn-flourish">Got a question or a report?</h2>
            <p className="fn-section-sub text-center">
              Spotted something wrong on a listing, or want to reach the myNest team?
              We're one message away.
            </p>
          </Reveal>
          <div className="row g-4 justify-content-center mt-1">
            <div className="col-md-6 col-lg-4">
              <Reveal delay={60}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-mail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <h6>Email us</h6>
                  <p className="mb-2">For anything general — questions, feedback, suggestions.</p>
                  <a className="fw-semibold" href="mailto:hello@mynest.in">hello@mynest.in</a>
                </div>
              </Reveal>
            </div>
            <div className="col-md-6 col-lg-4">
              <Reveal delay={140}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-report">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <h6>Report a problem</h6>
                  <p className="mb-2">Wrong photos, fake rent, or a listing that doesn't exist.</p>
                  <a className="fw-semibold" href="mailto:report@mynest.in?subject=Listing%20report">report@mynest.in</a>
                </div>
              </Reveal>
            </div>
            <div className="col-md-6 col-lg-4">
              <Reveal delay={220}>
                <div className="fn-contact-card">
                  <span className="fn-contact-icon fn-contact-icon-wa">
                    <svg viewBox="0 0 32 32" fill="currentColor" width="22" height="22">
                      <path d="M16.004 3C9.383 3 4 8.383 4 15.004c0 2.117.554 4.188 1.607 6.012L4 29l8.118-1.585A11.94 11.94 0 0 0 16.004 29C22.625 29 28 23.617 28 16.996 28 10.383 22.625 3 16.004 3zm0 23.488c-1.887 0-3.738-.508-5.358-1.465l-.383-.229-4.816.942.943-4.698-.25-.391a9.93 9.93 0 0 1-1.521-5.277c0-5.496 4.473-9.969 9.973-9.969 5.492 0 9.969 4.473 9.969 9.969 0 5.496-4.477 9.969-9.973 9.969zm5.465-7.453c-.3-.148-1.765-.867-2.039-.965-.273-.102-.469-.148-.668.148-.198.297-.766.965-.94 1.164-.172.199-.344.223-.644.074-.3-.148-1.261-.465-2.398-1.48-.883-.785-1.477-1.758-1.653-2.055-.172-.297-.02-.46.132-.605.134-.133.3-.344.445-.516.148-.172.199-.297.301-.496.098-.199.05-.371-.025-.516-.074-.148-.668-1.61-.918-2.203-.242-.578-.485-.5-.668-.508l-.57-.009c-.199 0-.52.074-.793.371-.273.297-1.043 1.02-1.043 2.488s1.066 2.883 1.215 3.082c.148.199 2.098 3.203 5.082 4.492.711.305 1.262.488 1.695.621.711.223 1.355.191 1.867.117.57-.082 1.765-.719 2.012-1.414.25-.695.25-1.293.176-1.418-.074-.129-.273-.203-.57-.348z"/>
                    </svg>
                  </span>
                  <h6>WhatsApp</h6>
                  <p className="mb-2">Fastest reply for urgent issues — 9am to 9pm.</p>
                  <a className="fw-semibold" href="https://wa.me/919876500011" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
