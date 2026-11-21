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
  const MAX_CARDS = 5;
  const MAX_PHOTOS = 3;
  const MAX_NEWS_PHOTOS = 5;
  const NEWS_CATS = ["CULTURE", "RELEASE", "ARCHIVE", "STREET", "MUSIC & FIT"];
  const NEWS_OPTIONAL = [
    "dek", "body", "source", "image_url", "image_urls",
    "product_name", "release_date", "buy_url", "buy_note", "sku", "category",
    "drop_json",
  ];
  const VICE_NEWS_ID = "8cbc034c-8bee-4f9f-a7c9-9b32672e1e65";
  const VICE_AT = "2026-11-20T15:00:00Z";
  const AF1_NEWS_ID = "75460ba6-0d53-402b-ad25-7a5a5a36dc7e";
  const AF1_SHAPE_ID = "93e33b2f-e4e0-494d-b43d-34609210ab13";
  const AF1_NEWS_IDS = [AF1_NEWS_ID, AF1_SHAPE_ID];
  const AF1_AT = "2026-11-21T15:00:00Z";
  const VICE_STORES = [
    { id: "nba", label: "NBA Store", url: "https://store.nba.com" },
    { id: "fanatics", label: "Fanatics", url: "https://www.fanatics.com/nba/o-1370+z-938737729-293541727" },
    { id: "nike", label: "Nike SNKRS", url: "https://www.nike.com/launch" },
    { id: "cactus", label: "Cactus Jack", url: "https://shop.travisscott.com" },
  ];
  const AF1_STORES = [
    { id: "snkrs", label: "Nike SNKRS", url: "https://www.nike.com/launch" },
    { id: "cactus", label: "Cactus Jack", url: "https://shop.travisscott.com" },
  ];
  const AF1_NOTE = "Nov 21 • 10:00 AM ET • AF1 Black & White + Apparel\nNov 23 • Gradient Camo & Full Lineup";
  const VANS_NEWS_ID = "7768da16-8167-4ea3-ba32-6dd13f884f47";
  const VANS_STORES = [
    { id: "goat", label: "GOAT", url: "https://www.goat.com/product/vans-lx-old-skool-36-pack-yacht-club-multi-color-vn000e8vbgk" },
  ];
  let dropOn = false;
  let dropDefault = 0;
  let dropSending = false;
  let dropEmailOffset = 0;
  let dropEmailN = 0;
  let dropEmailQ = "";
  let dropSentIds = new Set();
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
  let guestArtist = null;
  let coupleOpen = false;
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
    return Array.from({ length: MAX_CARDS }, emptyCard);
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

  const FILE_CAP = 48 * 1024 * 1024;
  const UPLOAD_BUDGET = 4.5 * 1024 * 1024;

  function canvasBlob(paint, type, quality) {
    const canvas = document.createElement("canvas");
    paint(canvas);
    return new Promise((resolve) => {
      const finish = (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob || null);
      };
      try {
        if (type === "image/png") canvas.toBlob(finish, "image/png");
        else canvas.toBlob(finish, type, quality);
      } catch {
        finish(null);
      }
    });
  }

  function imageIsCutout(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return false;
    const sw = Math.min(96, w);
    const sh = Math.min(96, h);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: true });
    if (!ctx) return false;
    try {
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, 0, 0, sw, sh);
      const data = ctx.getImageData(0, 0, sw, sh).data;
      let clear = 0;
      const n = sw * sh;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 245) clear += 1;
      }
      return clear > n * 0.015;
    } catch {
      return false;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  function blobLooksCutout(blob) {
    if (!blob) return false;
    if (isJpegFile(blob)) return false;
    const t = `${blob.type || ""} ${blob.name || ""}`;
    return /png|webp/i.test(t);
  }

  function urlLooksCutout(href) {
    return /\.(png|webp)(?:$|\?|#)/i.test(String(href || ""));
  }

  async function encodeHd(source, spec, srcW, srcH, opt = {}) {
    const keepAlpha = !!opt.keepAlpha;
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (spec.square) {
      const s = Math.min(srcW, srcH);
      sx = Math.floor((srcW - s) / 2);
      sy = Math.floor((srcH - s) / 2);
      sw = s;
      sh = s;
    }
    let dw = sw;
    let dh = sh;
    const long = Math.max(dw, dh);
    if (long > spec.maxEdge) {
      const k = spec.maxEdge / long;
      dw = Math.max(1, Math.round(dw * k));
      dh = Math.max(1, Math.round(dh * k));
    }
    const paint = (canvas, w, h) => {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { alpha: keepAlpha });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (keepAlpha) ctx.clearRect(0, 0, w, h);
      else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    };
    if (keepAlpha) {
      let blob = await canvasBlob((c) => paint(c, dw, dh), "image/webp", 0.92);
      if (!blob || !String(blob.type || "").includes("webp")) {
        blob = await canvasBlob((c) => paint(c, dw, dh), "image/png");
      }
      let guard = 0;
      while (blob && blob.size > UPLOAD_BUDGET && Math.min(dw, dh) > 32 && guard < 6) {
        dw = Math.max(32, Math.round(dw * 0.82));
        dh = Math.max(32, Math.round(dh * 0.82));
        const type = String(blob.type || "").includes("webp") ? "image/webp" : "image/png";
        blob = await canvasBlob((c) => paint(c, dw, dh), type, 0.86);
        guard += 1;
      }
      if (!blob) throw new Error("PHOTO FAILED.");
      if (blob.size > 16 * 1024 * 1024) throw new Error("PHOTO TOO HEAVY. TRY A SMALLER EXPORT.");
      return blob;
    }
    let quality = spec.quality;
    let blob = await canvasBlob((c) => paint(c, dw, dh), "image/jpeg", quality);
    while (blob && blob.size > UPLOAD_BUDGET && quality > 0.72) {
      quality -= 0.08;
      blob = await canvasBlob((c) => paint(c, dw, dh), "image/jpeg", quality);
    }
    let guard = 0;
    while (blob && blob.size > UPLOAD_BUDGET && Math.min(dw, dh) > 32 && guard < 4) {
      dw = Math.max(32, Math.round(dw * 0.82));
      dh = Math.max(32, Math.round(dh * 0.82));
      blob = await canvasBlob((c) => paint(c, dw, dh), "image/jpeg", 0.86);
      guard += 1;
    }
    if (!blob) throw new Error("PHOTO FAILED.");
    if (blob.size > 16 * 1024 * 1024) throw new Error("PHOTO TOO HEAVY. TRY A SMALLER EXPORT.");
    return blob;
  }

  const HD = {
    pp: { maxEdge: 1080, square: true, quality: 0.92 },
    fit: { maxEdge: 2560, square: false, quality: 0.96 },
    story: { maxEdge: 2560, square: false, quality: 0.96 },
    item: { maxEdge: 2200, square: false, quality: 0.96 },
    news: { maxEdge: 4096, square: false, quality: 0.92 },
  };

  function isJpegFile(file) {
    const type = (file.type || "").toLowerCase();
    const name = file.name || "";
    return type.includes("jpeg") || type.includes("jpg") || /\.jpe?g$/i.test(name);
  }

  function isPassFile(file) {
    const type = (file.type || "").toLowerCase();
    const name = file.name || "";
    return isJpegFile(file)
      || type.includes("png") || /\.png$/i.test(name)
      || type.includes("webp") || /\.webp$/i.test(name);
  }

  function photoExt(blob) {
    const t = (blob.type || "").toLowerCase();
    if (t.includes("png")) return "png";
    if (t.includes("webp")) return "webp";
    return "jpg";
  }

  async function pickHd(file, kind) {
    if (!file) throw new Error("NO PHOTO.");
    if (file.size > FILE_CAP) throw new Error("PHOTO OVER 48MB. EXPORT A JPG.");
    const spec = HD[kind];
    if (file.size > 6 * 1024 * 1024) snack("COMPRESSING PHOTO…");
    const href = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("UNREADABLE PHOTO. USE JPG / PNG / WEBP."));
        img.src = href;
      });
      if (img.decode) await img.decode().catch(() => {});
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      if (!srcW || !srcH) {
        if (file.size <= 16 * 1024 * 1024) return file;
        throw new Error("UNREADABLE PHOTO. USE JPG / PNG / WEBP.");
      }
      const cutout = kind === "news" && imageIsCutout(img);
      if (!spec.square && file.size <= UPLOAD_BUDGET) {
        if (isJpegFile(file)) return file;
        if (cutout) return file;
      }
      try {
        return await encodeHd(img, spec, srcW, srcH, { keepAlpha: cutout });
      } catch {
        if (file.size <= 16 * 1024 * 1024) return file;
        throw new Error("PHOTO FAILED.");
      }
    } catch (err) {
      if (file.size <= 16 * 1024 * 1024) return file;
      throw err;
    } finally {
      URL.revokeObjectURL(href);
    }
  }

  function previewUrl(blob) {
    return blob ? URL.createObjectURL(blob) : "";
  }

  async function pinFiles(fileList) {
    const out = [];
    for (const file of fileList || []) {
      if (!file) continue;
      const buf = await file.arrayBuffer();
      out.push(new File([buf], file.name || "photo.jpg", { type: file.type || "image/jpeg", lastModified: file.lastModified || Date.now() }));
    }
    return out;
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
      else if (filter.guest_artist_id) q = q.eq("guest_artist_id", filter.guest_artist_id);
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
  function guestIdOf(row) {
    return String(row?.guest_artist_id || row?.guestArtistId || "").trim();
  }
  function artistById(id) {
    if (!id) return null;
    return artists.find((a) => a.id === id) || null;
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
      try {
        const asGuest = await loadFiltered("outfits", { guest_artist_id: selected.id });
        const seen = new Set(outfits.map((o) => o.id).filter(Boolean));
        for (const row of asGuest) {
          if (row?.id && !seen.has(row.id)) {
            seen.add(row.id);
            outfits.push(row);
          }
        }
      } catch {}
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
      const guest = artistById(guestIdOf(post));
      n.textContent = isStoryPost(post)
        ? "STORY"
        : guest
          ? `COUPLE · ${guest.name} · ${count} CARD${count === 1 ? "" : "S"}`
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
    guestArtist = artistById(guestIdOf(post));
    coupleOpen = false;
    paintPhotoScroller();
    paintCouple();
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
    guestArtist = null;
    coupleOpen = false;
    photos.forEach((p) => forgetPreview(p.preview));
    photos = [];
    photoSlide = 0;
    photoPick = -1;
    cardIndex = 0;
    cards = emptyCards();
    const q = document.getElementById("couple-q");
    if (q) q.value = "";
  }

  function paintCoupleHits() {
    const host = document.getElementById("couple-hits");
    if (!host) return;
    host.replaceChildren();
    const q = String(document.getElementById("couple-q")?.value || "").trim().toUpperCase();
    const hits = artists.filter((a) => {
      if (!a.id || a.id === selected?.id) return false;
      if (guestArtist?.id && a.id === guestArtist.id) return false;
      if (!q) return true;
      return String(a.name || "").toUpperCase().includes(q);
    }).slice(0, 12);
    if (!hits.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.style.padding = "12px";
      empty.textContent = q ? "NO MATCH." : "TYPE A STAR NAME.";
      host.appendChild(empty);
      return;
    }
    hits.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "couple-hit";
      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, a, 36);
      const n = document.createElement("span");
      n.textContent = a.name || "";
      b.append(av, n);
      b.addEventListener("click", () => {
        guestArtist = a;
        coupleOpen = false;
        document.getElementById("couple-q").value = "";
        paintCouple();
      });
      host.appendChild(b);
    });
  }

  function paintCouple() {
    const box = document.getElementById("couple-box");
    const on = document.getElementById("couple-on");
    const add = document.getElementById("couple-add");
    const search = document.getElementById("couple-search");
    if (!box || !on || !add || !search) return;
    const show = mode === "fit";
    box.classList.toggle("hidden", !show);
    if (!show) return;
    on.replaceChildren();
    if (guestArtist) {
      on.classList.remove("hidden");
      add.classList.add("hidden");
      search.classList.add("hidden");
      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, guestArtist, 44);
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<div class="kind">IN FRAME</div><div class="name"></div>`;
      meta.querySelector(".name").textContent = guestArtist.name || "";
      const x = document.createElement("button");
      x.type = "button";
      x.className = "btn sq";
      x.setAttribute("aria-label", "Remove second star");
      x.textContent = "X";
      x.addEventListener("click", () => {
        guestArtist = null;
        coupleOpen = false;
        paintCouple();
      });
      on.append(av, meta, x);
      return;
    }
    on.classList.add("hidden");
    add.classList.remove("hidden");
    add.textContent = coupleOpen ? "Close" : "Add second star";
    search.classList.toggle("hidden", !coupleOpen);
    if (coupleOpen) paintCoupleHits();
  }

  function goFit() {
    mode = "fit";
    resetCompose();
    document.getElementById("photo-step").textContent = "Fit check · photos";
    document.getElementById("photo-hint").textContent = "Up to 3. Swipe like Instagram. Centered on the plate.";
    document.getElementById("photo-next").textContent = "Next";
    paintPhotoScroller();
    paintCouple();
    showScreen("photo");
  }

  function goStory() {
    mode = "story";
    resetCompose();
    document.getElementById("photo-step").textContent = "Story · photo";
    document.getElementById("photo-hint").textContent = "One frame. 9:16 like Instagram Stories. Centered on the plate.";
    document.getElementById("photo-next").textContent = "Post story";
    paintPhotoScroller();
    paintCouple();
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
    const guestId = kind === "fit" && guestArtist?.id && guestArtist.id !== selected.id ? guestArtist.id : null;
    if (editingOutfit?.id) {
      await patchLoose("outfits", editingOutfit.id, {
        image_url: imageUrl,
        image_urls: imageUrls,
        guest_artist_id: guestId,
      }, ["image_urls", "guest_artist_id"]);
      if (kind === "fit") await saveOutfitItems(editingOutfit.id);
      return editingOutfit;
    }
    const outfit = await insertLoose("outfits", {
      artist_id: selected.id,
      guest_artist_id: guestId,
      image_url: imageUrl,
      image_urls: imageUrls,
      title: kind === "story" ? "STORY" : "FIT CHECK",
      date: new Date().toISOString(),
      is_vault: false,
    }, ["title", "date", "is_vault", "image_urls", "guest_artist_id"]);
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
        const hit = keys.find((k) => optionalKeyInError(msg, k));
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
      snack("STAR PP REQUIRED.", true);
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
    const [file] = await pinFiles(e.target.files);
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
  document.getElementById("couple-add").addEventListener("click", () => {
    coupleOpen = !coupleOpen;
    paintCouple();
    if (coupleOpen) document.getElementById("couple-q")?.focus();
  });
  document.getElementById("couple-q").addEventListener("input", paintCoupleHits);

  document.getElementById("fit-file").addEventListener("change", async (e) => {
    const [file] = await pinFiles(e.target.files);
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
    const [file] = await pinFiles(e.target.files);
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
      if (typeof v === "object") return;
      const s = String(v).trim();
      if (!s || s === "null" || s === "[object Object]" || out.includes(s) || out.length >= MAX_NEWS_PHOTOS) return;
      if (!/^https?:\/\//i.test(s) && !s.startsWith("blob:")) return;
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

  function looksViceCity(row) {
    if (String(row?.id || "") === VICE_NEWS_ID) return true;
    const s = `${row?.title || ""} ${row?.dek || ""} ${row?.body || ""} ${row?.product_name || ""}`.toUpperCase();
    return s.includes("MIAMI HEAT") && s.includes("CACTUS JACK");
  }
  function looksAf1(row) {
    const id = String(row?.id || "").toLowerCase();
    if (AF1_NEWS_IDS.includes(id)) return true;
    const title = String(row?.title || "").toUpperCase();
    if (!title || title.includes("MIAMI HEAT")) return false;
    return title.includes("GTA 6") && title.includes("TRAVIS SCOTT");
  }
  function looksVans(row) {
    return String(row?.id || "").toLowerCase() === VANS_NEWS_ID;
  }
  function currentDropKit() {
    const title = document.getElementById("news-title")?.value || "";
    if (looksAf1(editingNews) || looksAf1({ title })) {
      return { at: AF1_AT, stores: AF1_STORES, defaultId: "snkrs" };
    }
    if (looksVans(editingNews) || looksVans({ id: editingNews?.id })) {
      return { at: "", stores: VANS_STORES, defaultId: "goat" };
    }
    if (looksViceCity(editingNews) || looksViceCity({ title })) {
      return { at: VICE_AT, stores: VICE_STORES, defaultId: "nba" };
    }
    return { at: VICE_AT, stores: VICE_STORES, defaultId: "nba" };
  }
  function isoToLocalInput(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function localInputToIso(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  function parseDropJson(raw) {
    if (!raw) return null;
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  }
  function parseDropNote(note) {
    const lines = String(note || "").split(/\r?\n/);
    const stores = [];
    const human = [];
    let at = "";
    let off = false;
    for (const line of lines) {
      const t0 = line.trim();
      if (!t0) continue;
      if (/^AT\s+OFF$/i.test(t0) || /^DROP_OFF$/i.test(t0)) { off = true; continue; }
      const atM = t0.match(/^AT\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*$/i);
      if (atM) { at = atM[1].endsWith("Z") ? atM[1] : `${atM[1]}Z`; continue; }
      const sm = t0.match(/^(.+?)\s+(https?:\/\/\S+)\s*$/i);
      if (sm) {
        stores.push({ label: sm[1].trim(), url: sm[2].trim() });
        continue;
      }
      human.push(t0);
    }
    return { at, stores, note: human.join("\n"), off };
  }
  function packDropNote(human, drop) {
    if (!drop?.on) return String(human || "").trim();
    const lines = [];
    const h = String(human || "").trim();
    if (h) lines.push(h);
    lines.push(`AT ${drop.at}`);
    (drop.stores || []).forEach((s) => {
      if (s.label && s.url) lines.push(`${s.label} ${s.url}`);
    });
    return lines.join("\n");
  }
  function dropStoresFromFields() {
    const kit = currentDropKit();
    const stores = [];
    for (let i = 1; i <= 4; i += 1) {
      const label = document.getElementById(`drop-l${i}`)?.value.trim() || "";
      const url = document.getElementById(`drop-u${i}`)?.value.trim() || "";
      if (!label && !url) continue;
      const href = /^https?:\/\//i.test(url) ? url : url ? `https://${url.replace(/^\/+/, "")}` : "";
      stores.push({
        id: studioStoreId(label, href, kit.stores[i - 1]?.id || `s${i}`),
        label: label || kit.stores[i - 1]?.label || `STORE ${i}`,
        url: href,
      });
    }
    return stores;
  }
  function paintDropHint() {
    const iso = localInputToIso(document.getElementById("drop-at")?.value || "");
    const el = document.getElementById("drop-at-hint");
    if (!el) return;
    if (!iso) {
      el.textContent = "10:00 AM ET = 15:00 UTC = 18:00 TSİ";
      return;
    }
    const et = new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    el.textContent = `${et} ET · ${iso}`;
  }
  function paintDropToggle() {
    const host = document.getElementById("drop-toggle");
    if (!host) return;
    host.innerHTML = "";
    [["Off", false], ["On", true]].forEach(([label, on]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (dropOn === on ? " on" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        dropOn = on;
        if (dropOn) {
          const kit = currentDropKit();
          const at = document.getElementById("drop-at");
          if (at && !at.value) at.value = isoToLocalInput(kit.at);
          kit.stores.forEach((s, i) => {
            const l = document.getElementById(`drop-l${i + 1}`);
            const u = document.getElementById(`drop-u${i + 1}`);
            if (l && !l.value) l.value = s.label;
            if (u && !u.value) u.value = s.url;
          });
        }
        paintDropToggle();
        paintDropDefault();
        paintDropHint();
        paintDropSendButtons();
      });
      host.appendChild(b);
    });
    const fields = document.getElementById("drop-fields");
    if (fields) fields.classList.toggle("hidden", !dropOn);
  }
  function paintDropDefault() {
    const host = document.getElementById("drop-default");
    if (!host) return;
    const stores = dropStoresFromFields();
    host.innerHTML = "";
    (stores.length ? stores : currentDropKit().stores).forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (dropDefault === i ? " on" : "");
      b.textContent = s.label || `STORE ${i + 1}`;
      b.addEventListener("click", () => {
        dropDefault = i;
        paintDropDefault();
      });
      host.appendChild(b);
    });
    paintDropSendButtons();
  }
  function fillDropFields(row) {
    const json = parseDropJson(row?.drop_json);
    const packed = parseDropNote(row?.buy_note);
    const vice = looksViceCity(row);
    const af1 = looksAf1(row);
    const vans = looksVans(row);
    const kit = af1
      ? { at: AF1_AT, stores: AF1_STORES, defaultId: "snkrs" }
      : vans
        ? { at: "", stores: VANS_STORES, defaultId: "goat" }
      : (vice ? { at: VICE_AT, stores: VICE_STORES, defaultId: "nba" } : currentDropKit());
    const off = json?.on === false || packed.off;
    dropOn = !off && (json?.on === true || packed.stores.length >= 2 || vice || af1 || vans);
    const listed = (json?.stores?.length ? json.stores : packed.stores).slice(0, 4);
    const stores = (af1 || vice
      ? kit.stores.map((base) => {
          const hit = listed.find((s) => s.id === base.id)
            || listed.find((s) => String(s.url || "").replace(/\/+$/, "") === base.url.replace(/\/+$/, ""))
            || (base.id === "snkrs" ? listed.find((s) => /nike|snkrs/i.test(`${s.id || ""} ${s.label || ""} ${s.url || ""}`)) : null)
            || {};
          return { id: base.id, label: hit.label || base.label, url: hit.url || base.url };
        })
      : (listed.length ? listed : kit.stores)
    ).slice(0, 4);
    const at = json?.at || packed.at || kit.at;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };
    set("drop-at", isoToLocalInput(at));
    for (let i = 0; i < 4; i += 1) {
      set(`drop-l${i + 1}`, stores[i]?.label || (dropOn ? kit.stores[i]?.label : ""));
      set(`drop-u${i + 1}`, stores[i]?.url || (dropOn ? kit.stores[i]?.url : ""));
    }
    const defId = json?.defaultId || (af1 ? "snkrs" : stores[0]?.id) || kit.defaultId;
    dropDefault = Math.max(0, stores.findIndex((s) => s.id === defId));
    if (dropDefault < 0) dropDefault = 0;
    if (row) set("news-pnote", packed.note || (af1 && dropOn ? AF1_NOTE : ""));
    paintDropToggle();
    paintDropDefault();
    paintDropHint();
    dropEmailOffset = 0;
    dropEmailN = 0;
    dropEmailQ = "";
    const qel = document.getElementById("drop-email-q");
    if (qel) qel.value = "";
    dropCardStatus();
  }
  function studioStoreId(label, url, fallback) {
    const s = `${label} ${url}`.toLowerCase();
    if (fallback === "snkrs" || looksAf1(editingNews) || looksAf1({ title: document.getElementById("news-title")?.value || "" })) {
      if (/snkrs|nike/.test(s) && !/cactus|travis/.test(s)) return "snkrs";
    }
    if (/goat/.test(s)) return "goat";
    if (/nike|snkrs/.test(s)) return "nike";
    if (/fanatics/.test(s)) return "fanatics";
    if (/nba/.test(s)) return "nba";
    if (/cactus|travis/.test(s)) return "cactus";
    return fallback;
  }
  function readDropPayload(humanNote) {
    const human = String(humanNote || "").trim();
    const title = document.getElementById("news-title")?.value || "";
    const vice = looksViceCity(editingNews) || looksViceCity({ title });
    const af1 = looksAf1(editingNews) || looksAf1({ title });
    const kit = currentDropKit();
    if (!dropOn) {
      const had = parseDropJson(editingNews?.drop_json);
      const out = {
        buy_note: vice || af1 ? [human, "AT OFF"].filter(Boolean).join("\n") : human,
        buy_url: document.getElementById("news-purl")?.value.trim() || "",
      };
      if (vice || af1 || had) out.drop_json = { on: false };
      return out;
    }
    const stores = [];
    for (let i = 1; i <= 4; i += 1) {
      const label = document.getElementById(`drop-l${i}`)?.value.trim() || "";
      const url = document.getElementById(`drop-u${i}`)?.value.trim() || "";
      if (!label || !url) continue;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, "")}`;
      stores.push({
        id: studioStoreId(label, href, kit.stores[i - 1]?.id || `s${i}`),
        label,
        url: href,
      });
    }
    const at = localInputToIso(document.getElementById("drop-at")?.value) || kit.at;
    const pick = stores[dropDefault] || stores[0];
    const drop = { on: true, at, stores, defaultId: pick?.id || kit.defaultId };
    return {
      drop_json: drop,
      buy_note: packDropNote(human || (af1 ? AF1_NOTE : ""), drop),
      buy_url: pick?.url || document.getElementById("news-purl")?.value.trim() || "",
    };
  }

  function paintDropSendButtons() {
    for (let i = 1; i <= 4; i += 1) {
      const btn = document.getElementById(`drop-send-${i}`);
      if (!btn) continue;
      const store = dropStoresFromFields()[i - 1];
      const sent = !!(store?.id && dropSentIds.has(store.id));
      btn.disabled = dropSending;
      btn.classList.toggle("is-sent", sent);
      btn.textContent = dropSending ? "SENDING" : sent ? "SENT" : "SEND CARD";
    }
  }

  function paintDropEmails(emails, opt = {}) {
    const list = document.getElementById("drop-email-list");
    const more = document.getElementById("drop-email-more");
    if (!list) return;
    if (!opt.append) list.replaceChildren();
    const rows = [...new Set((Array.isArray(emails) ? emails : []).map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
    if (!opt.append && !rows.length) {
      const empty = document.createElement("li");
      empty.className = "is-empty";
      empty.textContent = "NONE YET";
      list.appendChild(empty);
    } else {
      for (const addr of rows) {
        const li = document.createElement("li");
        li.textContent = addr;
        list.appendChild(li);
      }
    }
    if (more) more.hidden = !opt.hasMore;
  }

  async function dropCardStatus(opt = {}) {
    const msg = document.getElementById("drop-card-msg");
    const append = !!opt.append;
    const offset = append ? dropEmailOffset : 0;
    try {
      const params = new URLSearchParams();
      if (editingNews?.id) params.set("newsId", editingNews.id);
      params.set("offset", String(offset));
      params.set("limit", "100");
      if (dropEmailQ) params.set("q", dropEmailQ);
      const res = await fetch(`/api/drop-card?${params}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const armed = Number(json.n || 0);
        if (msg) msg.textContent = json.error || (armed ? `${armed} ARMED · STUDIO CANNOT READ THEM` : `CARD STATUS ${res.status}`);
        if (!append) paintDropEmails([]);
        paintDropSendButtons();
        return json;
      }
      dropSentIds = new Set(json.sentStoreIds || []);
      const emails = Array.isArray(json.emails) ? json.emails : [];
      dropEmailN = Number(json.n || 0);
      dropEmailOffset = offset + emails.length;
      if (msg) msg.textContent = dropEmailN ? `${dropEmailN} NOTIFY EMAILS ARMED` : "NO NOTIFY EMAILS YET";
      paintDropEmails(emails, { append, hasMore: !!json.hasMore });
      paintDropSendButtons();
      if (!append && !opt.skipAuto) queueMicrotask(() => autoLockSendIfDue());
      return json;
    } catch (err) {
      if (msg) msg.textContent = err.message || "CARD STATUS FAILED";
      if (!append) paintDropEmails([]);
      paintDropSendButtons();
      return {};
    }
  }

  async function persistDropFields() {
    if (!editingNews?.id) throw new Error("SAVE THE DISPATCH FIRST.");
    const dropPack = readDropPayload(document.getElementById("news-pnote")?.value || "");
    if (!dropOn || !dropPack.drop_json?.stores?.length) {
      throw new Error("TURN THE DROP ON AND ADD STORE URLS.");
    }
    await patchLoose("drip_news", editingNews.id, {
      drop_json: dropPack.drop_json,
      buy_note: dropPack.buy_note,
      buy_url: dropPack.buy_url,
    }, NEWS_OPTIONAL);
    editingNews = { ...editingNews, drop_json: dropPack.drop_json, buy_note: dropPack.buy_note, buy_url: dropPack.buy_url };
  }

  let autoLockBusy = false;
  function dropLockDue() {
    const iso = typeof localInputToIso === "function"
      ? localInputToIso(document.getElementById("drop-at")?.value || "")
      : "";
    const at = Date.parse(iso);
    return Number.isFinite(at) && Date.now() >= at;
  }
  async function autoLockSendIfDue() {
    if (autoLockBusy || dropSending || !editingNews?.id || !dropEmailN || !dropLockDue()) return;
    const pending = dropStoresFromFields()
      .map((store, i) => ({ store, index: i + 1 }))
      .filter((row) => row.store?.id && row.store.url && !dropSentIds.has(row.store.id));
    if (!pending.length) return;
    autoLockBusy = true;
    const msg = document.getElementById("drop-card-msg");
    if (msg) msg.textContent = "LOCK OPEN · SENDING CARDS";
    try {
      for (const row of pending) {
        await sendDropStoreCard(row.index, { auto: true });
      }
    } finally {
      autoLockBusy = false;
    }
  }

  async function sendDropStoreCard(index, opt = {}) {
    if (dropSending) {
      if (!opt.auto) snack("CARD IS SENDING.");
      return;
    }
    const store = dropStoresFromFields()[index - 1];
    if (!store?.id || !store.url) {
      if (!opt.auto) snack("ADD THIS STORE URL FIRST.", true);
      return;
    }
    const msg = document.getElementById("drop-card-msg");
    dropSending = true;
    paintDropSendButtons();
    try {
      await persistDropFields();
      let again = false;
      if (dropSentIds.has(store.id)) {
        if (opt.auto) return;
        if (!window.confirm(`SEND ${store.label.toUpperCase()} AGAIN TO EVERY NOTIFY EMAIL?`)) {
          return;
        }
        again = true;
      }
      let safety = 0;
      let cursor = "";
      while (safety < 3000) {
        safety += 1;
        const res = await fetch("/api/drop-card", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newsId: editingNews.id, storeIds: [store.id], again, cursor }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `SEND ${res.status}`);
        if (json.busy) {
          snack("ANOTHER CARD IS SENDING. WAIT.", true);
          break;
        }
        if (json.already && !again) {
          dropSentIds.add(store.id);
          snack(`${store.label.toUpperCase()} ALREADY SENT.`);
          break;
        }
        if (json.empty) {
          snack("NO NOTIFY EMAILS YET.", true);
          break;
        }
        cursor = json.cursor == null ? cursor : String(json.cursor);
        const total = Number(json.total || json.n || 0);
        const remain = Number(json.remain);
        const sentN = Number.isFinite(remain) && total ? Math.max(0, total - remain) : Number(json.sent || 0);
        if (msg) msg.textContent = `SENDING ${store.label.toUpperCase()} · ${total ? `${sentN}/${total}` : sentN || "?"}`;
        if (Array.isArray(json.sentStoreIds)) dropSentIds = new Set(json.sentStoreIds);
        if (json.done) {
          dropSentIds.add(store.id);
          snack(`${store.label.toUpperCase()} CARD SENT.`);
          break;
        }
        again = false;
        await new Promise((r) => setTimeout(r, 280));
      }
    } catch (err) {
      snack(err.message || String(err), true);
    } finally {
      dropSending = false;
      await dropCardStatus({ skipAuto: true });
    }
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
    fillDropFields(null);
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

  function paintNewsPhotoMeta() {
    const el = document.getElementById("news-photo-meta");
    if (el) el.textContent = `PHOTOS ${newsPhotos.length} / ${MAX_NEWS_PHOTOS}`;
    const btn = document.getElementById("news-add-photos");
    if (btn) {
      const full = newsPhotos.length >= MAX_NEWS_PHOTOS;
      btn.setAttribute("aria-disabled", full ? "true" : "false");
      btn.style.pointerEvents = full ? "none" : "";
      btn.style.opacity = full ? "0.38" : "";
    }
  }

  async function ingestNewsFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    let added = 0;
    let firstError = "";
    for (const file of files) {
      const replacing = newsPick >= 0 && newsPick < newsPhotos.length && added === 0;
      if (!replacing && newsPhotos.length >= MAX_NEWS_PHOTOS) {
        snack(`MAX ${MAX_NEWS_PHOTOS} PHOTOS.`, true);
        break;
      }
      const instant = previewUrl(file);
      let slot;
      if (replacing) {
        forgetPreview(newsPhotos[newsPick].preview);
        slot = { blob: file, preview: instant, url: "", cutout: blobLooksCutout(file) };
        newsPhotos[newsPick] = slot;
        newsSlide = newsPick;
        newsPick = -1;
      } else {
        slot = { blob: file, preview: instant, url: "", cutout: blobLooksCutout(file) };
        newsPhotos.push(slot);
        newsSlide = newsPhotos.length - 1;
      }
      added += 1;
      paintNewsScroller();
      try {
        const blob = await pickHd(file, "news");
        slot.cutout = blobLooksCutout(blob || file);
        if (blob && blob !== file) {
          forgetPreview(slot.preview);
          slot.blob = blob;
          slot.preview = previewUrl(blob);
        }
        paintNewsScroller();
      } catch (err) {
        if (!firstError) firstError = err.message || String(err);
      }
    }
    newsPick = -1;
    paintNewsScroller();
    if (firstError) snack(firstError, true);
    else if (added > 1) snack(`${added} PHOTOS ADDED.`);
  }

  function paintNewsScroller() {
    bindNewsScroller();
    const scroller = document.getElementById("news-scroller");
    scroller.replaceChildren();
    newsPhotos.forEach((p, i) => {
      const slide = document.createElement("div");
      slide.className = "photo-slide";
      const frame = document.createElement("div");
      const cutout = p.cutout === true || (p.cutout !== false && urlLooksCutout(p.url || p.preview || ""));
      frame.className = "photo-frame" + (cutout ? " is-cutout" : " is-fill");
      const img = document.createElement("img");
      img.src = p.preview || p.url || "";
      img.alt = "";
      img.addEventListener("load", () => {
        const src = img.currentSrc || img.src || "";
        const next = src.startsWith("blob:") || src.startsWith("data:")
          ? imageIsCutout(img)
          : urlLooksCutout(src);
        p.cutout = next;
        frame.className = "photo-frame" + (next ? " is-cutout" : " is-fill");
      }, { once: true });
      frame.appendChild(img);
      slide.appendChild(frame);
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
      const add = document.createElement("label");
      add.className = "photo-slide add";
      add.setAttribute("for", "news-file");
      add.innerHTML = `<div class="plus">+</div><span>${newsPhotos.length ? `Add ${newsPhotos.length + 1} / ${MAX_NEWS_PHOTOS}` : "Add photo"}</span>`;
      add.addEventListener("click", () => { newsPick = -1; });
      scroller.appendChild(add);
    }
    paintNewsPhotoMeta();
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
      fillDropFields(row);
      newsPhotos = newsUrlList(row).map((href) => ({ blob: null, preview: href, url: href, cutout: urlLooksCutout(href) }));
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
    const buyNote = document.getElementById("news-pnote").value.trim();
    const sku = document.getElementById("news-sku").value.trim();
    const dropPack = readDropPayload(buyNote);
    const msg = document.getElementById("news-edit-msg");
    if (!title) {
      snack("TITLE REQUIRED.", true);
      return;
    }
    if (!newsPhotos.length) {
      snack("ADD AN HD PHOTO FIRST.", true);
      return;
    }
    const viceSave = looksViceCity(editingNews) || looksViceCity({ title });
    const af1Save = looksAf1(editingNews) || looksAf1({ title });
    const minStores = viceSave || af1Save ? 2 : 1;
    if (dropOn && (!dropPack.drop_json?.stores || dropPack.drop_json.stores.length < minStores)) {
      snack(minStores > 1 ? "DROP NEEDS 2 STORE URLS." : "DROP NEEDS A STORE URL.", true);
      return;
    }
    msg.textContent = "SAVING…";
    try {
      const imageUrls = await collectNewsUrls();
      const row = {
        category: newsCat,
        title,
        dek,
        body,
        source,
        image_url: imageUrls[0] || "",
        image_urls: imageUrls,
        product_name: productName,
        release_date: releaseDate,
        buy_url: dropPack.buy_url,
        buy_note: dropPack.buy_note,
        sku,
        drop_json: dropPack.drop_json,
      };
      if (editingNews?.id) {
        await patchLoose("drip_news", editingNews.id, row, NEWS_OPTIONAL);
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
      snack(text.includes("drip_news") ? `${text}\nNazım SQL: sql/wears_drip_news.sql\nDrop column: sql/wears_drip_news_drop.sql` : text, true);
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
    const [file] = await pinFiles(e.target.files);
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
    const files = await pinFiles(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    await ingestNewsFiles(files);
  });
  ["news-pname", "news-pdate", "news-purl", "news-pnote", "news-sku"].forEach((id) => {
    document.getElementById(id).addEventListener("input", paintNewsPlate);
  });
  document.getElementById("drop-at")?.addEventListener("input", paintDropHint);
  ["drop-l1", "drop-l2", "drop-l3", "drop-l4", "drop-u1", "drop-u2", "drop-u3", "drop-u4"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      paintDropDefault();
      paintDropSendButtons();
    });
  });
  document.getElementById("drop-fields")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-drop-send]");
    if (btn) {
      sendDropStoreCard(Number(btn.getAttribute("data-drop-send")));
      return;
    }
    if (e.target.closest("#drop-email-more")) dropCardStatus({ append: true });
  });
  let dropSearchTimer = 0;
  document.getElementById("drop-email-q")?.addEventListener("input", (e) => {
    dropEmailQ = String(e.target.value || "").trim().toLowerCase();
    clearTimeout(dropSearchTimer);
    dropSearchTimer = setTimeout(() => dropCardStatus(), 250);
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
