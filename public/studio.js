(() => {
  const url = window.WEARS_SUPABASE_URL;
  const key = window.WEARS_SUPABASE_ANON_KEY;
  const preferred = ["artists", "outfits", "items", "archives"];
  const fallbackTables = ["artists", "outfits", "items", "archives", "users", "comments"];

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

  let table = "";
  let rows = [];
  let columns = [];

  function showGate(msg) {
    gate.classList.add("on");
    desk.classList.remove("on");
    gateErr.textContent = msg || "";
  }

  function showDesk() {
    gate.classList.remove("on");
    desk.classList.add("on");
    gateErr.textContent = "";
  }

  function setDeskMsg(msg, kind) {
    deskMsg.className = kind === "err" ? "err" : kind === "ok" ? "ok" : "muted";
    deskMsg.textContent = msg || "";
  }

  function parseCell(raw) {
    const t = raw.trim();
    if (t === "") return null;
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        return JSON.parse(t);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  function cellText(v) {
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  function normalizeHref(raw) {
    const s = (raw || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s;
  }

  function asListingArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function listingFromFields(storeEl, urlEl, priceEl) {
    const store = (storeEl?.value || "").trim();
    const url = normalizeHref(urlEl?.value || "");
    const price = (priceEl?.value || "").trim();
    if (!store && !url && !price) return null;
    const row = {};
    if (store) row.store = store;
    if (url) row.url = url;
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

  function addListingRow(root, listing) {
    const row = document.createElement("div");
    row.className = "listing-row";
    const store = document.createElement("input");
    store.dataset.ls = "store";
    store.placeholder = "STORE";
    store.value = listing?.store ? String(listing.store) : "";
    const url = document.createElement("input");
    url.dataset.ls = "url";
    url.placeholder = "https://";
    url.value = listing?.url ? String(listing.url) : "";
    const price = document.createElement("input");
    price.dataset.ls = "price";
    price.placeholder = "PRICE";
    price.value = listing?.price ? String(listing.price) : "";
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "X";
    del.addEventListener("click", () => {
      row.remove();
      if (!root.querySelector(".listing-row")) addListingRow(root, null);
    });
    row.append(store, url, price, del);
    root.appendChild(row);
  }

  function fillListingEditor(root, raw) {
    root.replaceChildren();
    const list = asListingArray(raw);
    if (!list.length) {
      addListingRow(root, null);
      return;
    }
    for (const item of list) addListingRow(root, item);
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
    add.addEventListener("click", () => addListingRow(list, null));
    wrap.append(list, add);
    return wrap;
  }

  async function requireAdmin() {
    const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) throw sessionErr;
    const user = sessionData.session?.user;
    if (!user) return null;
    const { data, error } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!data || data.role !== "admin") {
      await sb.auth.signOut();
      throw new Error("Not admin. users.role must be admin.");
    }
    return user;
  }

  async function listTables() {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return fallbackTables.slice();
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          Accept: "application/openapi+json",
        },
      });
      if (!res.ok) return fallbackTables.slice();
      const spec = await res.json();
      const names = Object.keys(spec.paths || {})
        .map((p) => p.replace(/^\//, ""))
        .filter((p) => p && !p.includes("/") && !p.includes("{") && p !== "rpc");
      const uniq = [...new Set(names)];
      const head = preferred.filter((t) => uniq.includes(t));
      const rest = uniq.filter((t) => !preferred.includes(t)).sort();
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

  function renderGrid() {
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
    thAct.textContent = "";
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
      renderGrid();
      setDeskMsg(error.message, "err");
      return;
    }
    rows = Array.isArray(data) ? data : [];
    columns = rows.length ? Object.keys(rows[0]) : [];
    renderGrid();
    const hint =
      name === "items"
        ? `${rows.length} row(s). Redirect URLs: STORE + https link in the listings column.`
        : `${rows.length} row(s). Writes need studio_admin_all RLS.`;
    setDeskMsg(hint, "ok");
  }

  function listingsColumnError(message) {
    const msg = message || "";
    if (/listings/i.test(msg) && /column|schema/i.test(msg)) {
      return `${msg} Nazım SQL: ALTER TABLE public.items ADD COLUMN IF NOT EXISTS listings jsonb;`;
    }
    return msg;
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
      if (listings.length || columns.includes("listings")) {
        payload.listings = listings;
      }
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
    const names = await listTables();
    renderTables(names);
    await openTable(names.includes("artists") ? "artists" : names[0]);
  }

  document.getElementById("signin").addEventListener("click", async () => {
    gateErr.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      showGate(error.message);
      return;
    }
    try {
      const user = await requireAdmin();
      await bootDesk(user);
    } catch (e) {
      showGate(e.message || String(e));
    }
  });

  document.getElementById("signout").addEventListener("click", async () => {
    await sb.auth.signOut();
    table = "";
    rows = [];
    showGate("");
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
    addListingRow(insertUrlRows, null);
  });

  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("signin").click();
  });

  (async () => {
    try {
      const user = await requireAdmin();
      if (!user) {
        showGate("");
        return;
      }
      await bootDesk(user);
    } catch (e) {
      showGate(e.message || String(e));
    }
  })();
})();
