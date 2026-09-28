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
        const input = document.createElement("input");
        input.value = cellText(row[k]);
        input.dataset.i = String(idx);
        input.dataset.k = k;
        td.appendChild(input);
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
    return patch;
  }

  async function openTable(name) {
    table = name;
    insertBox.classList.remove("on");
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
    setDeskMsg(`${rows.length} row(s). Writes need studio_admin_all RLS.`, "ok");
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
      setDeskMsg(error.message, "err");
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
    const { error } = await sb.from(table).insert(payload);
    if (error) {
      setDeskMsg(error.message, "err");
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
      if (k === "id") continue;
      sample[k] = null;
    }
    insertJson.value = JSON.stringify(sample, null, 2);
  });

  document.getElementById("insert-save").addEventListener("click", insertRow);
  document.getElementById("insert-cancel").addEventListener("click", () => {
    insertBox.classList.remove("on");
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
