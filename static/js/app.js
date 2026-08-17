(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");
  const modalRoot = $("#modal-root");
  const toastRoot = $("#toast-root");

  const ROUTES = [
    ["dashboard", "Dashboard", "grid"],
    ["reception", "Reception", "desk"],
    ["vitals", "Vitals", "pulse"],
    ["consultation", "Consultation", "steth"],
    ["patients", "Patients", "people"],
    ["investigations", "Investigations", "flask"],
    ["analytics", "Analytics", "chart"],
    ["staff", "Staff Accounts", "badge"],
    ["settings", "Settings", "gear"],
    ["profile", "My Profile", "user"],
  ];

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    desk: '<path d="M4 10h16M4 10v8M20 10v8M8 10V6h8v4M8 14h3"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    steth: '<path d="M6 4v6a4 4 0 0 0 8 0V4M6 4h2M14 4h2M18 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 18v1a5 5 0 0 1-5 5h-1"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.4.3 4 2 4 5"/>',
    flask: '<path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3"/>',
    chart: '<path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8"/>',
    badge: '<circle cx="12" cy="8" r="3"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12 2v2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    rx: '<path d="M5 5h8l6 6v8H5z"/><path d="M13 5v6h6M8 14h6M8 17h4"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 13l4 1.5v3A2 2 0 0 1 19 20 16 16 0 0 1 4 5a2 2 0 0 1 2.5-1.5z"/>',
  };

  const svg = (name, size = 18) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;

  const store = { data: null, view: "dashboard", q: "" };

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const nid = (key) => {
    store.data.next[key] = (store.data.next[key] || 1) + 0;
    const n = store.data.next[key]++;
    return key[0] + n + "_" + Date.now().toString(36);
  };

  function initials(name) {
    return (name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function niceDate(d = new Date()) {
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function patient(id) {
    return store.data.patients.find((p) => p.id === id) || { name: "Unknown", age: "", sex: "" };
  }
  function staff(id) {
    return store.data.staff.find((s) => s.id === id) || { name: "Unassigned" };
  }
  function todayVisits() {
    const t = todayISO();
    return store.data.visits.filter((v) => v.date === t).sort((a, b) => a.token - b.token);
  }
  function todayAppts() {
    const t = todayISO();
    return store.data.appointments
      .filter((a) => a.date === t)
      .sort((a, b) => a.time.localeCompare(b.time));
  }
  function nextToken() {
    const vis = todayVisits();
    return vis.reduce((m, v) => Math.max(m, v.token || 0), 0) + 1;
  }

  async function load() {
    const res = await fetch("/api/clinic");
    store.data = await res.json();
  }
  async function save() {
    await fetch("/api/clinic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store.data),
    });
  }
  function toast(msg) {
    toastRoot.innerHTML = `<div class="toast">${esc(msg)}</div>`;
    setTimeout(() => (toastRoot.innerHTML = ""), 2200);
  }
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pathView() {
    const p = (location.pathname.replace(/\/+$/, "") || "/dashboard").slice(1);
    return ROUTES.some(([id]) => id === p) ? p : "dashboard";
  }

  function go(view, extra = {}) {
    store.view = view;
    Object.assign(store, extra);
    history.pushState({}, "", "/" + view);
    render();
  }

  const ECG = `<svg class="ecg" width="72" height="36" viewBox="0 0 72 36" fill="none">
    <path d="M1 20h10l3-8 4 16 4-20 4 16 3-4h12l3-8 4 16 4-20 4 16 3-4h13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  function logo() {
    return `<svg width="28" height="28" viewBox="0 0 64 64">
      <path fill="#d4af37" d="M32 54s-18-11.5-24-22C4 24 8 14 18 14c6 0 10 4 14 9 4-5 8-9 14-9 10 0 14 10 10 18-6 10.5-24 22-24 22z"/>
      <path stroke="#07111f" stroke-width="3.4" stroke-linecap="round" d="M32 22v20M22 32h20"/>
    </svg>`;
  }

  function sidebar() {
    const items = ROUTES.map(([id, label, icon]) => {
      const on = store.view === id ? "active" : "";
      return `<button class="nav-item ${on}" data-nav="${id}">${svg(icon)}${esc(label)}</button>`;
    }).join("");
    const c = store.data.clinic;
    return `<aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">${logo()}</div>
        <div>
          <h1>ADVANCED<br>HEART CENTER</h1>
          <p>${esc(c.location)}</p>
        </div>
      </div>
      <nav class="nav">${items}</nav>
      <div class="side-foot">
        <div class="support">
          <div class="k">24/7 Cardiac Support</div>
          <div class="n">${svg("phone", 14)} ${esc(c.phone)}</div>
        </div>
        <div class="copy">© 2026 Advanced Heart Center</div>
      </div>
    </aside>`;
  }

  function rightPanel() {
    if (store.view !== "dashboard") return "";
    const appts = todayAppts();
    const rows = appts.length
      ? appts
          .map((a) => {
            const p = patient(a.patientId);
            return `<div class="tl">
              <div class="t">${esc(a.time)}</div>
              <div class="n">${esc(p.name)}</div>
              <div class="r">${esc(a.reason || staff(a.doctorId).name)}</div>
            </div>`;
          })
          .join("")
      : `<div class="empty">No appointments today</div>`;
    return `<aside class="right">
      <h3>Upcoming Appointments</h3>
      <div class="timeline">${rows}</div>
    </aside>`;
  }

  function badgeType(t) {
    return t === "Follow-up" ? "follow" : "new";
  }
  function badgeStatus(s) {
    if (s === "Completed") return "done";
    if (s === "In Progress") return "prog";
    return "wait";
  }

  function donut(parts) {
    const total = parts.reduce((s, p) => s + p.value, 0);
    const r = 54;
    const c = 2 * Math.PI * r;
    let acc = 0;
    const rings = parts
      .map((p) => {
        const frac = total ? p.value / total : 0;
        const dash = frac * c;
        const gap = c - dash;
        const rot = acc * 360;
        acc += frac;
        return `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${p.color}" stroke-width="14"
          stroke-dasharray="${dash} ${gap}" stroke-linecap="butt"
          transform="rotate(${rot - 90} 84 84)"></circle>`;
      })
      .join("");
    const legend = parts
      .map((p) => {
        const pct = total ? Math.round((p.value / total) * 100) : 0;
        return `<div class="legend-row"><span><i class="dot" style="background:${p.color}"></i>${esc(p.label)}</span><b>${pct}%</b></div>`;
      })
      .join("");
    return `<div class="glance">
      <div class="donut-wrap">
        <svg width="168" height="168" viewBox="0 0 168 168">${rings}
          <circle cx="84" cy="84" r="40" fill="#07111f"></circle>
        </svg>
        <div class="center"><b>${total}</b><span>activities</span></div>
      </div>
      <div class="legend">${legend}</div>
    </div>`;
  }

  function viewDashboard() {
    const vis = todayVisits();
    const waiting = vis.filter((v) => v.status === "Waiting").length;
    const progress = vis.filter((v) => v.status === "In Progress").length;
    const done = vis.filter((v) => v.status === "Completed").length;
    const pendingInv = store.data.investigations.filter((i) => i.status !== "Completed").length;
    const neu = vis.filter((v) => v.type === "New").length;
    const fol = vis.filter((v) => v.type === "Follow-up").length;
    const pr = store.data.profile;
    const rows = vis
      .map((v) => {
        const p = patient(v.patientId);
        const d = staff(v.doctorId);
        return `<tr>
          <td class="token">#${String(v.token).padStart(2, "0")}</td>
          <td><div class="who"><span class="av">${esc(initials(p.name))}</span>${esc(p.name)}</div></td>
          <td>${esc(d.name)}</td>
          <td><span class="badge ${badgeType(v.type)}">${esc(v.type)}</span></td>
          <td><span class="badge ${badgeStatus(v.status)}">${esc(v.status)}</span></td>
          <td><button class="icon-btn" data-act="rx" data-id="${v.id}" title="Prescription">${svg("rx", 15)}</button></td>
        </tr>`;
      })
      .join("");
    return `
      <div class="topbar">
        <div class="greet">
          <h2>${greeting()}, ${esc(pr.name)} 👋</h2>
          <div class="date">${niceDate()}</div>
        </div>
        <div class="quote">${ECG}<p>${esc(store.data.clinic.tagline)}</p></div>
      </div>
      <div class="scroll">
        <div class="stats">
          <div class="stat cyan"><div class="row"><div><div class="lbl">Today's Patients</div><div class="num">${vis.length}</div><div class="delta">Live queue</div></div><div class="ico">${svg("people", 16)}</div></div></div>
          <div class="stat gold"><div class="row"><div><div class="lbl">Awaiting Consultation</div><div class="num">${waiting}</div></div><div class="ico">${svg("desk", 16)}</div></div></div>
          <div class="stat purple"><div class="row"><div><div class="lbl">In Consultation</div><div class="num">${progress}</div></div><div class="ico">${svg("steth", 16)}</div></div></div>
          <div class="stat green"><div class="row"><div><div class="lbl">Completed Today</div><div class="num">${done}</div></div><div class="ico">${svg("badge", 16)}</div></div></div>
          <div class="stat orange"><div class="row"><div><div class="lbl">Pending Investigations</div><div class="num">${pendingInv}</div></div><div class="ico">${svg("flask", 16)}</div></div></div>
        </div>
        <div class="mid">
          <div class="card">
            <div class="card-h"><h3>Today's Queue</h3><span class="sub">${vis.length} tokens</span></div>
            <div style="overflow:auto">
              <table>
                <thead><tr><th>Token</th><th>Patient</th><th>Cardiologist</th><th>Type</th><th>Status</th><th></th></tr></thead>
                <tbody>${rows || `<tr><td colspan="6" class="empty">No patients in queue yet</td></tr>`}</tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h3>Today at a Glance</h3></div>
            ${donut([
              { label: "New Patients", value: neu || 0, color: "#2dd4bf" },
              { label: "Follow-ups", value: fol || 0, color: "#a78bfa" },
              { label: "Completed", value: done || 0, color: "#34d399" },
            ])}
          </div>
          <div class="card profile-card">
            <div class="photo">SU</div>
            <h4>${esc(pr.name)}</h4>
            <div class="role">${esc(pr.role)}</div>
            <div class="metrics">
              <div><b>${pr.experienceYears}+</b><span>years exp.</span></div>
              <div><b>${pr.happyPatients}+</b><span>happy patients</span></div>
              <div><b>${pr.successRate}%</b><span>success rate</span></div>
            </div>
          </div>
        </div>
        <div class="quick">
          <button class="qa" data-act="add-patient"><div class="gico">${svg("plus", 20)}</div><span>Add New Patient</span></button>
          <button class="qa" data-nav="consultation"><div class="gico">${svg("steth", 20)}</div><span>New Consultation</span></button>
          <button class="qa" data-act="order-inv"><div class="gico">${svg("flask", 20)}</div><span>Order Investigation</span></button>
          <button class="qa" data-nav="consultation"><div class="gico">${svg("rx", 20)}</div><span>Prescription</span></button>
          <button class="qa" data-nav="analytics"><div class="gico">${svg("chart", 20)}</div><span>View Reports</span></button>
        </div>
      </div>`;
  }

  function optionsPatients(sel) {
    return store.data.patients
      .map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.name)} (${esc(p.mrn)})</option>`)
      .join("");
  }
  function optionsDoctors(sel) {
    return store.data.staff
      .filter((s) => s.active)
      .map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("");
  }

  function viewReception() {
    const vis = todayVisits();
    const rows = vis
      .map((v) => {
        const p = patient(v.patientId);
        return `<tr>
          <td class="token">#${String(v.token).padStart(2, "0")}</td>
          <td>${esc(p.name)}</td>
          <td>${esc(staff(v.doctorId).name)}</td>
          <td><span class="badge ${badgeType(v.type)}">${esc(v.type)}</span></td>
          <td><span class="badge ${badgeStatus(v.status)}">${esc(v.status)}</span></td>
          <td>
            ${v.status === "Waiting" ? `<button class="btn btn-gold" data-act="start-visit" data-id="${v.id}">Start</button>` : ""}
            ${v.status === "In Progress" ? `<button class="btn btn-gold" data-act="complete-visit" data-id="${v.id}">Complete</button>` : ""}
          </td>
        </tr>`;
      })
      .join("");
    return `<div class="page-head"><h2>Reception</h2><button class="btn btn-gold" data-act="add-patient">${svg("plus", 14)} New patient & token</button></div>
      <div class="scroll">
        <div class="card pad" style="margin-bottom:14px">
          <form class="form-grid" data-form="token">
            <div class="f"><label>Existing patient</label><select name="patientId"><option value="">Select…</option>${optionsPatients()}</select></div>
            <div class="f"><label>Cardiologist</label><select name="doctorId">${optionsDoctors("s1")}</select></div>
            <div class="f"><label>Visit type</label><select name="type"><option>New</option><option>Follow-up</option></select></div>
            <div class="f"><label>Chief complaint</label><input name="complaint" placeholder="Chest pain, SOB, palpitations…"></div>
            <div class="f span"><button class="btn btn-gold" type="submit">Issue token #${String(nextToken()).padStart(2, "0")}</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-h"><h3>Today's tokens</h3></div>
          <table><thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty">Queue is empty</td></tr>`}</tbody></table>
        </div>
      </div>`;
  }

  function viewVitals() {
    const vis = todayVisits();
    const latest = store.data.vitals.slice().reverse();
    const rows = latest
      .map((v) => {
        const p = patient(v.patientId);
        return `<tr>
          <td>${esc(p.name)}</td>
          <td>${v.bpSys}/${v.bpDia}</td>
          <td>${v.hr}</td>
          <td>${v.spo2}%</td>
          <td>${v.temp}°C</td>
          <td>${v.weight} kg</td>
        </tr>`;
      })
      .join("");
    return `<div class="page-head"><h2>Vitals</h2></div>
      <div class="scroll">
        <div class="card pad" style="margin-bottom:14px">
          <form class="form-grid" data-form="vitals">
            <div class="f"><label>Patient / visit</label>
              <select name="visitId">${vis.map((v) => `<option value="${v.id}">#${v.token} ${esc(patient(v.patientId).name)}</option>`).join("") || "<option value=''>No visits today</option>"}</select>
            </div>
            <div class="f"><label>BP systolic</label><input name="bpSys" type="number" value="120"></div>
            <div class="f"><label>BP diastolic</label><input name="bpDia" type="number" value="80"></div>
            <div class="f"><label>Heart rate</label><input name="hr" type="number" value="76"></div>
            <div class="f"><label>SpO2 %</label><input name="spo2" type="number" value="98"></div>
            <div class="f"><label>Temp °C</label><input name="temp" type="number" step="0.1" value="36.8"></div>
            <div class="f"><label>Weight kg</label><input name="weight" type="number" value="70"></div>
            <div class="f"><label>Height cm</label><input name="height" type="number" value="168"></div>
            <div class="f span"><button class="btn btn-gold" type="submit">Save vitals</button></div>
          </form>
        </div>
        <div class="card"><div class="card-h"><h3>Recorded vitals</h3></div>
          <table><thead><tr><th>Patient</th><th>BP</th><th>HR</th><th>SpO2</th><th>Temp</th><th>Weight</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty">No vitals yet</td></tr>`}</tbody></table>
        </div>
      </div>`;
  }

  function viewConsultation() {
    const vis = todayVisits();
    const focus = store.focusVisit || (vis[0] && vis[0].id) || "";
    const v = store.data.visits.find((x) => x.id === focus) || vis[0];
    const existing = v ? store.data.consultations.find((c) => c.visitId === v.id) : null;
    const rx = (existing && existing.rx) || [{ drug: "", dose: "", freq: "OD", days: "7" }];
    return `<div class="page-head"><h2>Consultation</h2></div>
      <div class="scroll">
        <div class="card pad">
          <form data-form="consult">
            <div class="form-grid">
              <div class="f"><label>Visit</label>
                <select name="visitId">${vis.map((x) => `<option value="${x.id}" ${v && x.id === v.id ? "selected" : ""}>#${x.token} ${esc(patient(x.patientId).name)} — ${esc(x.status)}</option>`).join("")}</select>
              </div>
              <div class="f"><label>Diagnosis</label><input name="diagnosis" value="${esc(existing ? existing.diagnosis : "")}" placeholder="e.g. NSTEMI, HTN, HFrEF"></div>
              <div class="f span"><label>Clinical notes</label><textarea name="notes">${esc(existing ? existing.notes : v ? v.complaint : "")}</textarea></div>
            </div>
            <div class="card-h" style="padding-left:0"><h3>Prescription</h3><button type="button" class="btn btn-ghost" data-act="add-rx-row">Add drug</button></div>
            <div id="rx-rows">${rx
              .map(
                (r, i) => `<div class="rx-line">
              <input name="drug" placeholder="Drug" value="${esc(r.drug)}">
              <input name="dose" placeholder="Dose" value="${esc(r.dose)}">
              <input name="freq" placeholder="Freq" value="${esc(r.freq)}">
              <input name="days" placeholder="Days" value="${esc(r.days)}">
              <button type="button" class="icon-btn" data-act="drop-rx" data-i="${i}">×</button>
            </div>`
              )
              .join("")}</div>
            <div style="margin-top:14px;display:flex;gap:8px">
              <button class="btn btn-gold" type="submit">Save consultation</button>
              <button class="btn btn-ghost" type="button" data-act="print-rx">Print Rx</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function viewPatients() {
    const q = (store.q || "").toLowerCase();
    const list = store.data.patients.filter((p) =>
      (p.name + p.mrn + p.phone).toLowerCase().includes(q)
    );
    const rows = list
      .map(
        (p) => `<tr>
        <td class="token">${esc(p.mrn)}</td>
        <td><div class="who"><span class="av">${esc(initials(p.name))}</span>${esc(p.name)}</div></td>
        <td>${p.age} / ${esc(p.sex)}</td>
        <td>${esc(p.phone)}</td>
        <td>${esc(p.address)}</td>
        <td><button class="btn btn-ghost" data-act="edit-patient" data-id="${p.id}">Open</button></td>
      </tr>`
      )
      .join("");
    return `<div class="page-head"><h2>Patients</h2><button class="btn btn-gold" data-act="add-patient">Register</button></div>
      <div class="scroll">
        <div class="toolbar"><input class="search" data-search placeholder="Search name, MRN, phone" value="${esc(store.q || "")}"></div>
        <div class="card"><table>
          <thead><tr><th>MRN</th><th>Name</th><th>Age/Sex</th><th>Phone</th><th>Address</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty">No patients</td></tr>`}</tbody>
        </table></div>
      </div>`;
  }

  const INV_CATALOG = ["ECG", "Echo", "ETT", "Troponin-I", "Lipid profile", "CBC", "HbA1c", "Chest X-ray", "Holter", "Angiography"];

  function viewInvestigations() {
    const rows = store.data.investigations
      .slice()
      .reverse()
      .map((i) => {
        const p = patient(i.patientId);
        return `<tr>
          <td>${esc(p.name)}</td>
          <td>${esc(i.test)}</td>
          <td>${esc(i.date)}</td>
          <td><span class="badge ${i.status === "Completed" ? "done" : "pending"}">${esc(i.status)}</span></td>
          <td>${
            i.status !== "Completed"
              ? `<button class="btn btn-gold" data-act="complete-inv" data-id="${i.id}">Mark done</button>`
              : esc(i.result || "—")
          }</td>
        </tr>`;
      })
      .join("");
    return `<div class="page-head"><h2>Investigations</h2><button class="btn btn-gold" data-act="order-inv">Order test</button></div>
      <div class="scroll"><div class="card"><table>
        <thead><tr><th>Patient</th><th>Test</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="empty">No investigations ordered</td></tr>`}</tbody>
      </table></div></div>`;
  }

  function viewAnalytics() {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().slice(0, 10);
      const n = store.data.visits.filter((v) => v.date === iso).length;
      return { label: d.toLocaleDateString("en-GB", { weekday: "short" }), n };
    });
    const max = Math.max(1, ...days.map((d) => d.n));
    const vis = store.data.visits;
    return `<div class="page-head"><h2>Analytics</h2></div>
      <div class="scroll">
        <div class="stats">
          <div class="stat cyan"><div class="lbl">Total patients</div><div class="num">${store.data.patients.length}</div></div>
          <div class="stat gold"><div class="lbl">Total visits</div><div class="num">${vis.length}</div></div>
          <div class="stat green"><div class="lbl">Consults on file</div><div class="num">${store.data.consultations.length}</div></div>
          <div class="stat orange"><div class="lbl">Investigations</div><div class="num">${store.data.investigations.length}</div></div>
          <div class="stat purple"><div class="lbl">Staff</div><div class="num">${store.data.staff.length}</div></div>
        </div>
        <div class="card pad">
          <div class="card-h" style="padding:0 0 10px"><h3>Visits — last 7 days</h3></div>
          <div class="bars">${days.map((d) => `<div class="bar" style="height:${(d.n / max) * 100}%" title="${d.n}"></div>`).join("")}</div>
          <div class="bar-lbl">${days.map((d) => `<span>${d.label}</span>`).join("")}</div>
        </div>
      </div>`;
  }

  function viewStaff() {
    const rows = store.data.staff
      .map(
        (s) => `<tr>
        <td><div class="who"><span class="av">${esc(initials(s.name))}</span>${esc(s.name)}</div></td>
        <td>${esc(s.role)}</td>
        <td>${esc(s.access)}</td>
        <td>${esc(s.phone || "—")}</td>
        <td><span class="badge ${s.active ? "done" : "wait"}">${s.active ? "Active" : "Off"}</span></td>
      </tr>`
      )
      .join("");
    return `<div class="page-head"><h2>Staff Accounts</h2><button class="btn btn-gold" data-act="add-staff">Add staff</button></div>
      <div class="scroll"><div class="card"><table>
        <thead><tr><th>Name</th><th>Role</th><th>Access</th><th>Phone</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }

  function viewSettings() {
    const c = store.data.clinic;
    return `<div class="page-head"><h2>Settings</h2></div>
      <div class="scroll"><div class="card pad">
        <form class="form-grid" data-form="settings">
          <div class="f"><label>Clinic name</label><input name="name" value="${esc(c.name)}"></div>
          <div class="f"><label>Location</label><input name="location" value="${esc(c.location)}"></div>
          <div class="f"><label>Hospital</label><input name="hospital" value="${esc(c.hospital)}"></div>
          <div class="f"><label>Support phone</label><input name="phone" value="${esc(c.phone)}"></div>
          <div class="f span"><label>Tagline</label><input name="tagline" value="${esc(c.tagline)}"></div>
          <div class="f"><label>Weekday hours</label><input name="hours" value="${esc(c.hours)}"></div>
          <div class="f"><label>Sunday clinic</label><input name="sundayClinic" value="${esc(c.sundayClinic)}"></div>
          <div class="f span" style="display:flex;gap:8px">
            <button class="btn btn-gold" type="submit">Save settings</button>
            <button class="btn btn-ghost" type="button" data-act="reset-demo">Restore demo data</button>
          </div>
        </form>
      </div></div>`;
  }

  function viewProfile() {
    const p = store.data.profile;
    return `<div class="page-head"><h2>My Profile</h2></div>
      <div class="scroll"><div class="card pad">
        <div class="profile-card" style="text-align:left;display:flex;gap:20px;align-items:center">
          <div class="photo" style="margin:0">SU</div>
          <div>
            <h4 style="font-size:22px">${esc(p.name)}</h4>
            <div class="role">${esc(p.role)}</div>
            <p style="color:var(--muted);font-size:13px;max-width:620px">${esc(p.qualifications)}</p>
          </div>
        </div>
        <form class="form-grid" data-form="profile" style="margin-top:18px">
          <div class="f"><label>Display name</label><input name="name" value="${esc(p.name)}"></div>
          <div class="f"><label>Role</label><input name="role" value="${esc(p.role)}"></div>
          <div class="f span"><label>Qualifications</label><input name="qualifications" value="${esc(p.qualifications)}"></div>
          <div class="f"><label>Years of experience</label><input name="experienceYears" type="number" value="${p.experienceYears}"></div>
          <div class="f"><label>Happy patients</label><input name="happyPatients" type="number" value="${p.happyPatients}"></div>
          <div class="f"><label>Success rate %</label><input name="successRate" type="number" value="${p.successRate}"></div>
          <div class="f span"><button class="btn btn-gold" type="submit">Update profile</button></div>
        </form>
        <ul style="margin-top:16px;color:var(--muted);padding-left:18px;line-height:1.8">
          ${(p.affiliations || []).map((a) => `<li>${esc(a)}</li>`).join("")}
        </ul>
      </div></div>`;
  }

  const VIEWS = {
    dashboard: viewDashboard,
    reception: viewReception,
    vitals: viewVitals,
    consultation: viewConsultation,
    patients: viewPatients,
    investigations: viewInvestigations,
    analytics: viewAnalytics,
    staff: viewStaff,
    settings: viewSettings,
    profile: viewProfile,
  };

  function render() {
    store.view = pathView();
    const useRight = store.view === "dashboard";
    app.innerHTML = `<div class="shell ${useRight ? "" : "no-right"}">${sidebar()}
      <main class="main">${(VIEWS[store.view] || viewDashboard)()}</main>
      ${rightPanel()}
    </div>`;
  }

  function fd(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function openModal(title, body, onSubmit) {
    modalRoot.innerHTML = `<div class="modal-back"><div class="modal">
      <h3>${title}</h3>
      <form class="body" data-modal-form>${body}
        <div class="foot">
          <button type="button" class="btn btn-ghost" data-act="close-modal">Cancel</button>
          <button class="btn btn-gold" type="submit">Save</button>
        </div>
      </form>
    </div></div>`;
    $("[data-modal-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      await onSubmit(e.target);
      closeModal();
      await save();
      render();
    });
  }
  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function patientForm(p = {}) {
    return `<div class="form-grid">
      <div class="f"><label>Full name</label><input name="name" required value="${esc(p.name || "")}"></div>
      <div class="f"><label>Age</label><input name="age" type="number" value="${esc(p.age || "")}"></div>
      <div class="f"><label>Sex</label><select name="sex"><option ${p.sex === "M" ? "selected" : ""}>M</option><option ${p.sex === "F" ? "selected" : ""}>F</option></select></div>
      <div class="f"><label>Phone</label><input name="phone" value="${esc(p.phone || "")}"></div>
      <div class="f span"><label>Address</label><input name="address" value="${esc(p.address || "")}"></div>
    </div>`;
  }

  async function addPatientAndMaybeToken(form, withToken) {
    const f = fd(form);
    const n = store.data.next.patient++;
    const rec = {
      id: "p" + n,
      name: f.name,
      age: Number(f.age) || 0,
      sex: f.sex,
      phone: f.phone,
      address: f.address,
      cnic: "",
      mrn: "AHC-" + String(1000 + n),
    };
    store.data.patients.push(rec);
    if (withToken) {
      const tok = nextToken();
      store.data.visits.push({
        id: "v" + store.data.next.visit++,
        token: tok,
        date: todayISO(),
        patientId: rec.id,
        doctorId: store.data.staff[0].id,
        type: "New",
        status: "Waiting",
        complaint: "",
      });
    }
    toast("Patient saved");
  }

  document.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      go(nav.dataset.nav);
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const id = act.dataset.id;
    switch (act.dataset.act) {
      case "close-modal":
        closeModal();
        break;
      case "add-patient":
        openModal("Add New Patient", patientForm(), async (form) => addPatientAndMaybeToken(form, store.view === "reception"));
        break;
      case "edit-patient": {
        const p = store.data.patients.find((x) => x.id === id);
        openModal("Patient", patientForm(p), async (form) => {
          Object.assign(p, fd(form), { age: Number(fd(form).age) || p.age });
          toast("Updated");
        });
        break;
      }
      case "add-staff":
        openModal(
          "Add staff",
          `<div class="form-grid">
            <div class="f"><label>Name</label><input name="name" required></div>
            <div class="f"><label>Role</label><input name="role" value="Receptionist"></div>
            <div class="f"><label>Access</label><select name="access"><option>receptionist</option><option>doctor</option><option>admin</option></select></div>
            <div class="f"><label>Phone</label><input name="phone"></div>
          </div>`,
          async (form) => {
            const f = fd(form);
            store.data.staff.push({
              id: "s" + store.data.next.staff++,
              name: f.name,
              role: f.role,
              access: f.access,
              phone: f.phone,
              active: true,
            });
            toast("Staff added");
          }
        );
        break;
      case "order-inv":
        openModal(
          "Order investigation",
          `<div class="form-grid">
            <div class="f"><label>Patient</label><select name="patientId">${optionsPatients()}</select></div>
            <div class="f"><label>Test</label><select name="test">${INV_CATALOG.map((t) => `<option>${t}</option>`).join("")}</select></div>
          </div>`,
          async (form) => {
            const f = fd(form);
            store.data.investigations.push({
              id: "i" + store.data.next.inv++,
              patientId: f.patientId,
              test: f.test,
              date: todayISO(),
              status: "Pending",
              result: "",
            });
            toast("Investigation ordered");
          }
        );
        break;
      case "complete-inv": {
        const inv = store.data.investigations.find((x) => x.id === id);
        if (inv) inv.status = "Completed";
        await save();
        render();
        break;
      }
      case "start-visit": {
        const v = store.data.visits.find((x) => x.id === id);
        if (v) v.status = "In Progress";
        await save();
        render();
        break;
      }
      case "complete-visit": {
        const v = store.data.visits.find((x) => x.id === id);
        if (v) v.status = "Completed";
        await save();
        render();
        break;
      }
      case "rx":
        store.focusVisit = id;
        go("consultation");
        break;
      case "add-rx-row": {
        const box = $("#rx-rows");
        if (!box) break;
        const row = document.createElement("div");
        row.className = "rx-line";
        row.innerHTML = `<input name="drug" placeholder="Drug"><input name="dose" placeholder="Dose"><input name="freq" placeholder="Freq" value="OD"><input name="days" placeholder="Days" value="7"><button type="button" class="icon-btn" data-act="drop-rx">×</button>`;
        box.appendChild(row);
        break;
      }
      case "drop-rx":
        act.closest(".rx-line")?.remove();
        break;
      case "print-rx":
        window.print();
        break;
      case "reset-demo":
        store.data = await (await fetch("/api/clinic/reset", { method: "POST" })).json();
        toast("Demo data restored");
        render();
        break;
    }
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    const f = fd(form);
    if (kind === "token") {
      if (!f.patientId) return toast("Select a patient");
      store.data.visits.push({
        id: "v" + store.data.next.visit++,
        token: nextToken(),
        date: todayISO(),
        patientId: f.patientId,
        doctorId: f.doctorId,
        type: f.type,
        status: "Waiting",
        complaint: f.complaint,
      });
      toast("Token issued");
    }
    if (kind === "vitals") {
      const visit = store.data.visits.find((v) => v.id === f.visitId);
      if (!visit) return toast("No visit selected");
      store.data.vitals.push({
        id: "vt" + store.data.next.vital++,
        visitId: visit.id,
        patientId: visit.patientId,
        date: todayISO(),
        bpSys: Number(f.bpSys),
        bpDia: Number(f.bpDia),
        hr: Number(f.hr),
        temp: Number(f.temp),
        spo2: Number(f.spo2),
        weight: Number(f.weight),
        height: Number(f.height),
      });
      toast("Vitals saved");
    }
    if (kind === "consult") {
      const visit = store.data.visits.find((v) => v.id === f.visitId);
      if (!visit) return;
      const drugs = [...form.querySelectorAll(".rx-line")].map((row) => {
        const inputs = row.querySelectorAll("input");
        return { drug: inputs[0].value, dose: inputs[1].value, freq: inputs[2].value, days: inputs[3].value };
      }).filter((r) => r.drug);
      const existing = store.data.consultations.find((c) => c.visitId === visit.id);
      const rec = {
        id: existing ? existing.id : "c" + store.data.next.consult++,
        visitId: visit.id,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        date: todayISO(),
        diagnosis: f.diagnosis,
        notes: f.notes,
        rx: drugs,
      };
      if (existing) Object.assign(existing, rec);
      else store.data.consultations.push(rec);
      visit.status = "Completed";
      toast("Consultation saved");
    }
    if (kind === "settings") {
      Object.assign(store.data.clinic, f);
      toast("Settings saved");
    }
    if (kind === "profile") {
      Object.assign(store.data.profile, f, {
        experienceYears: Number(f.experienceYears),
        happyPatients: Number(f.happyPatients),
        successRate: Number(f.successRate),
      });
      toast("Profile updated");
    }
    await save();
    render();
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-search]")) {
      store.q = e.target.value;
      const keep = e.target;
      const pos = keep.selectionStart;
      render();
      const next = $("[data-search]");
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    }
  });

  window.addEventListener("popstate", render);

  load()
    .then(() => {
      store.view = pathView();
      render();
    })
    .catch((err) => {
      app.innerHTML = `<div class="boot">Could not load clinic data. Start with <code>python3 server.py</code><br>${esc(err.message)}</div>`;
    });
})();
