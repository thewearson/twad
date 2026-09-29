(() => {
  const url = window.WEARS_SUPABASE_URL;
  const key = window.WEARS_SUPABASE_ANON_KEY;
  const preferred = ["artists", "outfits", "items", "archives"];
  const fallbackTables = ["artists", "outfits", "items", "archives", "comments"];
  const REGIONS = ["ALL", "USA", "TR", "EU", "CANADA", "ASIA", "AFRICA"];
  const COUNTRIES = [
    "UNITED STATES", "CANADA", "TÜRKİYE", "UNITED KINGDOM", "FRANCE", "GERMANY",
    "ITALY", "SPAIN", "NETHERLANDS", "POLAND", "PORTUGAL", "UKRAINE", "JAPAN",
    "SOUTH KOREA", "CHINA", "NIGERIA", "BARBADOS", "AUSTRALIA",
  ];
  const MAX_CARDS = 3;
  const MAX_PHOTOS = 3;
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
  };

  function isJpegFile(file) {
    const type = (file.type || "").toLowerCase();
    const name = file.name || "";
    return type.includes("jpeg") || type.includes("jpg") || /\.jpe?g$/i.test(name);
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
    if (!spec.square && isJpegFile(file) && long <= spec.maxEdge && file.size <= 8 * 1024 * 1024) {
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

  async function insertLoose(tableName, payload, optionalKeys) {
    let row = { ...payload };
    let keys = optionalKeys.slice();
    for (;;) {
      try {
        const out = await restWrite({ op: "insert", table: tableName, row });
        return out.row;
      } catch (error) {
        const msg = error.message || "";
        const hit = keys.find((k) => msg.toLowerCase().includes(k.toLowerCase()));
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
      artistPosts = outfits;
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
    document.getElementById("card-next").textContent = last
      ? (editingOutfit ? "Save fit check" : "Post fit check")
      : "Next card";
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
        urls.push(await uploadJpeg(`${folder}/${selected.id}/${crypto.randomUUID()}.jpg`, slot.blob));
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
        itemUrl = await uploadJpeg(`items/${outfitId}/${i + 1}-${crypto.randomUUID().slice(0, 6)}.jpg`, card.imageBlob);
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

  document.getElementById("card-next").addEventListener("click", async () => {
    captureCardForm();
    if (cardIndex < MAX_CARDS - 1) {
      cardIndex += 1;
      paintCardForm();
      return;
    }
    try {
      await finishFitPublish();
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
      await finishFitPublish();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  backBtn.addEventListener("click", () => {
    if (screen === "card") {
      captureCardForm();
      if (cardIndex > 0) {
        cardIndex -= 1;
        paintCardForm();
        return;
      }
      showScreen("photo");
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
    if (screen === "artist") showScreen("pick");
  });

  document.getElementById("open-tables").addEventListener("click", async () => {
    showTablesView();
    const names = await listTables();
    renderTables(names);
    await openTable(names.includes("artists") ? "artists" : names[0]);
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
