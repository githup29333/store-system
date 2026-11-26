/* Hotel identity layer. Hotel code must come from the authenticated sbfenv my_status response. */
(function () {
  const themes = {
    EBR: {
      name: "EBREAZE HOTEL",
      bg: "#090a0c", card: "#151515", ink: "#f4f0e7", muted: "#b7ad9b",
      line: "#39342a", accent: "#c9a45c", accent2: "#e5c477",
      page: "#090a0c", hero: "#11100d", buttonText: "#17130b"
    },
    H2: {
      name: "ATLANTIS",
      bg: "#0b1422", card: "#142235", ink: "#edf3fb", muted: "#a7b7ca",
      line: "#30445b", accent: "#8ca9c8", accent2: "#c4d5e8",
      page: "#0b1422", hero: "#10243a", buttonText: "#0b1422"
    }
  };

  function applyHotelTheme(code) {
    const hotel = String(code || "").trim().toUpperCase();
    const theme = themes[hotel];
    if (!theme || !document.documentElement) return false;

    document.documentElement.dataset.hotel = hotel;
    document.documentElement.style.setProperty("--hotel-bg", theme.bg);
    document.documentElement.style.setProperty("--hotel-card", theme.card);
    document.documentElement.style.setProperty("--hotel-ink", theme.ink);
    document.documentElement.style.setProperty("--hotel-muted", theme.muted);
    document.documentElement.style.setProperty("--hotel-line", theme.line);
    document.documentElement.style.setProperty("--hotel-accent", theme.accent);
    document.documentElement.style.setProperty("--hotel-accent-2", theme.accent2);
    document.documentElement.style.setProperty("--hotel-hero", theme.hero);
    document.documentElement.style.setProperty("--hotel-button-text", theme.buttonText);

    let style = document.getElementById("hotelIdentityStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "hotelIdentityStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html[data-hotel] { color-scheme: dark; }
      html[data-hotel] body { background:var(--hotel-bg)!important; color:var(--hotel-ink)!important; }
      html[data-hotel] .panel, html[data-hotel] main, html[data-hotel] #login,
      html[data-hotel] section, html[data-hotel] .card {
        background:var(--hotel-card)!important; color:var(--hotel-ink)!important;
        border-color:var(--hotel-line)!important;
      }
      html[data-hotel] .hero, html[data-hotel] header {
        background:linear-gradient(120deg,var(--hotel-hero),var(--hotel-card))!important;
        color:var(--hotel-ink)!important; border-bottom:1px solid var(--hotel-accent);
      }
      html[data-hotel] h1, html[data-hotel] h2, html[data-hotel] h3,
      html[data-hotel] b, html[data-hotel] strong { color:var(--hotel-ink); }
      html[data-hotel] .hero h1, html[data-hotel] .hero b { color:var(--hotel-accent-2)!important; }
      html[data-hotel] button:not(.alt):not(.danger):not(.pick),
      html[data-hotel] .btn:not(.alt):not(.bad) {
        background:linear-gradient(120deg,var(--hotel-accent),var(--hotel-accent-2))!important;
        color:var(--hotel-button-text)!important; border:1px solid var(--hotel-accent)!important;
      }
      html[data-hotel] button.alt, html[data-hotel] .alt {
        background:transparent!important; color:var(--hotel-accent-2)!important;
        border:1px solid var(--hotel-accent)!important;
      }
      html[data-hotel] input, html[data-hotel] select, html[data-hotel] textarea {
        background:#0c1118!important; color:var(--hotel-ink)!important;
        border-color:var(--hotel-line)!important;
      }
      html[data-hotel] table, html[data-hotel] td, html[data-hotel] th,
      html[data-hotel] .item { border-color:var(--hotel-line)!important; }
      html[data-hotel] th { background:#1b2028!important; color:var(--hotel-accent-2)!important; }
      html[data-hotel] .muted, html[data-hotel] small { color:var(--hotel-muted)!important; }
      html[data-hotel] .pick { background:var(--hotel-card)!important; color:var(--hotel-ink)!important; }
      html[data-hotel] .pick:hover { background:#242a32!important; }
      html[data-hotel] .results, html[data-hotel] .panel { box-shadow:0 12px 34px #0005,0 0 0 1px color-mix(in srgb,var(--hotel-accent) 10%,transparent); }
      html[data-hotel] .item { border-bottom:1px solid var(--hotel-line)!important; }
      html[data-hotel] body {
        background:
          radial-gradient(ellipse at 12% 0%, color-mix(in srgb,var(--hotel-accent) 10%,transparent),transparent 38%),
          var(--hotel-bg)!important;
        color:var(--hotel-ink)!important;
      }
      html[data-hotel] header, html[data-hotel] .hero {
        background:linear-gradient(135deg,#11100e 0%,#1b1812 55%,#11100e 100%)!important;
        border:1px solid color-mix(in srgb,var(--hotel-accent) 38%,var(--hotel-line))!important;
        border-radius:16px!important;
        box-shadow:0 14px 38px #0008,0 0 24px color-mix(in srgb,var(--hotel-accent) 7%,transparent)!important;
      }
      html[data-hotel] nav, html[data-hotel] .toolbar, html[data-hotel] .actions,
      html[data-hotel] .row, html[data-hotel] .top {
        border-color:var(--hotel-line)!important;
      }
      html[data-hotel] .panel, html[data-hotel] .card, html[data-hotel] .shell,
      html[data-hotel] .login, html[data-hotel] .wrap, html[data-hotel] .box,
      html[data-hotel] .stat, html[data-hotel] .metric, html[data-hotel] .tile {
        background:linear-gradient(145deg,#181714,#111214)!important;
        color:var(--hotel-ink)!important;
        border:1px solid var(--hotel-line)!important;
        border-radius:15px!important;
        box-shadow:0 12px 32px #0006,0 0 0 1px color-mix(in srgb,var(--hotel-accent) 7%,transparent)!important;
      }
      html[data-hotel] button, html[data-hotel] .btn {
        border-radius:10px!important;
        transition:transform .16s ease,box-shadow .16s ease,background .16s ease!important;
      }
      html[data-hotel] button:not(:disabled):hover, html[data-hotel] .btn:not(:disabled):hover {
        transform:translateY(-1px);
        box-shadow:0 7px 20px color-mix(in srgb,var(--hotel-accent) 18%,transparent)!important;
      }
      html[data-hotel] button:disabled { opacity:.55; }
      html[data-hotel] input, html[data-hotel] select, html[data-hotel] textarea {
        border-radius:9px!important;
        box-shadow:inset 0 1px 2px #0005!important;
      }
      html[data-hotel] input:focus, html[data-hotel] select:focus, html[data-hotel] textarea:focus {
        outline:2px solid color-mix(in srgb,var(--hotel-accent) 55%,transparent)!important;
        border-color:var(--hotel-accent)!important;
      }
      html[data-hotel] table {
        border-collapse:separate!important;border-spacing:0!important;
        background:#121314!important;border:1px solid var(--hotel-line)!important;
        border-radius:12px!important;overflow:hidden;
      }
      html[data-hotel] th {
        background:linear-gradient(120deg,#282216,#1a1916)!important;
        color:var(--hotel-accent-2)!important;
        border-bottom:1px solid var(--hotel-accent)!important;
      }
      html[data-hotel] td { background:#141516!important;color:var(--hotel-ink)!important; }
      html[data-hotel] tr:nth-child(even) td { background:#191a1b!important; }
      html[data-hotel] a { color:var(--hotel-accent-2)!important; }
      html[data-hotel] .muted, html[data-hotel] small { color:var(--hotel-muted)!important; }
      html[data-hotel] .tag, html[data-hotel] .badge { border-color:var(--hotel-line)!important; }
      html[data-hotel] .danger, html[data-hotel] .bad { filter:saturate(.85); }
      html[data-hotel] ::selection { background:var(--hotel-accent)!important;color:#17130b!important; }
      html[data-hotel] #cursorGlow {
        background:radial-gradient(circle,color-mix(in srgb,var(--hotel-accent) 12%,transparent),transparent 70%)!important;
      }
      html[data-hotel] .success { color:#83d49a!important; }
    `;
    document.dispatchEvent(new CustomEvent("hotel-theme-changed", { detail: { code: hotel, name: theme.name } }));
    return true;
  }

  window.applyHotelTheme = applyHotelTheme;
  window.getHotelTheme = function (code) { return themes[String(code || "").toUpperCase()] || null; };
})();