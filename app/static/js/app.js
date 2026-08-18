const AHC = {
  toast(msg, type = "success") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = "toast " + (type === "error" ? "error" : "");
    clearTimeout(AHC._t);
    AHC._t = setTimeout(() => { el.hidden = true; }, 2800);
  },
  async postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      const detail = data.detail;
      data.ok = false;
      data.detail = typeof detail === "string" ? detail : (detail && detail[0] && detail[0].msg) || "Request failed";
      return data;
    }
    data.ok = true;
    return data;
  },
  bindPatientSearch() {
    const input = document.getElementById("patient-search");
    const box = document.getElementById("search-results");
    if (!input || !box) return;
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) { box.style.display = "none"; return; }
        const rows = await fetch("/api/patients/search?q=" + encodeURIComponent(q)).then(r => r.json());
        box.innerHTML = rows.map(p =>
          `<button type="button" data-id="${p.id}">${p.name} · ${p.patient_code}<br><small>${p.phone || ""} ${p.age || ""}/${p.gender}</small></button>`
        ).join("") || "<div style='padding:10px'>No match</div>";
        box.style.display = "block";
        box.querySelectorAll("button").forEach(btn => btn.onclick = () => {
          const p = rows.find(x => String(x.id) === btn.dataset.id);
          document.getElementById("patient_id").value = p.id;
          document.getElementById("name").value = p.name;
          document.getElementById("age").value = p.age || "";
          document.getElementById("gender").value = p.gender;
          document.getElementById("phone").value = p.phone || "";
          document.getElementById("cnic").value = p.cnic || "";
          document.getElementById("address").value = p.address || "";
          document.getElementById("visit_type").value = "FOLLOW_UP";
          box.style.display = "none";
        });
      }, 220);
    });
  },
  bindDrugSearch(addRow) {
    const input = document.getElementById("drug-search");
    const box = document.getElementById("drug-results");
    if (!input || !box) return;
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        const rows = await fetch("/api/drugs?q=" + encodeURIComponent(q)).then(r => r.json());
        box.innerHTML = rows.map(d =>
          `<button type="button" data-id="${d.id}">${d.name} ${d.strength}</button>`
        ).join("");
        box.style.display = rows.length ? "block" : "none";
        box.querySelectorAll("button").forEach(btn => btn.onclick = () => {
          const d = rows.find(x => String(x.id) === btn.dataset.id);
          addRow({
            drug_id: d.id,
            drug_name: d.name,
            generic_name: d.generic_name,
            strength: d.strength,
            dosage: d.default_dosage,
            route: d.default_route,
            frequency: d.default_frequency.includes("OD") ? "OD (Once daily)" : d.default_frequency,
            duration: d.default_duration,
            instructions: d.default_instructions,
          });
          input.value = "";
          box.style.display = "none";
        });
      }, 180);
    });
  },
};
