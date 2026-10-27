(() => {
  const url = window.WEARS_SUPABASE_URL;
  const key = window.WEARS_SUPABASE_ANON_KEY;
  const preferred = ["artists", "outfits", "items", "archives", "drip_news"];
  const fallbackTables = ["artists", "outfits", "items", "archives", "drip_news", "comments"];
  const REGIONS = ["ALL", "USA", "TR", "EU", "CANADA", "ASIA", "AFRICA"];
  const COUNTRIES = [
    "UNITED STATES", "CANADA", "TÜRKİYE", "UNITED KINGDOM", "FRANCE", "GERMANY",
    "ITALY", "SPAIN", "NETHERLANDS", "POLAND", "PORTUGAL", "UKRAINE", "JAPAN",
    "SOUTH KOREA", "CHINA", "NIGERIA", "BARBADOS", "AUSTRALIA",
  ];
  const MAX_CARDS = 3;
  const MAX_PHOTOS = 3;
  const MAX_NEWS_PHOTOS = 5;
  const NEWS_CATS = ["CULTURE", "RELEASE", "ARCHIVE", "STREET", "MUSIC & FIT"];
  const NEWS_OPTIONAL = [
    "dek", "body", "source", "image_url", "image_urls",
    "product_name", "release_date", "buy_url", "buy_note", "sku", "category",
  ];
  const AVAIL = [
    { id: "in_stock", label: "IN STOCK" },
    { id: "sold_out", label: "SOLD OUT" },
    { id: "exclusive", label: "EXCLUSIVE" },
    { id: "friends_family", label: "FRIENDS & FAMILY" },
  ];

  const sb = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "twad-studio",
    },
  });

  const gate = document.getElementById("gate");
  const desk = document.getElementById("desk");
  const deskTables = document.getElementById("desk-tables");
  const gateErr = document.getElementById("gate-err");
  const deskMsg = document.getElementById("desk-msg");
  const tablesEl = document.getElementById("tables");
  const gridEl = document.getElementById("grid");
  const whoEl = document.getElementById("who");
  const tableNameEl = document.getElementById("table-name");
  const reloadBtn = document.getElementById("reload");
  const newRowBtn = document.getElementById("new-row");
  const insertBox = document.getElementById("insert");
  const insertJson = document.getElementById("insert-json");
  const insertUrls = document.getElementById("insert-urls");
  const insertUrlRows = document.getElementById("insert-url-rows");
  const snackEl = document.getElementById("snack");
  const backBtn = document.getElementById("back");

  let table = "";
  let rows = [];
  let columns = [];
  let artists = [];
  let regionFilter = "ALL";
  let selected = null;
  let editingId = "";
  let screen = "pick";
  let mode = "fit";
  let ppBlob = null;
  let ppPreview = "";
  let photos = [];
  let photoSlide = 0;
  let photoPick = -1;
  let photoScrollerBound = false;
  let cardIndex = 0;
  let cards = emptyCards();
  let snackTimer = 0;
  let editingOutfit = null;
  let artistPosts = [];
  let itemsByOutfit = {};
  let newsRows = [];
  let prRows = [];
  let memberRows = [];
  let memberFilter = "ALL";
  let memberBusy = "";
  const MEMBER_GATES = ["ALL", "PREMIUM", "HOUSE", "APPLE", "GOOGLE"];
  let statsRows = [];
  let editingNews = null;
  let newsPhotos = [];
  let newsSlide = 0;
  let newsPick = -1;
  let newsScrollerBound = false;
  let newsCat = "CULTURE";
  let archiveRows = [];
  let editingArchive = null;
  let archivePhotos = [];
  let archiveSlide = 0;
  let archivePick = -1;
  let archiveScrollerBound = false;
  const ARCHIVE_OPTIONAL = [
    "artist_id", "artist_name", "artist", "name", "year", "image_urls", "tag", "title", "description",
  ];

  function emptyCard() {
    return {
      id: "",
      brand: "",
      title: "",
      color: "",
      price: "",
      imageBlob: null,
      imagePreview: "",
      imageUrl: "",
      listings: [{ store: "", url: "", price: "" }],
      availability: "in_stock",
    };
  }
  function emptyCards() {
    return [emptyCard(), emptyCard(), emptyCard()];
  }

  function snack(msg, bad) {
    snackEl.textContent = msg || "";
    snackEl.classList.toggle("bad", !!bad);
    snackEl.classList.add("on");
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => snackEl.classList.remove("on"), 2800);
  }

  function showGate(msg) {
    gate.classList.add("on");
    desk.classList.remove("on");
    deskTables.classList.remove("on");
    gateErr.textContent = msg || "";
  }

  function showDesk() {
    gate.classList.remove("on");
    desk.classList.add("on");
    deskTables.classList.remove("on");
    gateErr.textContent = "";
  }

  function showTablesView() {
    desk.classList.remove("on");
    deskTables.classList.add("on");
  }

  function setDeskMsg(msg, kind) {
    deskMsg.className = kind === "err" ? "err" : kind === "ok" ? "ok" : "muted";
    deskMsg.textContent = msg || "";
  }

  function showScreen(name) {
    screen = name;
    document.querySelectorAll("#desk .screen").forEach((el) => {
      el.classList.toggle("hidden", el.id !== `screen-${name}`);
    });
    backBtn.style.visibility = name === "pick" ? "hidden" : "visible";
  }

  const CHIP_REGIONS = new Set(["USA", "TR", "EU", "CANADA", "ASIA", "AFRICA", "ALL"]);
  const SEED_STARS = [
    ["NAV", "CANADA", "CANADA"],
    ["DRAKE", "CANADA", "CANADA"],
    ["RIHANNA", "BARBADOS", "ALL"],
    ["MOTIVE", "TÜRKİYE", "TR"],
    ["LIL ZEY", "TÜRKİYE", "TR"],
    ["KHONTKAR", "TÜRKİYE", "TR"],
    ["BEGE", "TÜRKİYE", "TR"],
    ["YUNG OUZO", "TÜRKİYE", "TR"],
    ["YUNG CIHAD", "TÜRKİYE", "TR"],
    ["UZI", "TÜRKİYE", "TR"],
    ["EZHEL", "TÜRKİYE", "TR"],
    ["CENTRAL CEE", "UNITED KINGDOM", "EU"],
    ["21 SAVAGE", "UNITED KINGDOM", "EU"],
    ["SKEPTA", "UNITED KINGDOM", "EU"],
    ["LANCEY FOUX", "UNITED KINGDOM", "EU"],
    ["JACKSON WANG", "CHINA", "ASIA"],
    ["NIGO", "JAPAN", "ASIA"],
    ["VERDY", "JAPAN", "ASIA"],
    ["LITHE", "AUSTRALIA", "ALL"],
    ["REMA", "NIGERIA", "AFRICA"],
  ];

  function foldName(name) {
    return (name || "").toUpperCase().replaceAll("İ", "I").replace(/I\u0307/g, "I").replace(/[^A-Z0-9]/g, "");
  }

  const SEED_BY_KEY = Object.fromEntries(SEED_STARS.map(([name, country, region]) => [foldName(name), { country, region }]));

  function countryClearlyUs(country) {
    const c = (country || "").toUpperCase().replaceAll("İ", "I").trim();
    if (!c) return false;
    if (c === "US" || c === "USA" || c === "U.S" || c === "U.S.A") return true;
    return c.includes("UNITED STATES");
  }

  function chipRegion(raw) {
    const r = (raw || "").trim().toUpperCase().replaceAll("İ", "I");
    return CHIP_REGIONS.has(r) ? r : "";
  }

  function regionForCountry(country) {
    const c = (country || "").toUpperCase().replace(/İ/g, "I").replace(/I\u0307/g, "I").trim();
    if (!c) return "";
    if (c === "TR" || c.includes("TURK") || c.includes("TURKIYE")) return "TR";
    if (
      c === "EU" || c === "UK" || c === "GB" ||
      c.includes("UNITED KINGDOM") || c.includes("ENGLAND") || c.includes("BRITAIN") ||
      c.includes("SCOTLAND") || c.includes("WALES") || c.includes("IRELAND") ||
      c.includes("FRANCE") || c.includes("GERMANY") || c.includes("ITALY") ||
      c.includes("SPAIN") || c.includes("NETHERLAND") || c.includes("SWEDEN") ||
      c.includes("NORWAY") || c.includes("DENMARK") || c.includes("POLAND") ||
      c.includes("BELGIUM") || c.includes("AUSTRIA") || c.includes("SWITZ") ||
      c.includes("PORTUGAL") || c.includes("GREECE") || c.includes("UKRAINE") ||
      c.includes("EUROPE")
    ) return "EU";
    if (c.includes("CANADA")) return "CANADA";
    if (c.includes("NIGERIA") || c.includes("GHANA") || c.includes("AFRICA")) return "AFRICA";
    if (c.includes("JAPAN") || c.includes("CHINA") || c.includes("KOREA") || c.includes("HONG KONG") || c.includes("TAIWAN") || c.includes("ASIA")) return "ASIA";
    if (c.includes("BARBADOS") || c.includes("JAMAICA") || c.includes("AUSTRALIA")) return "ALL";
    if (countryClearlyUs(c)) return "USA";
    return "";
  }

  function placeArtist(row) {
    const name = (row.name || "").toUpperCase();
    const seed = SEED_BY_KEY[foldName(name)];
    let country = (row.country || row.nation || "").toUpperCase().trim();
    let region = chipRegion(row.region);
    if (!region) region = regionForCountry(country);
    if (seed) {
      const seedIsUs = seed.region === "USA";
      const dbIsUs = countryClearlyUs(country) || region === "USA";
      if (!country || !region || (!seedIsUs && dbIsUs)) {
        if (!country || (!seedIsUs && dbIsUs)) country = seed.country;
        region = seed.region;
      }
    }
    if (!region) region = "ALL";
    if (!country) {
      country = region === "TR" ? "TÜRKİYE"
        : region === "EU" ? "UNITED KINGDOM"
        : region === "USA" ? "UNITED STATES"
        : region === "CANADA" ? "CANADA"
        : region === "ASIA" ? "ASIA"
        : region === "AFRICA" ? "NIGERIA"
        : "";
    }
    const origCountry = (row.country || "").toUpperCase().trim();
    const origRegion = chipRegion(row.region);
    return {
      ...row,
      name,
      country,
      region,
      _stamp: Boolean(row.id) && (country !== origCountry || region !== origRegion),
    };
  }

  function artistMark(name) {
    const parts = (name || "").replace(/\$/g, "").split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  }

  function normalizeHref(raw) {
    const s = (raw || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s;
  }

  function igHandle(raw) {
    return (raw || "").trim().replace(/^@/, "").replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").split(/[/?#]/)[0];
  }

  function parsePrice(raw) {
    const n = Number(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function slug(s) {
    return (s || "x").toUpperCase().replaceAll("İ", "I").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
  }

  async function currentUser() {
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) throw sessionErr;
    return sessionData.session?.user || null;
  }

  async function mintFromAccess() {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    const text = await res.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`SESSION ${res.status}. Deploy is not serving /api/session.`);
    }
    if (!res.ok) {
      const err = new Error(body.error || `SESSION ${res.status}`);
      err.code = body.code || body.error;
      throw err;
    }
    const { error } = await sb.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (error) throw error;
  }

  function showVault() {
    const form = document.getElementById("gate-vault");
    const copy = document.getElementById("gate-copy");
    if (copy) copy.textContent = "Archive key";
    if (form) form.classList.remove("hidden");
    showGate("");
  }

  async function enterStudio() {
    await mintFromAccess();
    const user = await currentUser();
    if (!user) throw new Error("NO SESSION.");
    const form = document.getElementById("gate-vault");
    if (form) form.classList.add("hidden");
    await bootDesk(user);
  }

  async function loadImageFile(file) {
    if (!file) throw new Error("NO PHOTO.");
    if (file.size < 8000) throw new Error("PHOTO TOO THIN. USE THE INSTAGRAM FILE, NOT A SCREENSHOT CROP.");
    if (file.size > 20 * 1024 * 1024) throw new Error("PHOTO OVER 20MB.");
    const href = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("UNREADABLE PHOTO. USE JPG / PNG / WEBP."));
        el.src = href;
      });
      return img;
    } finally {
      URL.revokeObjectURL(href);
    }
  }

  async function toJpeg(img, spec) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const short = Math.min(w, h);
    if (short < spec.minShort) {
      throw new Error(`PHOTO TOO SMALL. ${w}×${h}. NEED ${spec.minShort}PX+ ON THE SHORT SIDE.`);
    }
    let sx = 0, sy = 0, sw = w, sh = h;
    if (spec.square) {
      const s = Math.min(w, h);
      sx = Math.floor((w - s) / 2);
      sy = Math.floor((h - s) / 2);
      sw = s;
      sh = s;
    }
    let dw = sw;
    let dh = sh;
    const long = Math.max(dw, dh);
    if (long > spec.maxEdge) {
      const k = spec.maxEdge / long;
      dw = Math.round(dw * k);
      dh = Math.round(dh * k);
    }
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", spec.quality));
    if (!blob) throw new Error("PHOTO FAILED.");
    return blob;
  }

  const HD = {
    pp: { minShort: 640, maxEdge: 1080, square: true, quality: 0.92 },
    fit: { minShort: 1080, maxEdge: 2560, square: false, quality: 0.96 },
    story: { minShort: 1080, maxEdge: 2560, square: false, quality: 0.96 },
    item: { minShort: 700, maxEdge: 2200, square: false, quality: 0.96 },
    news: { minShort: 1080, maxEdge: 4096, square: false, quality: 0.97, maxBytes: 12 * 1024 * 1024 },
  };

  function isRasterFile(file) {
    const type = (file.type || "").toLowerCase();
    const name = file.name || "";
    return type.includes("jpeg") || type.includes("jpg") || type.includes("png") || type.includes("webp")
      || /\.(jpe?g|png|webp)$/i.test(name);
  }

  function photoExt(blob) {
    const t = (blob.type || "").toLowerCase();
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    return "jpg";
  }

  async function pickHd(file, kind) {
    const img = await loadImageFile(file);
    const spec = HD[kind];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const short = Math.min(w, h);
    const long = Math.max(w, h);
    if (short < spec.minShort) {
      throw new Error(`PHOTO TOO SMALL. ${w}×${h}. NEED ${spec.minShort}PX+ ON THE SHORT SIDE.`);
    }
    const maxBytes = spec.maxBytes || 8 * 1024 * 1024;
    if (!spec.square && isRasterFile(file) && long <= spec.maxEdge && file.size <= maxBytes) {
      return file;
    }
    return toJpeg(img, spec);
  }

  function previewUrl(blob) {
    return blob ? URL.createObjectURL(blob) : "";
  }

  async function uploadJpeg(path, blob) {
    const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": blob.type || "image/jpeg" },
      body: blob,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `UPLOAD ${res.status}`);
    if (!body.publicUrl) throw new Error("UPLOAD HAD NO URL.");
    return body.publicUrl;
  }

  function forgetPreview(href) {
    if (href && String(href).startsWith("blob:")) URL.revokeObjectURL(href);
  }

  async function restList(tableName, filter) {
    const out = await restWrite({ op: "list", table: tableName, filter });
    return Array.isArray(out.rows) ? out.rows : [];
  }

  async function loadFiltered(tableName, filter) {
    try {
      return await restList(tableName, filter);
    } catch {
      let q = sb.from(tableName).select("*").limit(100);
      if (filter.artist_id) q = q.eq("artist_id", filter.artist_id);
      else if (filter.outfit_id) q = q.eq("outfit_id", filter.outfit_id);
      else if (filter.archive_id) q = q.eq("archive_id", filter.archive_id);
      else if (Array.isArray(filter.outfit_ids) && filter.outfit_ids.length) q = q.in("outfit_id", filter.outfit_ids);
      else return [];
      const { data, error } = await q;
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    }
  }

  async function restWrite(payload) {
    const res = await fetch("/api/rest", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `WRITE ${res.status}`);
    return body;
  }

  function omitBlank(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v == null) continue;
      if (typeof v === "string" && !v.trim()) continue;
      if (Array.isArray(v) && !v.length) continue;
      out[k] = v;
    }
    return out;
  }

  function optionalKeyInError(msg, key) {
    const m = String(msg || "").toLowerCase();
    const k = String(key || "").toLowerCase();
    if (!k) return false;
    return m.includes(`"${k}"`) || m.includes(`'${k}'`) || m.includes(` ${k} `) || m.includes(`.${k}`) || m.endsWith(k);
  }

  async function insertLoose(tableName, payload, optionalKeys) {
    let row = omitBlank({ ...payload });
    let keys = optionalKeys.slice();
    for (;;) {
      try {
        const out = await restWrite({ op: "insert", table: tableName, row });
        return out.row;
      } catch (error) {
        const msg = error.message || "";
        const hit = keys.find((k) => optionalKeyInError(msg, k) || msg.toLowerCase().includes(k.toLowerCase()));
        if (!hit) throw error;
        delete row[hit];
        keys = keys.filter((k) => k !== hit);
      }
    }
  }

  function normalizeAvail(raw) {
    const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!s || s === "in" || s === "in_stock" || s === "available" || s === "stock") return "in_stock";
    if (s === "out" || s === "sold" || s === "sold_out" || s === "soldout" || s === "out_of_stock" || s === "oos") return "sold_out";
    if (s === "exclusive") return "exclusive";
    if (s === "friends" || s === "friends_family" || s === "friends_and_family" || s === "fnf" || s === "f&f" || s === "f_and_f") {
      return "friends_family";
    }
    return "in_stock";
  }

  function availLabel(id) {
    return AVAIL.find((o) => o.id === id)?.label || "";
  }

  function storeListings(raw) {
    return asListingArray(raw).filter((r) => r && r._tw !== "avail");
  }

  function availabilityFromItem(it) {
    if (!it) return "in_stock";
    const fromCol = normalizeAvail(it.availability);
    const meta = asListingArray(it.listings).find((r) => r && r._tw === "avail");
    const fromList = normalizeAvail(meta?.availability);
    if (fromCol !== "in_stock") return fromCol;
    if (fromList !== "in_stock") return fromList;
    return "in_stock";
  }

  function stampAvailability(listings, availability) {
    const rows = storeListings(listings);
    const a = normalizeAvail(availability);
    if (a !== "in_stock") rows.push({ _tw: "avail", availability: a });
    return rows;
  }

  function listingsFrom(root) {
    const out = [];
    root.querySelectorAll(".listing").forEach((row) => {
      const store = (row.querySelector("[data-ls='store']")?.value || "").trim();
      const href = normalizeHref(row.querySelector("[data-ls='url']")?.value || "");
      const price = (row.querySelector("[data-ls='price']")?.value || "").trim();
      if (!store && !href && !price) return;
      const item = {};
      if (store) item.store = store.toUpperCase();
      if (href) item.url = href;
      if (price) item.price = price;
      out.push(item);
    });
    return out;
  }

  function addListingRow(root, listing) {
    const row = document.createElement("div");
    row.className = "listing";
    row.innerHTML = `
      <input data-ls="store" placeholder="STORE" value="">
      <input data-ls="url" placeholder="https://">
      <input data-ls="price" placeholder="PRICE">
      <button type="button" class="btn sq">X</button>
    `;
    row.querySelector("[data-ls='store']").value = listing?.store || "";
    row.querySelector("[data-ls='url']").value = listing?.url || "";
    row.querySelector("[data-ls='price']").value = listing?.price || "";
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
      if (!root.querySelector(".listing")) addListingRow(root, null);
    });
    root.appendChild(row);
  }

  function fillListings(root, list) {
    root.replaceChildren();
    const rowsList = storeListings(list);
    (rowsList.length ? rowsList : [null]).forEach((item) => addListingRow(root, item));
  }

  function paintAvatar(el, artist, size) {
    el.replaceChildren();
    if (size) {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
    }
    const src = artist?.image_url || artist?.imageUrl;
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = artist.name || "";
      el.appendChild(img);
      return;
    }
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = artistMark(artist?.name || "");
    el.appendChild(mark);
  }

  function filteredArtists() {
    return artists
      .filter((a) => regionFilter === "ALL" || (a.region || "").toUpperCase() === regionFilter)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  function renderChips() {
    const host = document.getElementById("region-chips");
    host.replaceChildren();
    REGIONS.forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (r === regionFilter ? " on" : "");
      b.textContent = r;
      b.addEventListener("click", () => {
        regionFilter = r;
        renderChips();
        renderGrid();
      });
      host.appendChild(b);
    });
  }

  function renderGrid() {
    const host = document.getElementById("artist-grid");
    const list = filteredArtists();
    document.getElementById("pick-msg").textContent = list.length ? `${list.length} STAR(S).` : "NO STARS IN THIS REGION.";
    host.replaceChildren();
    list.forEach((artist) => {
      const cell = document.createElement("div");
      cell.className = "star-cell";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star";
      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, artist);
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = artist.name || "";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<span>${artist.country || ""}</span><span>→</span>`;
      b.append(av, name, meta);
      b.addEventListener("click", () => openArtist(artist));
      const ed = document.createElement("button");
      ed.type = "button";
      ed.className = "star-edit";
      ed.textContent = "Edit";
      ed.addEventListener("click", (ev) => {
        ev.preventDefault();
        openStarForm(artist);
      });
      cell.append(b, ed);
      host.appendChild(cell);
    });
  }

  async function stampArtistPlaces(list) {
    for (const artist of list) {
      if (!artist._stamp || !artist.id) continue;
      const patch = { country: artist.country, region: artist.region };
      try {
        await restWrite({ op: "update", table: "artists", id: artist.id, patch });
      } catch {
        try {
          await restWrite({ op: "update", table: "artists", id: artist.id, patch: { country: artist.country } });
        } catch {}
      }
      artist._stamp = false;
    }
  }

  async function loadArtists() {
    const { data, error } = await sb.from("artists").select("*").limit(500);
    if (error) {
      snack(error.message, true);
      artists = [];
    } else {
      artists = (data || []).map(placeArtist);
    }
    renderChips();
    renderGrid();
    stampArtistPlaces(artists);
  }

  function openArtist(artist) {
    selected = artist;
    document.getElementById("artist-name").textContent = artist.name || "";
    document.getElementById("artist-country").textContent = artist.country || "";
    paintAvatar(document.getElementById("artist-av"), artist, 96);
    showScreen("artist");
    loadArtistPosts();
  }

  function postStamp(row) {
    const raw = row.date || row.created_at || row.updated_at || "";
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }

  function postWhen(row) {
    const t = postStamp(row);
    if (!t) return "";
    const d = new Date(t);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function isStoryPost(row) {
    return String(row.title || "").toUpperCase().includes("STORY");
  }

  function postKind(row) {
    const vault = row.is_vault;
    if (vault === true || vault === 1 || vault === "t" || vault === "1" || String(vault).toLowerCase() === "true") return "VAULT";
    return isStoryPost(row) ? "STORY" : "FIT CHECK";
  }

  function formatItemPrice(raw) {
    if (raw == null || raw === "") return "";
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return `$${n}`;
    return String(raw);
  }

  function cardsFromItems(list) {
    const next = emptyCards();
    const rows = (list || []).slice().sort((a, b) => postStamp(a) - postStamp(b) || String(a.id).localeCompare(String(b.id)));
    for (let i = 0; i < MAX_CARDS; i++) {
      const it = rows[i];
      if (!it) continue;
      const listings = storeListings(it.listings).map((l) => ({
        store: l.store || l.name || "",
        url: l.url || l.href || "",
        price: l.price ? String(l.price) : "",
      }));
      const src = it.image_url || it.imageUrl || "";
      next[i] = {
        id: it.id || "",
        brand: String(it.brand || "").toUpperCase(),
        title: String(it.title || it.name || "").toUpperCase(),
        color: String(it.color || "").toUpperCase(),
        price: formatItemPrice(it.price),
        imageBlob: null,
        imagePreview: src,
        imageUrl: src,
        listings: listings.length ? listings : [{ store: "", url: "", price: "" }],
        availability: availabilityFromItem(it),
      };
    }
    return next;
  }

  async function loadArtistPosts() {
    const host = document.getElementById("artist-posts");
    const msg = document.getElementById("posts-msg");
    host.replaceChildren();
    artistPosts = [];
    itemsByOutfit = {};
    if (!selected?.id) {
      msg.textContent = "";
      return;
    }
    msg.textContent = "LOADING…";
    try {
      const outfits = await loadFiltered("outfits", { artist_id: selected.id });
      outfits.sort((a, b) => postStamp(b) - postStamp(a));
      artistPosts = outfits.filter((o) => postKind(o) !== "VAULT");
      const ids = outfits.map((o) => o.id).filter(Boolean);
      if (ids.length) {
        const items = await loadFiltered("items", { outfit_ids: ids });
        for (const item of items) {
          const oid = item.outfit_id || item.outfitId;
          if (!oid) continue;
          if (!itemsByOutfit[oid]) itemsByOutfit[oid] = [];
          itemsByOutfit[oid].push(item);
        }
      }
      renderArtistPosts();
    } catch (err) {
      msg.textContent = err.message || "POSTS FAILED.";
    }
  }

  function renderArtistPosts() {
    const host = document.getElementById("artist-posts");
    const msg = document.getElementById("posts-msg");
    host.replaceChildren();
    if (!artistPosts.length) {
      msg.textContent = "NO POSTS YET.";
      return;
    }
    msg.textContent = `${artistPosts.length} POST(S).`;
    artistPosts.forEach((post) => {
      const row = document.createElement("div");
      row.className = "post-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "post" + (isStoryPost(post) ? " story" : "");
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const src = post.image_url || post.imageUrl || "";
      if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        thumb.appendChild(img);
      }
      const meta = document.createElement("div");
      const kind = document.createElement("div");
      kind.className = "kind";
      kind.textContent = postKind(post);
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = postWhen(post);
      const n = document.createElement("div");
      n.className = "n";
      const count = (itemsByOutfit[post.id] || []).length;
      n.textContent = isStoryPost(post)
        ? "STORY"
        : `${count} CARD${count === 1 ? "" : "S"} · ${photosFromOutfit(post).length} PHOTO`;
      meta.append(kind, when, n);
      const edit = document.createElement("span");
      edit.className = "edit";
      edit.textContent = "Edit";
      btn.append(thumb, meta, edit);
      btn.addEventListener("click", () => openPost(post));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "post-del";
      del.setAttribute("aria-label", "Delete post");
      del.textContent = "X";
      del.addEventListener("click", (ev) => {
        ev.preventDefault();
        deletePost(post);
      });
      row.append(btn, del);
      host.appendChild(row);
    });
  }

  function photosFromOutfit(row) {
    const cover = row?.image_url || row?.imageUrl || "";
    const raw = row?.image_urls ?? row?.imageUrls;
    let extra = [];
    if (Array.isArray(raw)) extra = raw;
    else if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        extra = Array.isArray(parsed) ? parsed : [];
      } catch {
        extra = [];
      }
    }
    const out = [];
    const add = (v) => {
      const s = String(v || "").trim();
      if (!s || s === "null" || out.includes(s) || out.length >= MAX_PHOTOS) return;
      out.push(s);
    };
    extra.forEach(add);
    if (cover && !out.includes(cover)) out.unshift(cover);
    return out.slice(0, MAX_PHOTOS);
  }

  function photoCap() {
    return mode === "story" ? 1 : MAX_PHOTOS;
  }

  function bindPhotoScroller() {
    if (photoScrollerBound) return;
    photoScrollerBound = true;
    const scroller = document.getElementById("photo-scroller");
    scroller.addEventListener("scroll", () => {
      const w = scroller.clientWidth || 1;
      photoSlide = Math.round(scroller.scrollLeft / w);
      paintPhotoDots();
    }, { passive: true });
  }

  function paintPhotoDots() {
    const dots = document.getElementById("photo-dots");
    const cap = photoCap();
    const total = photos.length < cap ? photos.length + 1 : Math.max(photos.length, 1);
    dots.replaceChildren();
    if (total <= 1) {
      dots.classList.add("hidden");
      return;
    }
    dots.classList.remove("hidden");
    for (let i = 0; i < total; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === photoSlide ? " on" : "");
      b.addEventListener("click", () => {
        const scroller = document.getElementById("photo-scroller");
        scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
      });
      dots.appendChild(b);
    }
  }

  function openPhotoPicker(index) {
    photoPick = index;
    document.getElementById("fit-file").click();
  }

  function removePhoto(index) {
    const slot = photos[index];
    if (slot) forgetPreview(slot.preview);
    photos.splice(index, 1);
    if (photoSlide >= photos.length) photoSlide = Math.max(0, photos.length - 1);
    paintPhotoScroller();
  }

  function paintPhotoScroller() {
    bindPhotoScroller();
    const scroller = document.getElementById("photo-scroller");
    scroller.classList.toggle("story", mode === "story");
    scroller.replaceChildren();
    photos.forEach((p, i) => {
      const slide = document.createElement("div");
      slide.className = "photo-slide";
      const img = document.createElement("img");
      img.src = p.preview || p.url || "";
      img.alt = "";
      slide.appendChild(img);
      const x = document.createElement("button");
      x.type = "button";
      x.className = "photo-x";
      x.setAttribute("aria-label", "Remove photo");
      x.textContent = "X";
      x.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        removePhoto(i);
      });
      slide.appendChild(x);
      slide.addEventListener("click", () => openPhotoPicker(i));
      scroller.appendChild(slide);
    });
    if (photos.length < photoCap()) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "photo-slide add";
      add.innerHTML = `<div class="plus">+</div><span>${photos.length ? `Add ${photos.length + 1} / ${photoCap()}` : "Add photo"}</span>`;
      add.addEventListener("click", () => openPhotoPicker(-1));
      scroller.appendChild(add);
    }
    paintPhotoDots();
    requestAnimationFrame(() => {
      const w = scroller.clientWidth || 1;
      scroller.scrollLeft = photoSlide * w;
    });
  }

  function openPost(post) {
    resetCompose();
    editingOutfit = post;
    const story = isStoryPost(post);
    mode = story ? "story" : "fit";
    const urls = photosFromOutfit(post);
    photos = urls.map((href) => ({ blob: null, preview: href, url: href }));
    photoSlide = 0;
    if (story) {
      document.getElementById("photo-step").textContent = "Edit story · photo";
      document.getElementById("photo-hint").textContent = "Tap photo to replace. Stories stay one frame.";
      document.getElementById("photo-next").textContent = "Save story";
    } else {
      cards = cardsFromItems(itemsByOutfit[post.id] || []);
      document.getElementById("photo-step").textContent = "Edit fit check · photos";
      document.getElementById("photo-hint").textContent = "Swipe up to 3. Tap a frame to replace. Next keeps product cards.";
      document.getElementById("photo-next").textContent = "Next";
    }
    paintPhotoScroller();
    showScreen("photo");
  }

  async function deletePost(post) {
    if (!post?.id) return;
    if (!window.confirm("DELETE THIS POST AND ITS PRODUCT CARDS?")) return;
    snack("DELETING…");
    try {
      const items = itemsByOutfit[post.id] || [];
      for (const item of items) {
        if (item.id) await restWrite({ op: "delete", table: "items", id: item.id });
      }
      await restWrite({ op: "delete", table: "outfits", id: post.id });
      snack("POST DELETED.");
      await loadArtistPosts();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  }

  function resetCompose() {
    editingOutfit = null;
    photos.forEach((p) => forgetPreview(p.preview));
    photos = [];
    photoSlide = 0;
    photoPick = -1;
    cardIndex = 0;
    cards = emptyCards();
  }

  function goFit() {
    mode = "fit";
    resetCompose();
    document.getElementById("photo-step").textContent = "Fit check · photos";
    document.getElementById("photo-hint").textContent = "Up to 3. Swipe like Instagram. 1080px min.";
    document.getElementById("photo-next").textContent = "Next";
    paintPhotoScroller();
    showScreen("photo");
  }

  function goStory() {
    mode = "story";
    resetCompose();
    document.getElementById("photo-step").textContent = "Story · photo";
    document.getElementById("photo-hint").textContent = "One frame. 1080px min. 9:16 like Instagram Stories.";
    document.getElementById("photo-next").textContent = "Post story";
    paintPhotoScroller();
    showScreen("photo");
  }

  function setDropPreview(drop, blobUrl) {
    drop.querySelector("img")?.remove();
    if (!blobUrl) return;
    const img = document.createElement("img");
    img.src = blobUrl;
    drop.appendChild(img);
  }

  function paintCardForm() {
    const card = cards[cardIndex];
    document.getElementById("card-step").textContent = `Card ${cardIndex + 1} / ${MAX_CARDS}`;
    document.getElementById("card-brand").value = card.brand;
    document.getElementById("card-title").value = card.title;
    document.getElementById("card-color").value = card.color;
    document.getElementById("card-price").value = card.price;
    document.getElementById("card-brand-live").textContent = card.brand || "BRAND";
    document.getElementById("card-item-live").textContent = card.title || "MODEL";
    const ph = document.getElementById("card-photo");
    ph.querySelector("img")?.remove();
    if (card.imagePreview) {
      const img = document.createElement("img");
      img.src = card.imagePreview;
      ph.appendChild(img);
    }
    fillListings(document.getElementById("card-urls"), card.listings);
    paintAvail();
    const last = cardIndex === MAX_CARDS - 1;
    if (mode === "archive") {
      document.getElementById("card-next").textContent = last
        ? (editingArchive ? "Save archive fit" : "Post archive fit")
        : "Next card";
    } else {
      document.getElementById("card-next").textContent = last
        ? (editingOutfit ? "Save fit check" : "Post fit check")
        : "Next card";
    }
  }

  function captureCardForm() {
    const card = cards[cardIndex];
    card.brand = document.getElementById("card-brand").value.trim().toUpperCase();
    card.title = document.getElementById("card-title").value.trim().toUpperCase();
    card.color = document.getElementById("card-color").value.trim().toUpperCase();
    card.price = document.getElementById("card-price").value.trim();
    card.listings = listingsFrom(document.getElementById("card-urls"));
  }

  function paintAvail() {
    const host = document.getElementById("card-avail");
    const live = document.getElementById("card-avail-live");
    const hint = document.getElementById("card-avail-hint");
    const current = normalizeAvail(cards[cardIndex].availability);
    cards[cardIndex].availability = current;
    host.replaceChildren();
    AVAIL.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (opt.id === current ? " on" : "");
      b.textContent = opt.label;
      b.addEventListener("click", () => {
        cards[cardIndex].availability = opt.id;
        paintAvail();
      });
      host.appendChild(b);
    });
    const gated = current !== "in_stock";
    live.textContent = gated ? availLabel(current) : "";
    live.classList.toggle("on", gated);
    hint.textContent = gated
      ? "App shows this label. No store redirect."
      : "In stock opens the store URL in the app.";
  }

  async function collectPhotoUrls(kind) {
    const urls = [];
    const folder = kind === "story" ? "stories" : "fits";
    for (const slot of photos) {
      if (slot.blob) {
        urls.push(await uploadJpeg(`${folder}/${selected.id}/${crypto.randomUUID()}.${photoExt(slot.blob)}`, slot.blob));
      } else if (slot.url && !String(slot.url).startsWith("blob:")) {
        urls.push(slot.url);
      }
    }
    return urls.slice(0, photoCap());
  }

  async function saveOutfitItems(outfitId) {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card.brand && !card.title) {
        if (card.id) await restWrite({ op: "delete", table: "items", id: card.id });
        continue;
      }
      let itemUrl = card.imageUrl || "";
      if (card.imageBlob) {
        itemUrl = await uploadJpeg(`items/${outfitId}/${i + 1}-${crypto.randomUUID().slice(0, 6)}.${photoExt(card.imageBlob)}`, card.imageBlob);
      }
      const listings = stampAvailability(
        (card.listings || []).filter((r) => r.url),
        card.availability,
      );
      const availability = normalizeAvail(card.availability);
      const row = {
        outfit_id: outfitId,
        artist_id: selected.id,
        title: card.title || "ITEM",
        name: card.title || "ITEM",
        brand: card.brand || "BRAND",
        color: card.color || null,
        price: parsePrice(card.price),
        image_url: itemUrl || null,
        purchase_url: listings.find((r) => r.url)?.url || null,
        listings,
        availability,
      };
      const optional = ["artist_id", "color", "price", "image_url", "purchase_url", "listings", "title", "name", "availability"];
      if (card.id) {
        const patch = { ...row };
        delete patch.outfit_id;
        await patchLoose("items", card.id, patch, optional);
      } else {
        await insertLoose("items", row, optional);
      }
    }
  }

  async function publishOutfit(kind) {
    if (!selected?.id) throw new Error("PICK A STAR FIRST.");
    snack(editingOutfit ? "SAVING…" : "UPLOADING…");
    const urls = await collectPhotoUrls(kind);
    if (!urls.length) throw new Error("ADD AN HD PHOTO FIRST.");
    const imageUrl = urls[0];
    const imageUrls = urls;
    if (editingOutfit?.id) {
      await patchLoose("outfits", editingOutfit.id, { image_url: imageUrl, image_urls: imageUrls }, ["image_urls"]);
      if (kind === "fit") await saveOutfitItems(editingOutfit.id);
      return editingOutfit;
    }
    const outfit = await insertLoose("outfits", {
      artist_id: selected.id,
      image_url: imageUrl,
      image_urls: imageUrls,
      title: kind === "story" ? "STORY" : "FIT CHECK",
      date: new Date().toISOString(),
      is_vault: false,
    }, ["title", "date", "is_vault", "image_urls"]);
    if (kind === "fit") await saveOutfitItems(outfit.id);
    return outfit;
  }

  function ensureCountryOption(country) {
    const select = document.getElementById("star-country");
    const value = (country || "").toUpperCase();
    if (!value) return;
    const exists = [...select.options].some((o) => o.value.toUpperCase() === value);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    }
    const match = [...select.options].find((o) => o.value.toUpperCase() === value);
    select.value = match ? match.value : value;
  }

  function openStarForm(artist) {
    editingId = artist?.id || "";
    if (artist) selected = artist;
    ppBlob = null;
    if (ppPreview) URL.revokeObjectURL(ppPreview);
    ppPreview = "";
    const drop = document.getElementById("pp-drop");
    drop.querySelector("img")?.remove();
    document.getElementById("star-msg").textContent = "";
    document.getElementById("star-step").textContent = artist ? "Edit star" : "New star";
    document.getElementById("star-hint").textContent = artist
      ? "Fix name, Instagram, country, or swap the portrait."
      : "Name, Instagram, country, portrait. Country sets content region.";
    document.getElementById("star-save").textContent = artist ? "Save edits" : "Save star";
    document.getElementById("pp-label").textContent = artist ? "Star PP · tap to replace" : "Star PP · 640px min";
    document.getElementById("star-name").value = artist?.name || "";
    document.getElementById("star-ig").value = artist?.instagram ? `@${String(artist.instagram).replace(/^@/, "")}` : "";
    ensureCountryOption(artist?.country || "UNITED STATES");
    if (!artist) document.getElementById("star-country").value = "UNITED STATES";
    const existing = artist?.image_url || artist?.imageUrl;
    if (existing) setDropPreview(drop, existing);
    syncRegionHint();
    showScreen("star");
  }

  async function patchLoose(tableName, id, payload, optionalKeys) {
    let patch = { ...payload };
    let keys = (optionalKeys || []).slice();
    for (;;) {
      try {
        await restWrite({ op: "update", table: tableName, id, patch });
        return;
      } catch (error) {
        const msg = error.message || "";
        const hit = keys.find((k) => msg.toLowerCase().includes(k.toLowerCase()));
        if (!hit) throw error;
        delete patch[hit];
        keys = keys.filter((k) => k !== hit);
      }
    }
  }

  async function saveStar() {
    const name = document.getElementById("star-name").value.trim().toUpperCase();
    const country = document.getElementById("star-country").value;
    const region = regionForCountry(country) || "ALL";
    const instagram = igHandle(document.getElementById("star-ig").value);
    const msg = document.getElementById("star-msg");
    msg.textContent = "";
    if (!name) {
      snack("NAME REQUIRED.", true);
      return;
    }
    if (!editingId && !ppBlob) {
      snack("STAR PP REQUIRED. 640PX+ SQUARE CROP.", true);
      return;
    }
    try {
      msg.textContent = "SAVING…";
      let imageUrl = "";
      if (ppBlob) {
        const path = `stars/${slug(name)}-${crypto.randomUUID().slice(0, 8)}.jpg`;
        imageUrl = await uploadJpeg(path, ppBlob);
      }
      if (editingId) {
        const patch = { name, country, region, instagram };
        if (imageUrl) patch.image_url = imageUrl;
        await patchLoose("artists", editingId, patch, ["instagram", "region"]);
        snack("STAR UPDATED.");
        const id = editingId;
        await loadArtists();
        openArtist(artists.find((a) => a.id === id) || { id, name, country, region, image_url: imageUrl || selected?.image_url, instagram });
        return;
      }
      const row = await insertLoose("artists", {
        name,
        country,
        region,
        image_url: imageUrl,
        instagram,
      }, ["instagram", "region"]);
      snack("STAR SAVED.");
      await loadArtists();
      openArtist(artists.find((a) => a.id === row.id) || { ...row, name, country, region, image_url: imageUrl, instagram });
    } catch (e) {
      const text = e.message || String(e);
      msg.textContent = text;
      snack(text, true);
    }
  }

  document.getElementById("star-country").innerHTML = COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  const syncRegionHint = () => {
    const country = document.getElementById("star-country").value;
    document.getElementById("star-region").textContent = `CONTENT REGION · ${regionForCountry(country)}`;
  };
  document.getElementById("star-country").addEventListener("change", syncRegionHint);
  syncRegionHint();

  document.getElementById("add-star").addEventListener("click", () => {
    selected = null;
    openStarForm(null);
  });
  document.getElementById("edit-star").addEventListener("click", () => {
    if (selected) openStarForm(selected);
  });
  document.getElementById("star-save").addEventListener("click", saveStar);
  document.getElementById("pp-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      ppBlob = await pickHd(file, "pp");
      if (ppPreview) URL.revokeObjectURL(ppPreview);
      ppPreview = previewUrl(ppBlob);
      setDropPreview(document.getElementById("pp-drop"), ppPreview);
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("go-fit").addEventListener("click", goFit);
  document.getElementById("go-story").addEventListener("click", goStory);

  document.getElementById("fit-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const kind = mode === "story" ? "story" : "fit";
      const blob = await pickHd(file, kind);
      const href = previewUrl(blob);
      if (photoPick >= 0 && photoPick < photos.length) {
        forgetPreview(photos[photoPick].preview);
        photos[photoPick] = { blob, preview: href, url: "" };
        photoSlide = photoPick;
      } else if (photos.length < photoCap()) {
        photos.push({ blob, preview: href, url: "" });
        photoSlide = photos.length - 1;
      } else {
        snack(`MAX ${photoCap()} PHOTO${photoCap() === 1 ? "" : "S"}.`, true);
        URL.revokeObjectURL(href);
        return;
      }
      photoPick = -1;
      paintPhotoScroller();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("photo-next").addEventListener("click", async () => {
    if (mode === "story") {
      try {
        const wasEdit = Boolean(editingOutfit);
        await publishOutfit("story");
        snack(wasEdit ? "STORY SAVED. PULL TO REFRESH THE APP." : "STORY POSTED. PULL TO REFRESH THE APP.");
        resetCompose();
        showScreen("artist");
        await loadArtistPosts();
      } catch (err) {
        snack(err.message || String(err), true);
      }
      return;
    }
    if (!photos.length) {
      snack("ADD AN HD FIT PHOTO FIRST.", true);
      return;
    }
    cardIndex = 0;
    paintCardForm();
    showScreen("card");
  });

  ["card-brand", "card-title"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      document.getElementById("card-brand-live").textContent = document.getElementById("card-brand").value.trim().toUpperCase() || "BRAND";
      document.getElementById("card-item-live").textContent = document.getElementById("card-title").value.trim().toUpperCase() || "MODEL";
    });
  });

  document.getElementById("card-url-add").addEventListener("click", () => {
    addListingRow(document.getElementById("card-urls"), null);
  });

  document.getElementById("card-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await pickHd(file, "item");
      const card = cards[cardIndex];
      if (card.imagePreview) forgetPreview(card.imagePreview);
      card.imageBlob = blob;
      card.imagePreview = previewUrl(blob);
      card.imageUrl = "";
      paintCardForm();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  async function finishFitPublish() {
    const wasEdit = Boolean(editingOutfit);
    await publishOutfit("fit");
    snack(wasEdit ? "FIT CHECK SAVED. PULL TO REFRESH THE APP." : "FIT CHECK POSTED. PULL TO REFRESH THE APP.");
    resetCompose();
    showScreen("artist");
    await loadArtistPosts();
  }

  async function finishCurrentCards() {
    if (mode === "archive") {
      const wasEdit = Boolean(editingArchive);
      await finishArchivePublish();
      snack(wasEdit ? "ARCHIVE FIT SAVED. PULL TO REFRESH THE APP." : "ARCHIVE FIT POSTED. PULL TO REFRESH THE APP.");
      resetArchiveCompose();
      showScreen("archive");
      await loadArchiveFits();
      return;
    }
    await finishFitPublish();
  }

  document.getElementById("card-next").addEventListener("click", async () => {
    captureCardForm();
    if (cardIndex < MAX_CARDS - 1) {
      cardIndex += 1;
      paintCardForm();
      return;
    }
    try {
      await finishCurrentCards();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("card-skip").addEventListener("click", async () => {
    const card = cards[cardIndex];
    forgetPreview(card.imagePreview);
    const keepId = card.id;
    cards[cardIndex] = emptyCard();
    cards[cardIndex].id = keepId;
    if (cardIndex < MAX_CARDS - 1) {
      cardIndex += 1;
      paintCardForm();
      return;
    }
    try {
      await finishCurrentCards();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  function newsUrlList(row) {
    const raw = row?.image_urls ?? row?.imageUrls ?? row?.image_url ?? row?.imageUrl;
    const out = [];
    const add = (v) => {
      if (v == null) return;
      if (Array.isArray(v)) {
        v.forEach(add);
        return;
      }
      const s = String(v).trim();
      if (!s || s === "null" || out.includes(s) || out.length >= MAX_NEWS_PHOTOS) return;
      out.push(s);
    };
    add(raw);
    return out;
  }

  function newsWhen(row) {
    const raw = row?.created_at || row?.createdAt;
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 2) return "JUST NOW";
    if (mins < 60) return `${mins} MINS AGO`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} HOUR${hrs === 1 ? "" : "S"} AGO`;
    const days = Math.round(hrs / 24);
    return `${days} DAY${days === 1 ? "" : "S"} AGO`;
  }

  function resetNewsCompose() {
    editingNews = null;
    newsPhotos.forEach((p) => forgetPreview(p.preview));
    newsPhotos = [];
    newsSlide = 0;
    newsPick = -1;
    newsCat = "CULTURE";
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set("news-title", "");
    set("news-dek", "");
    set("news-body", "");
    set("news-source", "THE WEARS EDITORIAL");
    set("news-pname", "");
    set("news-pdate", "");
    set("news-purl", "");
    set("news-pnote", "");
    set("news-sku", "");
    document.getElementById("news-step").textContent = "New dispatch";
    document.getElementById("news-save").textContent = "Publish dispatch";
    document.getElementById("news-edit-msg").textContent = "";
    paintNewsCats();
    paintNewsScroller();
    paintNewsPlate();
  }

  function bindNewsScroller() {
    if (newsScrollerBound) return;
    newsScrollerBound = true;
    const scroller = document.getElementById("news-scroller");
    scroller.addEventListener("scroll", () => {
      const w = scroller.clientWidth || 1;
      newsSlide = Math.round(scroller.scrollLeft / w);
      paintNewsDots();
    }, { passive: true });
  }

  function paintNewsDots() {
    const dots = document.getElementById("news-dots");
    const total = newsPhotos.length < MAX_NEWS_PHOTOS ? newsPhotos.length + 1 : Math.max(newsPhotos.length, 1);
    dots.replaceChildren();
    if (total <= 1) {
      dots.classList.add("hidden");
      return;
    }
    dots.classList.remove("hidden");
    for (let i = 0; i < total; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === newsSlide ? " on" : "");
      b.addEventListener("click", () => {
        const scroller = document.getElementById("news-scroller");
        scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
      });
      dots.appendChild(b);
    }
  }

  function openNewsPicker(index) {
    newsPick = index;
    document.getElementById("news-file").click();
  }

  function removeNewsPhoto(index) {
    const slot = newsPhotos[index];
    if (slot) forgetPreview(slot.preview);
    newsPhotos.splice(index, 1);
    if (newsSlide >= newsPhotos.length) newsSlide = Math.max(0, newsPhotos.length - 1);
    paintNewsScroller();
  }

  function paintNewsScroller() {
    bindNewsScroller();
    const scroller = document.getElementById("news-scroller");
    scroller.replaceChildren();
    newsPhotos.forEach((p, i) => {
      const slide = document.createElement("div");
      slide.className = "photo-slide";
      const img = document.createElement("img");
      img.src = p.preview || p.url || "";
      img.alt = "";
      slide.appendChild(img);
      const x = document.createElement("button");
      x.type = "button";
      x.className = "photo-x";
      x.setAttribute("aria-label", "Remove photo");
      x.textContent = "X";
      x.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        removeNewsPhoto(i);
      });
      slide.appendChild(x);
      slide.addEventListener("click", () => openNewsPicker(i));
      scroller.appendChild(slide);
    });
    if (newsPhotos.length < MAX_NEWS_PHOTOS) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "photo-slide add";
      add.innerHTML = `<div class="plus">+</div><span>${newsPhotos.length ? `Add ${newsPhotos.length + 1} / ${MAX_NEWS_PHOTOS}` : "Add photo"}</span>`;
      add.addEventListener("click", () => openNewsPicker(-1));
      scroller.appendChild(add);
    }
    paintNewsDots();
    requestAnimationFrame(() => {
      const w = scroller.clientWidth || 1;
      scroller.scrollLeft = newsSlide * w;
    });
  }

  function paintNewsCats() {
    const host = document.getElementById("news-cats");
    host.replaceChildren();
    NEWS_CATS.forEach((cat) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (cat === newsCat ? " on" : "");
      b.textContent = cat;
      b.addEventListener("click", () => {
        newsCat = cat;
        paintNewsCats();
      });
      host.appendChild(b);
    });
  }

  function buyLabel(href) {
    let s = String(href || "").trim();
    s = s.replace(/^https?:\/\//i, "");
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  }

  function paintNewsPlate() {
    const name = document.getElementById("news-pname").value.trim() || "—";
    const date = document.getElementById("news-pdate").value.trim() || "—";
    const href = document.getElementById("news-purl").value.trim();
    const note = document.getElementById("news-pnote").value.trim();
    const sku = document.getElementById("news-sku").value.trim() || "—";
    document.getElementById("news-live-name").textContent = name;
    document.getElementById("news-live-date").textContent = date;
    document.getElementById("news-live-sku").textContent = sku;
    const buy = document.getElementById("news-live-buy");
    if (href) {
      buy.textContent = buyLabel(href);
      buy.classList.remove("note");
    } else if (note) {
      buy.textContent = note;
      buy.classList.add("note");
    } else {
      buy.textContent = "—";
      buy.classList.add("note");
    }
  }

  async function loadNews() {
    const msg = document.getElementById("news-msg");
    msg.textContent = "LOADING…";
    try {
      newsRows = await restList("drip_news", {});
    } catch (err) {
      try {
        const { data, error } = await sb.from("drip_news").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        newsRows = Array.isArray(data) ? data : [];
      } catch (e) {
        newsRows = [];
        msg.textContent = e.message || String(e);
        paintNewsList();
        return;
      }
    }
    newsRows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    msg.textContent = newsRows.length ? `${newsRows.length} DISPATCH${newsRows.length === 1 ? "" : "ES"}.` : "NO DISPATCHES.";
    paintNewsList();
  }

  function paintNewsList() {
    const host = document.getElementById("news-list");
    host.replaceChildren();
    newsRows.forEach((row) => {
      const wrap = document.createElement("div");
      wrap.className = "post-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "post";
      const urls = newsUrlList(row);
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      if (urls[0]) {
        const img = document.createElement("img");
        img.src = urls[0];
        img.alt = "";
        thumb.appendChild(img);
      }
      const mid = document.createElement("div");
      const kind = document.createElement("div");
      kind.className = "kind";
      kind.textContent = row.category || "CULTURE";
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = (row.title || "UNTITLED").toString().slice(0, 72);
      const n = document.createElement("div");
      n.className = "n";
      n.textContent = newsWhen(row);
      mid.append(kind, when, n);
      btn.append(thumb, mid);
      btn.addEventListener("click", () => openNewsEdit(row));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "post-del";
      del.setAttribute("aria-label", "Delete dispatch");
      del.textContent = "X";
      del.addEventListener("click", (ev) => {
        ev.preventDefault();
        deleteNews(row);
      });
      wrap.append(btn, del);
      host.appendChild(wrap);
    });
  }

  function openNewsEdit(row) {
    resetNewsCompose();
    if (row) {
      editingNews = row;
      newsCat = String(row.category || "CULTURE").toUpperCase();
      if (!NEWS_CATS.includes(newsCat)) NEWS_CATS.push(newsCat);
      document.getElementById("news-title").value = row.title || "";
      document.getElementById("news-dek").value = row.dek || "";
      document.getElementById("news-body").value = row.body || "";
      document.getElementById("news-source").value = row.source || "THE WEARS EDITORIAL";
      document.getElementById("news-pname").value = row.product_name || "";
      document.getElementById("news-pdate").value = row.release_date || "";
      document.getElementById("news-purl").value = row.buy_url || "";
      document.getElementById("news-pnote").value = row.buy_note || "";
      document.getElementById("news-sku").value = row.sku || "";
      newsPhotos = newsUrlList(row).map((href) => ({ blob: null, preview: href, url: href }));
      document.getElementById("news-step").textContent = "Edit dispatch";
      document.getElementById("news-save").textContent = "Save dispatch";
    }
    paintNewsCats();
    paintNewsScroller();
    paintNewsPlate();
    showScreen("news-edit");
    requestAnimationFrame(paintNewsScroller);
  }

  async function collectNewsUrls() {
    const urls = [];
    for (const slot of newsPhotos) {
      if (slot.blob) {
        urls.push(await uploadJpeg(`news/${crypto.randomUUID()}.${photoExt(slot.blob)}`, slot.blob));
      } else if (slot.url && !String(slot.url).startsWith("blob:")) {
        urls.push(slot.url);
      }
    }
    return urls.slice(0, MAX_NEWS_PHOTOS);
  }

  async function saveNews() {
    const title = document.getElementById("news-title").value.trim();
    const dek = document.getElementById("news-dek").value.trim();
    const body = document.getElementById("news-body").value.trim();
    const source = document.getElementById("news-source").value.trim() || "THE WEARS EDITORIAL";
    const productName = document.getElementById("news-pname").value.trim();
    const releaseDate = document.getElementById("news-pdate").value.trim();
    const buyUrl = document.getElementById("news-purl").value.trim();
    const buyNote = document.getElementById("news-pnote").value.trim();
    const sku = document.getElementById("news-sku").value.trim();
    const msg = document.getElementById("news-edit-msg");
    if (!title) {
      snack("TITLE REQUIRED.", true);
      return;
    }
    if (!newsPhotos.length) {
      snack("ADD AN HD PHOTO FIRST.", true);
      return;
    }
    msg.textContent = "SAVING…";
    try {
      const imageUrls = await collectNewsUrls();
      const row = omitBlank({
        category: newsCat,
        title,
        dek,
        body,
        source,
        image_url: imageUrls[0] || "",
        image_urls: imageUrls,
        product_name: productName,
        release_date: releaseDate,
        buy_url: buyUrl,
        buy_note: buyNote,
        sku,
      });
      if (editingNews?.id) {
        await restWrite({ op: "update", table: "drip_news", id: editingNews.id, patch: row });
        snack("DISPATCH SAVED. PULL TO REFRESH THE APP.");
      } else {
        await insertLoose("drip_news", row, NEWS_OPTIONAL);
        snack("DISPATCH POSTED. PULL TO REFRESH THE APP.");
      }
      resetNewsCompose();
      showScreen("news");
      await loadNews();
    } catch (err) {
      const text = err.message || String(err);
      msg.textContent = text;
      snack(text.includes("drip_news") ? `${text}\nNazım SQL: sql/wears_drip_news.sql` : text, true);
    }
  }

  async function deleteNews(row) {
    if (!row?.id) return;
    if (!window.confirm("DELETE THIS DISPATCH?")) return;
    try {
      await restWrite({ op: "delete", table: "drip_news", id: row.id });
      snack("DISPATCH DELETED.");
      await loadNews();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  }

  async function openNewsDesk() {
    showScreen("news");
    await loadNews();
  }

  const PR_SPAN_DAYS = { d3: 3, w1: 7, w2: 14, m1: 30 };
  const PR_REJECT = [
    { id: "fit", label: "BAD FIT" },
    { id: "photo", label: "LOW PHOTO" },
    { id: "off", label: "OFF-BRIEF" },
    { id: "edit", label: "NOT EDITORIAL" },
  ];

  async function loadPrDesk() {
    const msg = document.getElementById("pr-msg");
    msg.textContent = "LOADING…";
    try {
      prRows = await restList("pr_submissions", {});
    } catch (err) {
      try {
        const { data, error } = await sb.from("pr_submissions").select("*").order("created_at", { ascending: false }).limit(80);
        if (error) throw error;
        prRows = Array.isArray(data) ? data : [];
      } catch (e) {
        prRows = [];
        msg.textContent = `${e.message || e}\nNazım SQL: supabase/wears_pr_desk.sql`;
        paintPrList();
        return;
      }
    }
    msg.textContent = prRows.length ? `${prRows.length} IN THE DESK` : "NO CHECKS.";
    paintPrList();
  }

  function paintPrList() {
    const host = document.getElementById("pr-list");
    host.innerHTML = "";
    const pending = prRows.filter((r) => String(r.status || "") === "pending");
    const rest = prRows.filter((r) => String(r.status || "") !== "pending");
    const rows = pending.concat(rest);
    if (!rows.length) return;
    rows.forEach((row) => {
      const wrap = document.createElement("div");
      wrap.className = "pr-card";
      const head = document.createElement("div");
      head.className = "pr-head";
      const kind = document.createElement("span");
      kind.textContent = String(row.kind || "").replace("_", " ").toUpperCase() || "CHECK";
      const st = document.createElement("b");
      st.textContent = String(row.status || "pending").toUpperCase();
      head.append(kind, st);
      const nick = document.createElement("h2");
      nick.textContent = row.nickname || row.legal_name || "—";
      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = `${row.legal_name || ""} · @${(row.instagram || "").replace(/^@/, "")} · ${row.span || ""} · ${(row.price_cents / 100).toFixed(0)} USD · ${row.email || ""}`;
      const about = document.createElement("p");
      about.textContent = row.about || "";
      const shots = document.createElement("div");
      shots.className = "pr-shots";
      const urls = Array.isArray(row.photo_urls) ? row.photo_urls : [];
      if (row.avatar_url) urls.unshift(row.avatar_url);
      urls.slice(0, 4).forEach((href) => {
        const img = document.createElement("img");
        img.src = href;
        img.alt = "";
        shots.appendChild(img);
      });
      wrap.append(head, nick, meta, about, shots);
      if (String(row.status) === "pending") {
        const actions = document.createElement("div");
        actions.className = "pr-actions";
        const go = document.createElement("button");
        go.type = "button";
        go.className = "btn ink";
        go.textContent = "Approve · charge clears";
        go.addEventListener("click", () => approvePr(row));
        actions.appendChild(go);
        PR_REJECT.forEach((why) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn";
          b.textContent = why.label;
          b.addEventListener("click", () => rejectPr(row, why.label));
          actions.appendChild(b);
        });
        wrap.appendChild(actions);
      }
      host.appendChild(wrap);
    });
  }

  async function approvePr(row) {
    const days = PR_SPAN_DAYS[row.span] || 3;
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    try {
      await restWrite({
        op: "update",
        table: "pr_submissions",
        id: row.id,
        patch: {
          status: "live",
          hold: false,
          reviewed_at: now.toISOString(),
          live_at: now.toISOString(),
          live_until: until.toISOString(),
        },
      });
      snack("LIVE. CHARGE CLEARS. PIN GOES UP.");
      await loadPrDesk();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  }

  async function rejectPr(row, reason) {
    try {
      await restWrite({
        op: "update",
        table: "pr_submissions",
        id: row.id,
        patch: {
          status: "rejected",
          hold: false,
          reject_reason: reason,
          reviewed_at: new Date().toISOString(),
        },
      });
      snack("PASSED. IN-APP NOTE + MAIL WHEN THE PIPE IS LIVE.");
      await loadPrDesk();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  }

  async function openPrDesk() {
    showScreen("pr");
    await loadPrDesk();
  }

  function memberGateName(raw) {
    const p = String(raw || "email").trim().toLowerCase();
    if (p === "apple" || p === "apple.com" || p.includes("apple")) return "APPLE";
    if (p === "google" || p === "google.com" || p.includes("google")) return "GOOGLE";
    if (p === "email" || p === "password" || p === "phone" || p === "firebase" || !p) return "HOUSE";
    return p.toUpperCase();
  }

  function memberGates(row) {
    const bits = String(row.providers || row.provider || "email")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const names = [...new Set((bits.length ? bits : ["email"]).map(memberGateName))];
    return names.join(" · ");
  }

  function memberHasGate(row, gate) {
    return memberGates(row).split(" · ").includes(gate);
  }

  function memberWhen(raw) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  }

  function filteredMembers() {
    return memberRows.filter((row) => {
      if (memberFilter === "ALL") return true;
      if (memberFilter === "PREMIUM") return !!row.is_premium;
      return memberHasGate(row, memberFilter);
    });
  }

  function renderMemberChips() {
    const host = document.getElementById("members-chips");
    host.replaceChildren();
    MEMBER_GATES.forEach((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (g === memberFilter ? " on" : "");
      b.textContent = g;
      b.addEventListener("click", () => {
        memberFilter = g;
        renderMemberChips();
        paintMembers();
      });
      host.appendChild(b);
    });
  }

  function paintMembers() {
    const host = document.getElementById("members-list");
    const list = filteredMembers();
    const prem = memberRows.filter((r) => r.is_premium).length;
    document.getElementById("members-kicker").textContent = memberRows.length
      ? `${memberRows.length} MEMBER(S) · ${prem} PREMIUM. OPENED ON DEMAND.`
      : "PREMIUM AND HOW THEY JOINED. OPENS ON DEMAND.";
    document.getElementById("members-msg").textContent = list.length
      ? `${list.length} SHOWN.`
      : memberRows.length
        ? "NOBODY IN THIS FILTER."
        : "NO MEMBERS YET.";
    host.replaceChildren();
    if (!list.length) return;
    const table = document.createElement("table");
    table.className = "members";
    const head = document.createElement("thead");
    const hr = document.createElement("tr");
    ["NICK", "GATE", "PLAN", "JOINED", "LAST IN"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      hr.appendChild(th);
    });
    head.appendChild(hr);
    const body = document.createElement("tbody");
    list.forEach((row) => {
      const tr = document.createElement("tr");
      const nick = document.createElement("td");
      const name = document.createElement("span");
      name.className = "nick";
      name.textContent = row.username || "—";
      nick.appendChild(name);
      if (row.email) {
        const mail = document.createElement("span");
        mail.className = "mail";
        mail.textContent = row.email;
        nick.appendChild(mail);
      }
      const gate = document.createElement("td");
      gate.className = "gate";
      gate.textContent = memberGates(row);
      const plan = document.createElement("td");
      plan.className = "plan";
      plan.textContent = row.is_premium ? "PREMIUM" : "FREE";
      const marks = [];
      if (row.is_admin) marks.push("STUDIO");
      if (row.is_frozen) marks.push("FROZEN");
      if (marks.length) {
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.textContent = marks.join(" · ");
        plan.appendChild(mark);
      }
      const grant = document.createElement("button");
      grant.type = "button";
      grant.className = "btn grant" + (row.is_premium ? " ghost" : " ink");
      grant.textContent = memberBusy === row.id
        ? "WAIT"
        : (row.is_premium ? "REVOKE" : "GRANT PREMIUM");
      grant.disabled = memberBusy === row.id;
      grant.addEventListener("click", () => setMemberPremium(row.id, !row.is_premium));
      plan.appendChild(grant);
      const joined = document.createElement("td");
      joined.textContent = memberWhen(row.created_at);
      const last = document.createElement("td");
      last.textContent = memberWhen(row.last_sign_in_at);
      tr.append(nick, gate, plan, joined, last);
      body.appendChild(tr);
    });
    table.append(head, body);
    host.appendChild(table);
  }

  async function loadMembers() {
    const msg = document.getElementById("members-msg");
    msg.textContent = "LOADING…";
    try {
      const { data, error } = await sb.rpc("wears_studio_members");
      if (error) throw error;
      memberRows = Array.isArray(data) ? data : [];
      paintMembers();
    } catch (err) {
      memberRows = [];
      paintMembers();
      msg.textContent = `${err.message || err}\nNazım SQL: twad/sql/wears_studio_members.sql`;
    }
  }

  async function openMembersDesk() {
    showScreen("members");
    renderMemberChips();
    await loadMembers();
  }

  async function setMemberPremium(id, on) {
    if (!id || memberBusy) return;
    memberBusy = id;
    paintMembers();
    try {
      const { error } = await sb.rpc("wears_studio_set_premium", {
        member: id,
        on_premium: on,
      });
      if (error) throw error;
      const row = memberRows.find((r) => r.id === id);
      if (row) row.is_premium = on;
      snack(on ? "PREMIUM GRANTED." : "PREMIUM REVOKED.");
    } catch (err) {
      snack(`${err.message || err}\nNazım SQL: twad/sql/wears_studio_stats_premium.sql`, true);
    }
    memberBusy = "";
    paintMembers();
  }

  function statsWhen(raw) {
    if (!raw) return "—";
    const d = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  }

  function statsSpan(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}H ${m}M`;
    return `${m}M`;
  }

  function paintStats() {
    const todayHost = document.getElementById("stats-today");
    const listHost = document.getElementById("stats-list");
    const today = statsRows[0] || { people: 0, seconds: 0 };
    const people = Number(today.people) || 0;
    const seconds = Number(today.seconds) || 0;
    document.getElementById("stats-kicker").textContent = statsRows.length
      ? `LAST 14 DAYS. SIGNED-IN MEMBERS. FOREGROUND ONLY.`
      : "WHO OPENED THE APP. TIME IN THE FOREGROUND.";
    todayHost.replaceChildren();
    const kicker = document.createElement("p");
    kicker.className = "sub";
    kicker.textContent = "TODAY";
    const who = document.createElement("p");
    who.className = "stats-people";
    who.textContent = `${people} ${people === 1 ? "PERSON" : "PEOPLE"}`;
    const time = document.createElement("p");
    time.className = "stats-time";
    time.textContent = statsSpan(seconds);
    todayHost.append(kicker, who, time);
    listHost.replaceChildren();
    if (!statsRows.length) return;
    const table = document.createElement("table");
    table.className = "members";
    const head = document.createElement("thead");
    const hr = document.createElement("tr");
    ["DAY", "PEOPLE", "TIME"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      hr.appendChild(th);
    });
    head.appendChild(hr);
    const body = document.createElement("tbody");
    statsRows.forEach((row) => {
      const tr = document.createElement("tr");
      const day = document.createElement("td");
      day.textContent = statsWhen(row.day);
      const whoCell = document.createElement("td");
      whoCell.className = "plan";
      whoCell.textContent = String(Number(row.people) || 0);
      const timeCell = document.createElement("td");
      timeCell.className = "plan";
      timeCell.textContent = statsSpan(row.seconds);
      tr.append(day, whoCell, timeCell);
      body.appendChild(tr);
    });
    table.append(head, body);
    listHost.appendChild(table);
  }

  async function loadStats() {
    const msg = document.getElementById("stats-msg");
    msg.textContent = "LOADING…";
    try {
      const { data, error } = await sb.rpc("wears_studio_stats", { span: 14 });
      if (error) throw error;
      statsRows = Array.isArray(data) ? data : [];
      paintStats();
      msg.textContent = statsRows.length ? "UTC DAYS." : "NO DAYS YET.";
    } catch (err) {
      statsRows = [];
      paintStats();
      msg.textContent = `${err.message || err}\nNazım SQL: twad/sql/wears_studio_stats_premium.sql`;
    }
  }

  async function openStatsDesk() {
    showScreen("stats");
    await loadStats();
  }

  function archiveUrlList(row) {
    return photosFromOutfit(row);
  }

  function onceName(raw) {
    let s = String(raw || "").trim().toUpperCase().replace(/\s+/g, " ");
    const words = s.split(" ").filter(Boolean);
    if (words.length >= 2 && words.length % 2 === 0) {
      const mid = words.length / 2;
      const a = words.slice(0, mid).join(" ");
      const b = words.slice(mid).join(" ");
      if (a === b) return a;
    }
    return s;
  }

  function archiveNameOf(row) {
    return onceName(row?.artist_name || row?.name || row?.artist || "");
  }

  function archiveYearOf(row) {
    const m = String(row?.year || "").trim().match(/(\d{4})/);
    return m ? m[1] : "";
  }

  function resetArchiveCompose() {
    editingArchive = null;
    archivePhotos.forEach((p) => forgetPreview(p.preview));
    archivePhotos = [];
    archiveSlide = 0;
    archivePick = -1;
    cardIndex = 0;
    cards = emptyCards();
    document.getElementById("archive-name").value = "";
    document.getElementById("archive-year").value = "";
    document.getElementById("archive-star").value = "";
    document.getElementById("archive-step").textContent = "New archive fit";
    document.getElementById("archive-next").textContent = "Next · product cards";
    document.getElementById("archive-edit-msg").textContent = "";
    paintArchiveBar();
  }

  function paintArchiveBar() {
    const name = onceName(document.getElementById("archive-name").value) || "NAME";
    const typed = document.getElementById("archive-year").value.trim();
    const year = (typed.match(/(\d{4})/) || [])[1] || "YEAR";
    document.getElementById("archive-live-name").textContent = name;
    document.getElementById("archive-live-year").textContent = year === name ? "YEAR" : year;
  }

  function fillArchiveStars() {
    const select = document.getElementById("archive-star");
    const current = select.value;
    const opts = [`<option value="">— TYPE THE NAME —</option>`]
      .concat(artists.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))).map((a) => {
        const id = a.id || "";
        const label = String(a.name || "STAR").replace(/</g, "");
        return `<option value="${id}">${label}</option>`;
      }));
    select.innerHTML = opts.join("");
    if (current && [...select.options].some((o) => o.value === current)) select.value = current;
  }

  function bindArchiveScroller() {
    if (archiveScrollerBound) return;
    archiveScrollerBound = true;
    const scroller = document.getElementById("archive-scroller");
    scroller.addEventListener("scroll", () => {
      const w = scroller.clientWidth || 1;
      archiveSlide = Math.round(scroller.scrollLeft / w);
      paintArchiveDots();
    }, { passive: true });
  }

  function paintArchiveDots() {
    const dots = document.getElementById("archive-dots");
    const total = archivePhotos.length < MAX_PHOTOS ? archivePhotos.length + 1 : Math.max(archivePhotos.length, 1);
    dots.replaceChildren();
    if (total <= 1) {
      dots.classList.add("hidden");
      return;
    }
    dots.classList.remove("hidden");
    for (let i = 0; i < total; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === archiveSlide ? " on" : "");
      b.addEventListener("click", () => {
        const scroller = document.getElementById("archive-scroller");
        scroller.scrollTo({ left: i * scroller.clientWidth, behavior: "smooth" });
      });
      dots.appendChild(b);
    }
  }

  function openArchivePicker(index) {
    archivePick = index;
    document.getElementById("archive-file").click();
  }

  function removeArchivePhoto(index) {
    const slot = archivePhotos[index];
    if (slot) forgetPreview(slot.preview);
    archivePhotos.splice(index, 1);
    if (archiveSlide >= archivePhotos.length) archiveSlide = Math.max(0, archivePhotos.length - 1);
    paintArchiveScroller();
  }

  function paintArchiveScroller() {
    bindArchiveScroller();
    const scroller = document.getElementById("archive-scroller");
    scroller.replaceChildren();
    archivePhotos.forEach((p, i) => {
      const slide = document.createElement("div");
      slide.className = "photo-slide";
      const img = document.createElement("img");
      img.src = p.preview || p.url || "";
      img.alt = "";
      slide.appendChild(img);
      const x = document.createElement("button");
      x.type = "button";
      x.className = "photo-x";
      x.setAttribute("aria-label", "Remove photo");
      x.textContent = "X";
      x.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        removeArchivePhoto(i);
      });
      slide.appendChild(x);
      slide.addEventListener("click", () => openArchivePicker(i));
      scroller.appendChild(slide);
    });
    if (archivePhotos.length < MAX_PHOTOS) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "photo-slide add";
      add.innerHTML = `<div class="plus">+</div><span>${archivePhotos.length ? `Add ${archivePhotos.length + 1} / ${MAX_PHOTOS}` : "Add photo"}</span>`;
      add.addEventListener("click", () => openArchivePicker(-1));
      scroller.appendChild(add);
    }
    paintArchiveDots();
    requestAnimationFrame(() => {
      const w = scroller.clientWidth || 1;
      scroller.scrollLeft = archiveSlide * w;
    });
  }

  async function loadArchiveFits() {
    const msg = document.getElementById("archive-msg");
    msg.textContent = "LOADING…";
    try {
      archiveRows = await restList("archives", {});
    } catch (err) {
      try {
        const { data, error } = await sb.from("archives").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        archiveRows = Array.isArray(data) ? data : [];
      } catch (e) {
        archiveRows = [];
        msg.textContent = e.message || String(e);
        paintArchiveList();
        return;
      }
    }
    archiveRows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    msg.textContent = archiveRows.length
      ? `${archiveRows.length} ARCHIVE FIT${archiveRows.length === 1 ? "" : "S"}.`
      : "NO ARCHIVE FITS.";
    paintArchiveList();
  }

  function paintArchiveList() {
    const host = document.getElementById("archive-list");
    host.replaceChildren();
    archiveRows.forEach((row) => {
      const wrap = document.createElement("div");
      wrap.className = "post-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "post";
      const urls = archiveUrlList(row);
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      if (urls[0]) {
        const img = document.createElement("img");
        img.src = urls[0];
        img.alt = "";
        thumb.appendChild(img);
      }
      const mid = document.createElement("div");
      const person = archiveNameOf(row);
      const kind = document.createElement("div");
      kind.className = "kind";
      kind.textContent = person || "ARCHIVE";
      const when = document.createElement("div");
      when.className = "when";
      const year = archiveYearOf(row);
      when.textContent = year && year !== person ? year : "";
      const n = document.createElement("div");
      n.className = "n";
      n.textContent = "PREMIUM";
      mid.append(kind, when, n);
      btn.append(thumb, mid);
      btn.addEventListener("click", () => openArchiveEdit(row));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "post-del";
      del.setAttribute("aria-label", "Delete archive fit");
      del.textContent = "X";
      del.addEventListener("click", (ev) => {
        ev.preventDefault();
        deleteArchiveFit(row);
      });
      wrap.append(btn, del);
      host.appendChild(wrap);
    });
  }

  async function openArchiveEdit(row) {
    resetArchiveCompose();
    mode = "archive";
    fillArchiveStars();
    if (row) {
      editingArchive = row;
      document.getElementById("archive-name").value = archiveNameOf(row);
      document.getElementById("archive-year").value = archiveYearOf(row);
      const starId = row.artist_id || row.artistId || "";
      if (starId) document.getElementById("archive-star").value = starId;
      archivePhotos = archiveUrlList(row).map((href) => ({ blob: null, preview: href, url: href }));
      document.getElementById("archive-step").textContent = "Edit archive fit";
      try {
        const items = await loadFiltered("items", { archive_id: row.id });
        cards = cardsFromItems(items);
      } catch {
        cards = emptyCards();
      }
    }
    paintArchiveBar();
    paintArchiveScroller();
    showScreen("archive-edit");
    requestAnimationFrame(paintArchiveScroller);
  }

  async function collectArchiveUrls() {
    const urls = [];
    for (const slot of archivePhotos) {
      if (slot.blob) {
        urls.push(await uploadJpeg(`archives/${crypto.randomUUID()}.${photoExt(slot.blob)}`, slot.blob));
      } else if (slot.url && !String(slot.url).startsWith("blob:")) {
        urls.push(slot.url);
      }
    }
    return urls.slice(0, MAX_PHOTOS);
  }

  async function saveArchiveItems(archiveId, artistId, coverUrl) {
    let outfitId = null;
    const optional = [
      "outfit_id", "archive_id", "artist_id", "color", "colorway", "price", "image_url",
      "purchase_url", "listings", "title", "name", "availability", "is_vault",
    ];
    async function writeItem(card, i, extra) {
      let itemUrl = card.imageUrl || "";
      if (card.imageBlob) {
        itemUrl = await uploadJpeg(`items/${archiveId}/${i + 1}-${crypto.randomUUID().slice(0, 6)}.${photoExt(card.imageBlob)}`, card.imageBlob);
      }
      const listings = stampAvailability(
        (card.listings || []).filter((r) => r.url),
        card.availability,
      );
      const availability = normalizeAvail(card.availability);
      const row = {
        archive_id: archiveId,
        artist_id: artistId || null,
        title: card.title || "ITEM",
        name: card.title || "ITEM",
        brand: card.brand || "BRAND",
        color: card.color || null,
        colorway: card.color || null,
        price: parsePrice(card.price),
        image_url: itemUrl || null,
        purchase_url: listings.find((r) => r.url)?.url || null,
        listings,
        availability,
        is_vault: true,
        ...extra,
      };
      if (card.id) {
        const patch = { ...row };
        delete patch.outfit_id;
        await patchLoose("items", card.id, patch, optional);
        return;
      }
      try {
        await insertLoose("items", row, optional);
      } catch (err) {
        const msg = err.message || "";
        if (!outfitId && /outfit_id/i.test(msg)) {
          const outfit = await insertLoose("outfits", {
            artist_id: artistId || null,
            image_url: coverUrl || null,
            title: "ARCHIVE FIT",
            tag: "ARCHIVE",
            is_vault: true,
            year: document.getElementById("archive-year").value.trim() || null,
          }, ["artist_id", "title", "tag", "is_vault", "year", "image_urls", "date"]);
          outfitId = outfit?.id || null;
          if (outfitId) {
            await insertLoose("items", { ...row, outfit_id: outfitId }, optional);
            return;
          }
        }
        throw err;
      }
    }
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card.brand && !card.title) {
        if (card.id) await restWrite({ op: "delete", table: "items", id: card.id });
        continue;
      }
      await writeItem(card, i, outfitId ? { outfit_id: outfitId } : {});
    }
  }

  async function finishArchivePublish() {
    const name = document.getElementById("archive-name").value.trim().toUpperCase();
    const year = document.getElementById("archive-year").value.trim();
    const artistId = document.getElementById("archive-star").value || null;
    const msg = document.getElementById("archive-edit-msg");
    if (!name) throw new Error("CELEBRITY NAME REQUIRED.");
    if (!/^\d{4}$/.test(year)) throw new Error("YEAR REQUIRED. FOUR DIGITS.");
    if (!archivePhotos.length) throw new Error("ADD AN HD PHOTO FIRST.");
    snack(editingArchive ? "SAVING…" : "UPLOADING…");
    if (msg) msg.textContent = "SAVING…";
    const imageUrls = await collectArchiveUrls();
    const row = {
      artist_id: artistId,
      artist_name: name,
      artist: name,
      name,
      year,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      tag: "ARCHIVE",
      title: "",
    };
    let archive = editingArchive;
    if (archive?.id) {
      await patchLoose("archives", archive.id, row, ARCHIVE_OPTIONAL);
    } else {
      archive = await insertLoose("archives", row, ARCHIVE_OPTIONAL);
    }
    if (!archive?.id) throw new Error("ARCHIVE ROW FAILED.");
    await saveArchiveItems(archive.id, artistId, imageUrls[0]);
  }

  async function deleteArchiveFit(row) {
    if (!row?.id) return;
    if (!window.confirm("DELETE THIS ARCHIVE FIT AND ITS PRODUCT CARDS?")) return;
    snack("DELETING…");
    try {
      let items = [];
      try {
        items = await loadFiltered("items", { archive_id: row.id });
      } catch {
        items = [];
      }
      for (const item of items) {
        if (item.id) await restWrite({ op: "delete", table: "items", id: item.id });
      }
      await restWrite({ op: "delete", table: "archives", id: row.id });
      snack("ARCHIVE FIT DELETED.");
      await loadArchiveFits();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  }

  async function openArchiveDesk() {
    showScreen("archive");
    fillArchiveStars();
    await loadArchiveFits();
  }

  backBtn.addEventListener("click", () => {
    if (screen === "card") {
      captureCardForm();
      if (cardIndex > 0) {
        cardIndex -= 1;
        paintCardForm();
        return;
      }
      showScreen(mode === "archive" ? "archive-edit" : "photo");
      return;
    }
    if (screen === "star") {
      showScreen(editingId && selected ? "artist" : "pick");
      return;
    }
    if (screen === "photo") {
      resetCompose();
      showScreen(selected ? "artist" : "pick");
      return;
    }
    if (screen === "news-edit") {
      showScreen("news");
      return;
    }
    if (screen === "news") {
      showScreen("pick");
      return;
    }
    if (screen === "archive-edit") {
      showScreen("archive");
      return;
    }
    if (screen === "archive") {
      showScreen("pick");
      return;
    }
    if (screen === "pr") {
      showScreen("pick");
      return;
    }
    if (screen === "members") {
      showScreen("pick");
      return;
    }
    if (screen === "stats") {
      showScreen("pick");
      return;
    }
    if (screen === "artist") showScreen("pick");
  });

  document.getElementById("open-tables").addEventListener("click", async () => {
    showTablesView();
    const names = await listTables();
    renderTables(names);
    await openTable(names.includes("artists") ? "artists" : names[0]);
  });
  document.getElementById("open-news").addEventListener("click", () => openNewsDesk());
  document.getElementById("open-archive").addEventListener("click", () => openArchiveDesk());
  document.getElementById("open-pr")?.addEventListener("click", () => openPrDesk());
  document.getElementById("open-members").addEventListener("click", () => openMembersDesk());
  document.getElementById("open-stats").addEventListener("click", () => openStatsDesk());
  document.getElementById("archive-add").addEventListener("click", () => openArchiveEdit(null));
  document.getElementById("archive-next").addEventListener("click", () => {
    const name = document.getElementById("archive-name").value.trim();
    const year = document.getElementById("archive-year").value.trim();
    if (!name) {
      snack("CELEBRITY NAME REQUIRED.", true);
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      snack("YEAR REQUIRED. FOUR DIGITS.", true);
      return;
    }
    if (!archivePhotos.length) {
      snack("ADD AN HD PHOTO FIRST.", true);
      return;
    }
    mode = "archive";
    cardIndex = 0;
    paintCardForm();
    showScreen("card");
  });
  document.getElementById("archive-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await pickHd(file, "fit");
      const href = previewUrl(blob);
      if (archivePick >= 0 && archivePick < archivePhotos.length) {
        forgetPreview(archivePhotos[archivePick].preview);
        archivePhotos[archivePick] = { blob, preview: href, url: "" };
        archiveSlide = archivePick;
      } else if (archivePhotos.length < MAX_PHOTOS) {
        archivePhotos.push({ blob, preview: href, url: "" });
        archiveSlide = archivePhotos.length - 1;
      } else {
        snack(`MAX ${MAX_PHOTOS} PHOTOS.`, true);
        URL.revokeObjectURL(href);
        return;
      }
      archivePick = -1;
      paintArchiveScroller();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });
  document.getElementById("archive-name").addEventListener("input", paintArchiveBar);
  document.getElementById("archive-year").addEventListener("input", paintArchiveBar);
  document.getElementById("archive-star").addEventListener("change", () => {
    const id = document.getElementById("archive-star").value;
    const star = artists.find((a) => a.id === id);
    if (star?.name) document.getElementById("archive-name").value = String(star.name).toUpperCase();
    paintArchiveBar();
  });
  document.getElementById("news-add").addEventListener("click", () => openNewsEdit(null));
  document.getElementById("news-save").addEventListener("click", saveNews);
  document.getElementById("news-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await pickHd(file, "news");
      const href = previewUrl(blob);
      if (newsPick >= 0 && newsPick < newsPhotos.length) {
        forgetPreview(newsPhotos[newsPick].preview);
        newsPhotos[newsPick] = { blob, preview: href, url: "" };
        newsSlide = newsPick;
      } else if (newsPhotos.length < MAX_NEWS_PHOTOS) {
        newsPhotos.push({ blob, preview: href, url: "" });
        newsSlide = newsPhotos.length - 1;
      } else {
        snack(`MAX ${MAX_NEWS_PHOTOS} PHOTOS.`, true);
        URL.revokeObjectURL(href);
        return;
      }
      newsPick = -1;
      paintNewsScroller();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });
  ["news-pname", "news-pdate", "news-purl", "news-pnote", "news-sku"].forEach((id) => {
    document.getElementById(id).addEventListener("input", paintNewsPlate);
  });
  document.getElementById("tables-back").addEventListener("click", () => {
    showDesk();
    showScreen("pick");
  });

  function parseCell(raw) {
    const t = raw.trim();
    if (t === "") return null;
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try { return JSON.parse(t); } catch { return raw; }
    }
    return raw;
  }

  function cellText(v) {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  function asListingArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    }
    return [];
  }

  function listingFromFields(storeEl, urlEl, priceEl) {
    const store = (storeEl?.value || "").trim();
    const href = normalizeHref(urlEl?.value || "");
    const price = (priceEl?.value || "").trim();
    if (!store && !href && !price) return null;
    const row = {};
    if (store) row.store = store;
    if (href) row.url = href;
    if (price) row.price = price;
    return row;
  }

  function readListings(root) {
    const out = [];
    root.querySelectorAll(".listing-row").forEach((block) => {
      const row = listingFromFields(
        block.querySelector("[data-ls='store']"),
        block.querySelector("[data-ls='url']"),
        block.querySelector("[data-ls='price']"),
      );
      if (row) out.push(row);
    });
    return out;
  }

  function addTableListingRow(root, listing) {
    const row = document.createElement("div");
    row.className = "listing-row";
    const store = document.createElement("input");
    store.dataset.ls = "store";
    store.placeholder = "STORE";
    store.value = listing?.store ? String(listing.store) : "";
    const href = document.createElement("input");
    href.dataset.ls = "url";
    href.placeholder = "https://";
    href.value = listing?.url ? String(listing.url) : "";
    const price = document.createElement("input");
    price.dataset.ls = "price";
    price.placeholder = "PRICE";
    price.value = listing?.price ? String(listing.price) : "";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "X";
    del.addEventListener("click", () => {
      row.remove();
      if (!root.querySelector(".listing-row")) addTableListingRow(root, null);
    });
    row.append(store, href, price, del);
    root.appendChild(row);
  }

  function fillListingEditor(root, raw) {
    root.replaceChildren();
    const list = storeListings(raw);
    if (!list.length) {
      addTableListingRow(root, null);
      return;
    }
    for (const item of list) addTableListingRow(root, item);
  }

  function renderListingsEditor(raw) {
    const wrap = document.createElement("div");
    wrap.className = "listing-ed";
    const list = document.createElement("div");
    list.className = "listing-list";
    fillListingEditor(list, raw);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "listing-add";
    add.textContent = "Add URL";
    add.addEventListener("click", () => addTableListingRow(list, null));
    wrap.append(list, add);
    return wrap;
  }

  async function listTables() {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return fallbackTables.slice();
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/openapi+json" },
      });
      if (!res.ok) return fallbackTables.slice();
      const spec = await res.json();
      const names = Object.keys(spec.paths || {})
        .map((p) => p.replace(/^\//, ""))
        .filter((p) => p && !p.includes("/") && !p.includes("{") && p !== "rpc");
      const uniq = [...new Set(names)];
      const skip = new Set(["users"]);
      const head = preferred.filter((t) => uniq.includes(t) && !skip.has(t));
      const rest = uniq.filter((t) => !preferred.includes(t) && !skip.has(t)).sort();
      return head.concat(rest);
    } catch {
      return fallbackTables.slice();
    }
  }

  function renderTables(names) {
    tablesEl.replaceChildren();
    for (const name of names) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.dataset.table = name;
      if (name === table) b.classList.add("on");
      b.addEventListener("click", () => openTable(name));
      tablesEl.appendChild(b);
    }
  }

  function renderTableGrid() {
    gridEl.replaceChildren();
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = table ? "No rows (or RLS hid them)." : "";
      gridEl.appendChild(p);
      return;
    }
    const keys = columns.length ? columns.slice() : Object.keys(rows[0]);
    const tableEl = document.createElement("table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const k of keys) {
      const th = document.createElement("th");
      th.textContent = k;
      hr.appendChild(th);
    }
    const thAct = document.createElement("th");
    hr.appendChild(thAct);
    thead.appendChild(hr);
    tableEl.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      for (const k of keys) {
        const td = document.createElement("td");
        if (k === "id") td.className = "pk";
        if (table === "items" && k === "availability") {
          const select = document.createElement("select");
          AVAIL.forEach((opt) => {
            const o = document.createElement("option");
            o.value = opt.id;
            o.textContent = opt.label;
            select.appendChild(o);
          });
          select.value = availabilityFromItem(row);
          select.dataset.i = String(idx);
          select.dataset.k = k;
          td.appendChild(select);
        } else if (table === "items" && k === "listings") {
          td.className = "listings-cell";
          td.appendChild(renderListingsEditor(row[k]));
        } else {
          const input = document.createElement("input");
          input.value = cellText(row[k]);
          input.dataset.i = String(idx);
          input.dataset.k = k;
          if (k === "purchase_url") input.placeholder = "https://";
          td.appendChild(input);
        }
        tr.appendChild(td);
      }
      const tdAct = document.createElement("td");
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "Save";
      save.addEventListener("click", () => saveRow(idx, tr));
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Del";
      del.addEventListener("click", () => deleteRow(idx));
      tdAct.append(save, del);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    gridEl.appendChild(tableEl);
  }

  function patchFromRow(tr) {
    const patch = {};
    tr.querySelectorAll("[data-k]").forEach((input) => {
      patch[input.dataset.k] = parseCell(input.value);
    });
    if (table === "items" && columns.includes("listings")) {
      const ed = tr.querySelector(".listing-ed");
      if (ed) {
        const idx = [...tr.parentNode.children].indexOf(tr);
        const availability = normalizeAvail(patch.availability || availabilityFromItem(rows[idx]));
        patch.listings = stampAvailability(readListings(ed), availability);
        patch.availability = availability;
      }
    }
    return patch;
  }

  function listingsColumnError(message) {
    const msg = message || "";
    if (/listings/i.test(msg) && /column|schema/i.test(msg)) {
      return `${msg} Nazım SQL: ALTER TABLE public.items ADD COLUMN IF NOT EXISTS listings jsonb;`;
    }
    if (/availability/i.test(msg) && /column|schema/i.test(msg)) {
      return `${msg} Nazım SQL: ALTER TABLE public.items ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'in_stock';`;
    }
    return msg;
  }

  async function openTable(name) {
    table = name;
    insertBox.classList.remove("on");
    insertUrls.classList.remove("on");
    tableNameEl.textContent = name;
    reloadBtn.hidden = false;
    newRowBtn.hidden = false;
    tablesEl.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("on", b.dataset.table === name);
    });
    setDeskMsg("Loading…");
    const { data, error } = await sb.from(name).select("*").limit(200);
    if (error) {
      rows = [];
      columns = [];
      renderTableGrid();
      setDeskMsg(error.message, "err");
      return;
    }
    rows = Array.isArray(data) ? data : [];
    columns = rows.length ? Object.keys(rows[0]) : [];
    renderTableGrid();
    setDeskMsg(`${rows.length} row(s).`, "ok");
  }

  async function saveRow(idx, tr) {
    const prev = rows[idx];
    const patch = patchFromRow(tr);
    if (prev?.id == null) {
      setDeskMsg("Row has no id; insert instead.", "err");
      return;
    }
    setDeskMsg("Saving…");
    try {
      await restWrite({ op: "update", table, id: prev.id, patch });
    } catch (error) {
      setDeskMsg(listingsColumnError(error.message), "err");
      return;
    }
    await openTable(table);
    setDeskMsg("Saved.", "ok");
  }

  async function deleteRow(idx) {
    const prev = rows[idx];
    if (prev?.id == null) return;
    if (!window.confirm(`Delete ${table} ${prev.id}?`)) return;
    try {
      await restWrite({ op: "delete", table, id: prev.id });
    } catch (error) {
      setDeskMsg(error.message, "err");
      return;
    }
    await openTable(table);
    setDeskMsg("Deleted.", "ok");
  }

  async function insertRow() {
    let payload;
    try {
      payload = JSON.parse(insertJson.value || "{}");
    } catch {
      setDeskMsg("Insert JSON is invalid.", "err");
      return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      setDeskMsg("Insert JSON must be an object.", "err");
      return;
    }
    if (table === "items") {
      const listings = readListings(insertUrlRows);
      const availability = normalizeAvail(payload.availability);
      if (listings.length || columns.includes("listings")) {
        payload.listings = stampAvailability(listings, availability);
      }
      payload.availability = availability;
    }
    try {
      await restWrite({ op: "insert", table, row: payload });
    } catch (error) {
      setDeskMsg(listingsColumnError(error.message), "err");
      return;
    }
    insertBox.classList.remove("on");
    insertJson.value = "";
    await openTable(table);
    setDeskMsg("Inserted.", "ok");
  }

  async function bootDesk(user) {
    showDesk();
    whoEl.textContent = user.email || user.id;
    showScreen("pick");
    await loadArtists();
  }

  document.getElementById("signout").addEventListener("click", async () => {
    await sb.auth.signOut();
    window.location.href = "/cdn-cgi/access/logout";
  });

  reloadBtn.addEventListener("click", () => {
    if (table) openTable(table);
  });

  newRowBtn.addEventListener("click", () => {
    insertBox.classList.add("on");
    const sample = {};
    for (const k of columns) {
      if (k === "id" || k === "listings") continue;
      sample[k] = null;
    }
    insertJson.value = JSON.stringify(sample, null, 2);
    const isItems = table === "items";
    insertUrls.classList.toggle("on", isItems);
    if (isItems) fillListingEditor(insertUrlRows, null);
    else insertUrlRows.replaceChildren();
  });

  document.getElementById("insert-save").addEventListener("click", insertRow);
  document.getElementById("insert-cancel").addEventListener("click", () => {
    insertBox.classList.remove("on");
    insertUrls.classList.remove("on");
  });
  document.getElementById("insert-url-add").addEventListener("click", () => {
    addTableListingRow(insertUrlRows, null);
  });

  const vaultForm = document.getElementById("gate-vault");
  if (vaultForm) {
    vaultForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const input = document.getElementById("vault-key");
      const value = (input && input.value || "").trim();
      showGate("");
      try {
        const res = await fetch("/api/vault", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `VAULT ${res.status}`);
        if (input) input.value = "";
        const copy = document.getElementById("gate-copy");
        if (copy) copy.textContent = "Connecting to the archive";
        await enterStudio();
      } catch (e) {
        showGate(e.message || String(e));
      }
    });
  }

  (async () => {
    showGate("");
    const copy = document.getElementById("gate-copy");
    if (copy) copy.textContent = "Connecting to the archive";
    try {
      await enterStudio();
    } catch (e) {
      if (e.code === "NEED_VAULT" || e.message === "NEED_VAULT") showVault();
      else showGate(e.message || String(e));
    }
  })();
})();
