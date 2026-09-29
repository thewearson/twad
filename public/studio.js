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
  const BUCKET = "image-artist";

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
  let screen = "pick";
  let mode = "fit";
  let fitBlob = null;
  let fitPreview = "";
  let storyBlob = null;
  let storyPreview = "";
  let ppBlob = null;
  let ppPreview = "";
  let cardIndex = 0;
  let cards = emptyCards();
  let snackTimer = 0;

  function emptyCard() {
    return { brand: "", title: "", color: "", price: "", imageBlob: null, imagePreview: "", listings: [{ store: "", url: "", price: "" }] };
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

  function regionForCountry(country) {
    const c = (country || "").toUpperCase().replace(/İ/g, "I").replace(/I\u0307/g, "I").trim();
    if (!c) return "ALL";
    if (c === "TR" || c.includes("TURK") || c.includes("TURKIYE")) return "TR";
    if (c.includes("CANADA")) return "CANADA";
    if (c.includes("NIGERIA") || c.includes("GHANA") || c.includes("AFRICA")) return "AFRICA";
    if (c.includes("JAPAN") || c.includes("CHINA") || c.includes("KOREA") || c.includes("ASIA")) return "ASIA";
    if (c.includes("BARBADOS") || c.includes("JAMAICA") || c.includes("AUSTRALIA")) return "ALL";
    if (c === "US" || c === "USA" || c.includes("UNITED STATES")) return "USA";
    if (
      c === "EU" || c === "UK" || c === "GB" ||
      c.includes("UNITED KINGDOM") || c.includes("ENGLAND") || c.includes("FRANCE") ||
      c.includes("GERMANY") || c.includes("ITALY") || c.includes("SPAIN") ||
      c.includes("NETHERLAND") || c.includes("POLAND") || c.includes("PORTUGAL") ||
      c.includes("UKRAINE") || c.includes("EUROPE")
    ) return "EU";
    return "ALL";
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
      throw new Error(`PHOTO TOO SMALL. ${w}×${h}. NEED ${spec.minShort}PX+ ON THE SHORT SIDE (INSTAGRAM HD).`);
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
    fit: { minShort: 1080, maxEdge: 1440, square: false, quality: 0.92 },
    story: { minShort: 1080, maxEdge: 1920, square: false, quality: 0.92 },
    item: { minShort: 800, maxEdge: 1440, square: false, quality: 0.92 },
  };

  async function pickHd(file, kind) {
    const img = await loadImageFile(file);
    return toJpeg(img, HD[kind]);
  }

  function previewUrl(blob) {
    return blob ? URL.createObjectURL(blob) : "";
  }

  async function uploadJpeg(path, blob) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      const msg = error.message || String(error);
      if (/bucket|policy|row-level|permission|not found/i.test(msg)) {
        throw new Error(`${msg} Nazım SQL: studio storage write on ${BUCKET}.`);
      }
      throw error;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function insertLoose(tableName, payload, optionalKeys) {
    let body = { ...payload };
    let keys = optionalKeys.slice();
    for (;;) {
      const { data, error } = await sb.from(tableName).insert(body).select().single();
      if (!error) return data;
      const msg = error.message || "";
      const hit = keys.find((k) => msg.toLowerCase().includes(k.toLowerCase()));
      if (!hit) throw error;
      delete body[hit];
      keys = keys.filter((k) => k !== hit);
    }
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
    const rowsList = Array.isArray(list) && list.length ? list : [null];
    rowsList.forEach((item) => addListingRow(root, item));
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
      host.appendChild(b);
    });
  }

  async function loadArtists() {
    const { data, error } = await sb.from("artists").select("*").limit(500);
    if (error) {
      snack(error.message, true);
      artists = [];
    } else {
      artists = (data || []).map((row) => ({
        ...row,
        name: (row.name || "").toUpperCase(),
        country: (row.country || "").toUpperCase(),
        region: (row.region || regionForCountry(row.country || "")).toUpperCase(),
      }));
    }
    renderChips();
    renderGrid();
  }

  function openArtist(artist) {
    selected = artist;
    document.getElementById("artist-name").textContent = artist.name || "";
    document.getElementById("artist-country").textContent = artist.country || "";
    paintAvatar(document.getElementById("artist-av"), artist, 96);
    showScreen("artist");
  }

  function resetCompose() {
    fitBlob = null;
    storyBlob = null;
    if (fitPreview) URL.revokeObjectURL(fitPreview);
    if (storyPreview) URL.revokeObjectURL(storyPreview);
    fitPreview = "";
    storyPreview = "";
    cardIndex = 0;
    cards = emptyCards();
    document.getElementById("fit-drop").querySelector("img")?.remove();
    document.getElementById("fit-label").classList.remove("hidden");
  }

  function goFit() {
    mode = "fit";
    resetCompose();
    const drop = document.getElementById("fit-drop");
    drop.classList.remove("story");
    document.getElementById("photo-step").textContent = "Fit check · photo";
    document.getElementById("photo-hint").textContent = "1080px minimum. Instagram HD. Soft photos are rejected.";
    document.getElementById("photo-next").textContent = "Next";
    showScreen("photo");
  }

  function goStory() {
    mode = "story";
    resetCompose();
    const drop = document.getElementById("fit-drop");
    drop.classList.add("story");
    document.getElementById("photo-step").textContent = "Story · photo";
    document.getElementById("photo-hint").textContent = "1080px minimum. 9:16 like Instagram Stories.";
    document.getElementById("photo-next").textContent = "Post story";
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
    document.getElementById("card-next").textContent = cardIndex === MAX_CARDS - 1 ? "Post fit check" : "Next card";
  }

  function captureCardForm() {
    const card = cards[cardIndex];
    card.brand = document.getElementById("card-brand").value.trim().toUpperCase();
    card.title = document.getElementById("card-title").value.trim().toUpperCase();
    card.color = document.getElementById("card-color").value.trim().toUpperCase();
    card.price = document.getElementById("card-price").value.trim();
    card.listings = listingsFrom(document.getElementById("card-urls"));
  }

  async function publishOutfit(kind, blob) {
    if (!selected?.id) throw new Error("PICK A STAR FIRST.");
    if (!blob) throw new Error("ADD AN HD PHOTO FIRST.");
    snack("UPLOADING…");
    const path = `${kind === "story" ? "stories" : "fits"}/${selected.id}/${crypto.randomUUID()}.jpg`;
    const imageUrl = await uploadJpeg(path, blob);
    const outfit = await insertLoose("outfits", {
      artist_id: selected.id,
      image_url: imageUrl,
      title: kind === "story" ? "STORY" : "FIT CHECK",
      date: new Date().toISOString(),
      is_vault: false,
    }, ["title", "date", "is_vault"]);
    if (kind === "fit") {
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card.brand && !card.title) continue;
        let itemUrl = "";
        if (card.imageBlob) {
          itemUrl = await uploadJpeg(`items/${outfit.id}/${i + 1}.jpg`, card.imageBlob);
        }
        const listings = card.listings.filter((r) => r.url);
        await insertLoose("items", {
          outfit_id: outfit.id,
          artist_id: selected.id,
          title: card.title || "ITEM",
          name: card.title || "ITEM",
          brand: card.brand || "BRAND",
          color: card.color || null,
          price: parsePrice(card.price),
          image_url: itemUrl || null,
          purchase_url: listings[0]?.url || null,
          listings,
        }, ["artist_id", "color", "price", "image_url", "purchase_url", "listings", "title", "name"]);
      }
    }
    return outfit;
  }

  async function saveStar() {
    const name = document.getElementById("star-name").value.trim().toUpperCase();
    const country = document.getElementById("star-country").value;
    const region = regionForCountry(country);
    const instagram = igHandle(document.getElementById("star-ig").value);
    const msg = document.getElementById("star-msg");
    msg.textContent = "";
    if (!name) {
      snack("NAME REQUIRED.", true);
      return;
    }
    if (!ppBlob) {
      snack("STAR PP REQUIRED. 640PX+ SQUARE CROP.", true);
      return;
    }
    try {
      msg.textContent = "SAVING…";
      const path = `stars/${slug(name)}-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const imageUrl = await uploadJpeg(path, ppBlob);
      const row = await insertLoose("artists", {
        name,
        country,
        region,
        image_url: imageUrl,
        instagram,
      }, ["instagram", "region"]);
      snack("STAR SAVED.");
      await loadArtists();
      openArtist(artists.find((a) => a.id === row.id) || { ...row, name, country, region, image_url: imageUrl });
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
    ppBlob = null;
    if (ppPreview) URL.revokeObjectURL(ppPreview);
    ppPreview = "";
    document.getElementById("star-name").value = "";
    document.getElementById("star-ig").value = "";
    document.getElementById("pp-drop").querySelector("img")?.remove();
    document.getElementById("star-msg").textContent = "";
    showScreen("star");
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
      if (mode === "story") {
        if (storyPreview) URL.revokeObjectURL(storyPreview);
        storyBlob = blob;
        storyPreview = previewUrl(blob);
        setDropPreview(document.getElementById("fit-drop"), storyPreview);
      } else {
        if (fitPreview) URL.revokeObjectURL(fitPreview);
        fitBlob = blob;
        fitPreview = previewUrl(blob);
        setDropPreview(document.getElementById("fit-drop"), fitPreview);
      }
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("photo-next").addEventListener("click", async () => {
    if (mode === "story") {
      try {
        await publishOutfit("story", storyBlob);
        snack("STORY POSTED. PULL TO REFRESH THE APP.");
        showScreen("artist");
      } catch (err) {
        snack(err.message || String(err), true);
      }
      return;
    }
    if (!fitBlob) {
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
      if (card.imagePreview) URL.revokeObjectURL(card.imagePreview);
      card.imageBlob = blob;
      card.imagePreview = previewUrl(blob);
      paintCardForm();
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("card-next").addEventListener("click", async () => {
    captureCardForm();
    if (cardIndex < MAX_CARDS - 1) {
      cardIndex += 1;
      paintCardForm();
      return;
    }
    try {
      await publishOutfit("fit", fitBlob);
      snack("FIT CHECK POSTED. PULL TO REFRESH THE APP.");
      showScreen("artist");
    } catch (err) {
      snack(err.message || String(err), true);
    }
  });

  document.getElementById("card-skip").addEventListener("click", async () => {
    cards[cardIndex] = emptyCard();
    if (cardIndex < MAX_CARDS - 1) {
      cardIndex += 1;
      paintCardForm();
      return;
    }
    try {
      await publishOutfit("fit", fitBlob);
      snack("FIT CHECK POSTED. PULL TO REFRESH THE APP.");
      showScreen("artist");
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
    if (screen === "photo" || screen === "star") {
      showScreen(selected && screen === "photo" ? "artist" : "pick");
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
    const list = asListingArray(raw);
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
        if (table === "items" && k === "listings") {
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
    tr.querySelectorAll("input[data-k]").forEach((input) => {
      patch[input.dataset.k] = parseCell(input.value);
    });
    if (table === "items" && columns.includes("listings")) {
      const ed = tr.querySelector(".listing-ed");
      if (ed) patch.listings = readListings(ed);
    }
    return patch;
  }

  function listingsColumnError(message) {
    const msg = message || "";
    if (/listings/i.test(msg) && /column|schema/i.test(msg)) {
      return `${msg} Nazım SQL: ALTER TABLE public.items ADD COLUMN IF NOT EXISTS listings jsonb;`;
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
    const { error } = await sb.from(table).update(patch).eq("id", prev.id);
    if (error) {
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
    const { error } = await sb.from(table).delete().eq("id", prev.id);
    if (error) {
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
      if (listings.length || columns.includes("listings")) payload.listings = listings;
    }
    const { error } = await sb.from(table).insert(payload);
    if (error) {
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
