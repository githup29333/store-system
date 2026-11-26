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

      /* Ebreaze complete luxury interface system */
      html[data-hotel="EBR"] {
        --hotel-bg:#090a0c; --hotel-card:#151515; --hotel-ink:#f4f0e7;
        --hotel-muted:#b7ad9b; --hotel-line:#39342a; --hotel-accent:#c9a45c;
        --hotel-accent-2:#efd18b; --hotel-hero:#11100d;
        --hotel-button-text:#17130b;
        font-family:"Tajawal",Tahoma,Arial,sans-serif;
      }
      html[data-hotel="EBR"] body {
        min-height:100vh;
        background:
          radial-gradient(ellipse at 85% -8%,rgba(201,164,92,.13),transparent 34%),
          radial-gradient(ellipse at 5% 48%,rgba(201,164,92,.045),transparent 38%),
          #090a0c!important;
        color:#f4f0e7!important;
        font-family:"Tajawal",Tahoma,Arial,sans-serif!important;
      }
      html[data-hotel="EBR"] body > header,
      html[data-hotel="EBR"] .hero,
      html[data-hotel="EBR"] header {
        background:linear-gradient(125deg,#0d0d0c 0%,#201b12 52%,#11100e 100%)!important;
        color:#f4f0e7!important;
        border:1px solid #69532e!important;
        border-radius:18px!important;
        box-shadow:0 16px 42px #0009,0 0 26px #c9a45c12!important;
      }
      html[data-hotel="EBR"] header h1,
      html[data-hotel="EBR"] .hero h1,
      html[data-hotel="EBR"] .hero h2,
      html[data-hotel="EBR"] .hero strong {
        color:#efd18b!important; letter-spacing:.15px;
      }
      html[data-hotel="EBR"] header small,
      html[data-hotel="EBR"] .hero p {color:#c8bda8!important}
      html[data-hotel="EBR"] main,
      html[data-hotel="EBR"] .shell,
      html[data-hotel="EBR"] .wrap {
        background:transparent!important;color:#f4f0e7!important;
      }
      html[data-hotel="EBR"] main > section:not([hidden]),
      html[data-hotel="EBR"] .panel,
      html[data-hotel="EBR"] .card,
      html[data-hotel="EBR"] .section,
      html[data-hotel="EBR"] #login,
      html[data-hotel="EBR"] .login,
      html[data-hotel="EBR"] .stat,
      html[data-hotel="EBR"] .kpi {
        background:linear-gradient(145deg,#1a1916 0%,#121314 100%)!important;
        color:#f4f0e7!important;
        border:1px solid #39342a!important;
        border-radius:16px!important;
        box-shadow:0 12px 34px #0007,0 0 0 1px #c9a45c0b!important;
      }
      html[data-hotel="EBR"] .section {padding:18px!important}
      html[data-hotel="EBR"] h1,
      html[data-hotel="EBR"] h2,
      html[data-hotel="EBR"] h3,
      html[data-hotel="EBR"] h4,
      html[data-hotel="EBR"] label,
      html[data-hotel="EBR"] b,
      html[data-hotel="EBR"] strong {color:#f1e7d3}
      html[data-hotel="EBR"] .section h2,
      html[data-hotel="EBR"] .panel h3 {color:#e5c477!important}
      html[data-hotel="EBR"] p,
      html[data-hotel="EBR"] .muted,
      html[data-hotel="EBR"] .stamp,
      html[data-hotel="EBR"] .footer,
      html[data-hotel="EBR"] .credit {color:#b7ad9b!important}
      html[data-hotel="EBR"] nav {
        max-width:1280px!important;
        gap:8px!important;
        padding:14px!important;
      }
      html[data-hotel="EBR"] nav button,
      html[data-hotel="EBR"] #sideNav button[data-t] {
        background:linear-gradient(145deg,#201e19,#151515)!important;
        color:#d8c9a8!important;
        border:1px solid #4a3d27!important;
        border-radius:11px!important;
        padding:10px 14px!important;
        box-shadow:none!important;
      }
      html[data-hotel="EBR"] nav button.on,
      html[data-hotel="EBR"] #sideNav button[data-t].on {
        background:linear-gradient(120deg,#c9a45c,#efd18b)!important;
        color:#17130b!important;
        border-color:#efd18b!important;
        box-shadow:0 5px 18px #c9a45c26!important;
      }
      html[data-hotel="EBR"] button,
      html[data-hotel="EBR"] .btn,
      html[data-hotel="EBR"] a.btn {
        font-family:inherit!important;
        border-radius:10px!important;
        font-weight:800!important;
        transition:transform .18s ease,box-shadow .18s ease,filter .18s ease!important;
      }
      html[data-hotel="EBR"] button:not(.alt):not(.danger):not(.pick):not(.ghost):not(:disabled),
      html[data-hotel="EBR"] .btn:not(.alt):not(.bad):not(.danger):not(.ghost):not(:disabled) {
        background:linear-gradient(120deg,#b88d45,#e5c477)!important;
        color:#17130b!important;
        border:1px solid #d7b66d!important;
        box-shadow:0 5px 15px #c9a45c20!important;
      }
      html[data-hotel="EBR"] button.alt,
      html[data-hotel="EBR"] .alt,
      html[data-hotel="EBR"] button.ghost,
      html[data-hotel="EBR"] .ghost {
        background:#1b1a17!important;color:#e5c477!important;
        border:1px solid #705a32!important;
      }
      html[data-hotel="EBR"] button.danger,
      html[data-hotel="EBR"] .danger,
      html[data-hotel="EBR"] .bad {
        background:#492322!important;color:#ffb8ad!important;border:1px solid #80413b!important;
      }
      html[data-hotel="EBR"] button:not(:disabled):hover,
      html[data-hotel="EBR"] .btn:not(:disabled):hover {
        transform:translateY(-2px)!important;
        box-shadow:0 9px 22px #c9a45c32!important;
        filter:brightness(1.06);
      }
      html[data-hotel="EBR"] button:disabled {opacity:.48!important;cursor:not-allowed!important}
      html[data-hotel="EBR"] input,
      html[data-hotel="EBR"] select,
      html[data-hotel="EBR"] textarea {
        background:#0d0e10!important;color:#f4f0e7!important;
        border:1px solid #48402f!important;border-radius:10px!important;
        padding:10px 12px!important;
      }
      html[data-hotel="EBR"] input::placeholder,
      html[data-hotel="EBR"] textarea::placeholder {color:#928875!important}
      html[data-hotel="EBR"] input:focus,
      html[data-hotel="EBR"] select:focus,
      html[data-hotel="EBR"] textarea:focus {
        outline:0!important;border-color:#c9a45c!important;
        box-shadow:0 0 0 3px #c9a45c25!important;
      }
      html[data-hotel="EBR"] table {
        width:100%;border-collapse:separate!important;border-spacing:0!important;
        overflow:hidden;border:1px solid #39342a!important;border-radius:13px!important;
        background:#121314!important;
      }
      html[data-hotel="EBR"] th {
        background:linear-gradient(120deg,#292318,#1b1915)!important;
        color:#efd18b!important;border-bottom:1px solid #806536!important;
        font-weight:800!important;
      }
      html[data-hotel="EBR"] td {
        background:#141516!important;color:#eee6d8!important;
        border-color:#302c24!important;
      }
      html[data-hotel="EBR"] tr:nth-child(even) td {background:#191a1b!important}
      html[data-hotel="EBR"] tbody tr:hover td {background:#242119!important}
      html[data-hotel="EBR"] .item,
      html[data-hotel="EBR"] .q,
      html[data-hotel="EBR"] .row,
      html[data-hotel="EBR"] .toolbar,
      html[data-hotel="EBR"] .tools {border-color:#39342a!important}
      html[data-hotel="EBR"] .item {padding:11px 8px!important;border-bottom:1px solid #39342a!important}
      html[data-hotel="EBR"] .results,
      html[data-hotel="EBR"] .history,
      html[data-hotel="EBR"] .tablewrap,
      html[data-hotel="EBR"] .tableWrap,
      html[data-hotel="EBR"] .wrap {border-color:#39342a!important}
      html[data-hotel="EBR"] .pick {
        background:#171817!important;color:#eee6d8!important;
        border-bottom:1px solid #39342a!important;
      }
      html[data-hotel="EBR"] .pick:hover {background:#292319!important}
      html[data-hotel="EBR"] .notice,
      html[data-hotel="EBR"] .st {
        background:#2b2418!important;color:#ead5a5!important;
        border:1px solid #6b542f!important;border-radius:12px!important;
      }
      html[data-hotel="EBR"] .tag,
      html[data-hotel="EBR"] .status,
      html[data-hotel="EBR"] .badge {
        border:1px solid #69532e!important;border-radius:30px!important;
      }
      html[data-hotel="EBR"] .track {background:#302a20!important}
      html[data-hotel="EBR"] .fill,
      html[data-hotel="EBR"] .bar i {
        background:linear-gradient(90deg,#a9823d,#efd18b)!important;
      }
      html[data-hotel="EBR"] .kpi strong,
      html[data-hotel="EBR"] .kpi b,
      html[data-hotel="EBR"] .stat b,
      html[data-hotel="EBR"] .count {color:#e5c477!important}
      html[data-hotel="EBR"] .login input,
      html[data-hotel="EBR"] #login input {width:100%;margin:8px 0 12px!important}
      html[data-hotel="EBR"] #login h2,
      html[data-hotel="EBR"] .login h2 {color:#efd18b!important}
      html[data-hotel="EBR"] #login:before {content:"EBREAZE";width:auto;height:auto;padding:12px 16px;display:inline-flex;letter-spacing:3px;font-size:13px;background:#c9a45c;color:#17130b}
      html[data-hotel="EBR"] .brand {
        background:linear-gradient(145deg,#c9a45c,#efd18b)!important;
        color:#17130b!important;border:1px solid #efd18b!important;
      }
      html[data-hotel="EBR"] #modal,
      html[data-hotel="EBR"] #navShade {backdrop-filter:blur(7px)}
      html[data-hotel="EBR"] #modal>div,
      html[data-hotel="EBR"] #sideNav {
        background:#151515!important;color:#f4f0e7!important;
        border:1px solid #69532e!important;box-shadow:0 22px 70px #000b!important;
      }
      html[data-hotel="EBR"] #toast,
      html[data-hotel="EBR"] #systemNotice {
        background:#201b12!important;color:#f4f0e7!important;
        border:1px solid #806536!important;border-inline-start:4px solid #c9a45c!important;
      }
      html[data-hotel="EBR"] #cursorGlow {
        background:radial-gradient(circle,rgba(201,164,92,.17),rgba(201,164,92,.06) 36%,transparent 70%)!important;
      }
      @media(max-width:700px) {
        html[data-hotel="EBR"] body {font-size:14px}
        html[data-hotel="EBR"] .panel,
        html[data-hotel="EBR"] .section {padding:13px!important;border-radius:13px!important}
        html[data-hotel="EBR"] .hero {padding:17px!important}
        html[data-hotel="EBR"] nav button {flex:1 1 42%;padding:9px!important}
      }
    `;
    document.dispatchEvent(new CustomEvent("hotel-theme-changed", { detail: { code: hotel, name: theme.name } }));
    return true;
  }

  window.applyHotelTheme = applyHotelTheme;
  window.getHotelTheme = function (code) { return themes[String(code || "").toUpperCase()] || null; };
})();