/*
 * 5-PILLAR FINANCE — Dashboard — Firebase Edition
 * ----------------------------------------------------
 * Dashboard data now lives in Firestore (collection "dashboards", one
 * document per user, keyed by their Firebase Auth uid) instead of
 * localStorage — so the same account sees the same data on any device.
 *
 * Because Firestore reads/writes are asynchronous (unlike the old
 * synchronous localStorage calls), the whole dashboard now waits for
 * auth.onAuthStateChanged() to resolve, then loads the user's data,
 * THEN wires up the interactive UI. This also fixes a subtle race the
 * old version couldn't have: nothing is clickable/submittable until the
 * real data has actually loaded, so a fast click right after page load
 * can't submit against not-yet-loaded state and then get overwritten.
 *
 * Requires firebase-config.js to be loaded first.
 */
(function(){
  "use strict";

  const auth = window.auth;
  const db = window.db;

  const uid = () => Math.random().toString(36).slice(2, 10);

  let state = {income:[],savings:[],spending:[],investments:[],protection:[]};
  let currentUser = null; // { uid, email, name, avatar }
  let saveTimer = null;

  const money = n => "₱" + Math.round(Number(n)||0).toLocaleString("en-PH");
  const pct = n => (Number.isFinite(n) ? Math.round(n*1000)/10 : 0) + "%";
  const sum = (arr, fn) => arr.reduce((a,e)=>a+(Number(fn(e))||0), 0);
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---------- Firestore load / save ---------- */
  function dashboardDocRef(userUid){
    return db.collection("dashboards").doc(userUid);
  }

  async function loadState(userUid){
    try{
      const snap = await dashboardDocRef(userUid).get();
      if(snap.exists){
        const data = snap.data() || {};
        return {
          income: data.income || [],
          savings: data.savings || [],
          spending: data.spending || [],
          investments: data.investments || [],
          protection: data.protection || []
        };
      }
    }catch(e){
      console.error("Failed to load dashboard data:", e);
    }
    return {income:[],savings:[],spending:[],investments:[],protection:[]};
  }

  // Fire-and-forget, but coalesced: rapid successive renderAll() calls
  // (e.g. several quick edits) collapse into one Firestore write shortly
  // after the last change, instead of writing on every single change.
  function saveState(){
    if(!currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      dashboardDocRef(currentUser.uid).set(state).catch(e=>{
        console.error("Failed to save dashboard data:", e);
      });
    }, 400);
  }

  function logout(){
    auth.signOut().then(() => {
      window.location.replace("./index.html");
    }).catch(e => {
      console.error("Sign-out failed:", e);
      window.location.replace("./index.html"); // still leave the page either way
    });
  }

  /* ---------- generic row builder ---------- */
  function rows(tbodyId, list, colsFn, emptyMsg){
    const tbody = document.getElementById(tbodyId);
    if(!list.length){
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">'+emptyMsg+'</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(e => "<tr>"+colsFn(e)+'<td><button class="del-btn" data-id="'+e.id+'" aria-label="Delete entry">✕</button></td></tr>').join("");
  }

  /* ---------- render: income ---------- */
  function renderIncome(){
    rows("income-body", state.income, e =>
      `<td>${esc(e.date)}</td><td>${esc(e.source)}</td><td><span class="tag">${esc(e.category)}</span></td><td>${money(e.expected)}</td><td>${money(e.actual)}</td><td>${esc(e.status)}</td>`,
      "No income logged yet — add your first entry above.");
    document.getElementById("income-total").textContent = money(totalIncome());
  }

  /* ---------- render: savings ---------- */
  function renderSavings(){
    rows("savings-body", state.savings, e => {
      const progress = e.target>0 ? e.saved/e.target : 0;
      const remaining = Math.max(e.target - e.saved, 0);
      return `<td>${esc(e.goal)}</td><td>${esc(e.account)}</td><td>${money(e.target)}</td><td>${money(e.saved)}</td><td>${pct(progress)}</td><td>${money(remaining)}</td><td>${esc(e.deadline||"—")}</td>`;
    }, "No savings goals yet — add one above.");
    document.getElementById("savings-total").textContent = money(totalSavings());
    document.getElementById("savings-target-total").textContent = money(sum(state.savings, e=>e.target));
  }

  /* ---------- render: spending ---------- */
  function renderSpending(){
    rows("spending-body", state.spending, e => {
      const diff = (Number(e.budget)||0) - (Number(e.actual)||0);
      const cls = diff >= 0 ? "pos" : "neg";
      return `<td>${esc(e.desc)}</td><td><span class="tag">${esc(e.category)}</span></td><td>${esc(e.need)}</td><td>${esc(e.method)}</td><td>${money(e.budget)}</td><td>${money(e.actual)}</td><td class="${cls}">${money(diff)}</td>`;
    }, "No spending logged yet — add your first entry above.");
    document.getElementById("spending-total").textContent = money(totalSpending());
    const needsActual = sum(state.spending.filter(e=>e.need==="Need"), e=>e.actual);
    const wantsActual = sum(state.spending.filter(e=>e.need==="Want"), e=>e.actual);
    const spendTotal = needsActual + wantsActual;
    document.getElementById("needs-pct").textContent = pct(spendTotal>0 ? needsActual/spendTotal : 0);
    document.getElementById("wants-pct").textContent = pct(spendTotal>0 ? wantsActual/spendTotal : 0);
  }

  /* ---------- render: investments ---------- */
  function renderInvestments(){
    rows("investments-body", state.investments, e => {
      const gain = (Number(e.current)||0) - (Number(e.invested)||0);
      const ret = e.invested>0 ? gain/e.invested : 0;
      const cls = gain >= 0 ? "pos" : "neg";
      return `<td>${esc(e.type)}</td><td>${esc(e.platform)}</td><td>${money(e.invested)}</td><td>${money(e.current)}</td><td class="${cls}">${money(gain)}</td><td class="${cls}">${pct(ret)}</td><td>${esc(e.risk)}</td>`;
    }, "No investments logged yet — add one above.");
    const invested = totalInvestments();
    const current = portfolioValue();
    document.getElementById("inv-total").textContent = money(invested);
    document.getElementById("inv-portfolio").textContent = money(current);
    document.getElementById("inv-return").textContent = pct(invested>0 ? (current-invested)/invested : 0);
  }

  /* ---------- render: protection ---------- */
  function renderProtection(){
    rows("protection-body", state.protection, e =>
      `<td>${esc(e.type)}</td><td>${esc(e.provider)}</td><td>${money(e.coverage)}</td><td>${money(e.premium)}</td><td>${esc(e.frequency)}</td><td>${esc(e.status)}</td>`,
      "No protection items logged yet — add one above.");
    document.getElementById("prot-total").textContent = money(totalProtection());
    document.getElementById("prot-active").textContent = state.protection.filter(e=>e.status==="Active").length;
  }

  /* ---------- totals ---------- */
  function totalIncome(){ return sum(state.income, e=>e.actual); }
  function totalSpending(){ return sum(state.spending, e=>e.actual); }
  function totalSavings(){ return sum(state.savings, e=>e.saved); }
  function totalInvestments(){ return sum(state.investments, e=>e.invested); }
  function portfolioValue(){ return sum(state.investments, e=>e.current); }
  function totalProtection(){ return sum(state.protection, e=>e.premium); }

  /* ---------- dashboard ---------- */
  function renderDashboard(){
    const income = totalIncome(), spending = totalSpending(), savings = totalSavings(),
          investments = totalInvestments(), protection = totalProtection();
    const availableCash = income - savings - spending - investments - protection;

    document.getElementById("kpi-income").textContent = money(income);
    document.getElementById("kpi-spending").textContent = money(spending);
    document.getElementById("kpi-savings").textContent = money(savings);
    document.getElementById("kpi-investments").textContent = money(investments);
    document.getElementById("kpi-protection").textContent = money(protection);
    document.getElementById("available-cash").textContent = money(availableCash);
    document.getElementById("savings-rate").textContent = pct(income>0 ? savings/income : 0);
    document.getElementById("investment-rate").textContent = pct(income>0 ? investments/income : 0);
    document.getElementById("portfolio-value").textContent = money(portfolioValue());
    const invReturn = investments>0 ? (portfolioValue()-investments)/investments : 0;
    document.getElementById("overall-return").textContent = pct(invReturn);

    const needsActual = sum(state.spending.filter(e=>e.need==="Need"), e=>e.actual);
    const wantsActual = sum(state.spending.filter(e=>e.need==="Want"), e=>e.actual);
    const splitTotal = needsActual + wantsActual + savings;
    const needsPct = splitTotal>0 ? needsActual/splitTotal : 0.5;
    const wantsPct = splitTotal>0 ? wantsActual/splitTotal : 0.3;
    const savePct = splitTotal>0 ? savings/splitTotal : 0.2;
    document.getElementById("seg-needs").style.width = (needsPct*100)+"%";
    document.getElementById("seg-wants").style.width = (wantsPct*100)+"%";
    document.getElementById("seg-save").style.width = (savePct*100)+"%";
    document.getElementById("split-caption").textContent =
      `Needs ${pct(needsPct)} · Wants ${pct(wantsPct)} · Savings & Goals ${pct(savePct)} — guideline is 50 / 30 / 20`;

    const byCategory = {};
    state.spending.forEach(e=>{
      if(!byCategory[e.category]) byCategory[e.category] = {budget:0, actual:0};
      byCategory[e.category].budget += Number(e.budget)||0;
      byCategory[e.category].actual += Number(e.actual)||0;
    });
    const cats = Object.keys(byCategory);
    const budgetRows = document.getElementById("budget-rows");
    if(!cats.length){
      budgetRows.innerHTML = '<p class="bar-caption">No spending logged yet.</p>';
    }else{
      budgetRows.innerHTML = cats.map(cat=>{
        const {budget, actual} = byCategory[cat];
        const ratio = budget>0 ? actual/budget : (actual>0 ? 1.5 : 0);
        let color = "var(--green)";
        if(ratio > 1) color = "var(--rust)";
        else if(ratio > 0.9) color = "var(--amber)";
        const width = Math.min(ratio*100, 100);
        return `<div class="budget-row">
          <span>${esc(cat)}</span>
          <span class="rtrack"><span class="rfill" style="width:${width}%; background:${color};"></span></span>
          <span class="ramt">${money(actual)} / ${money(budget)}</span>
        </div>`;
      }).join("");
    }
  }

  function renderUserBadge(){
    document.getElementById("user-name-text").textContent = "Signed in: " + currentUser.name;
    const avatarImg = document.getElementById("user-avatar");
    const avatarFallback = document.getElementById("user-avatar-fallback");
    if(currentUser.avatar){
      avatarImg.src = currentUser.avatar;
      avatarImg.hidden = false;
      avatarFallback.hidden = true;
    } else {
      avatarFallback.textContent = (currentUser.name || "?").trim().charAt(0).toUpperCase();
      avatarFallback.hidden = false;
      avatarImg.hidden = true;
    }
  }

  function renderAll(){
    renderIncome(); renderSavings(); renderSpending(); renderInvestments(); renderProtection(); renderDashboard();
    saveState();
  }

  /* ---------- tab switching ---------- */
  function setupTabs(){
    const tabEls = Array.from(document.querySelectorAll(".tab"));

    function activateTab(tab){
      tabEls.forEach(t=>{
        const isActive = t === tab;
        t.classList.toggle("is-active", isActive);
        t.setAttribute("aria-selected", isActive ? "true" : "false");
        t.tabIndex = isActive ? 0 : -1;
      });
      document.querySelectorAll(".panel").forEach(p=>p.classList.remove("is-active"));
      document.getElementById("panel-"+tab.dataset.panel).classList.add("is-active");
    }

    tabEls.forEach(tab=>{
      tab.addEventListener("click", ()=> activateTab(tab));
    });

    // Left/Right (and Home/End) move focus + selection between tabs, matching
    // the standard ARIA tabs keyboard pattern for screen reader / keyboard users.
    document.querySelector(".tabbar-tabs").addEventListener("keydown", ev=>{
      const currentIndex = tabEls.indexOf(document.activeElement);
      if(currentIndex === -1) return;
      let nextIndex = null;
      if(ev.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabEls.length;
      else if(ev.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabEls.length) % tabEls.length;
      else if(ev.key === "Home") nextIndex = 0;
      else if(ev.key === "End") nextIndex = tabEls.length - 1;
      if(nextIndex === null) return;
      ev.preventDefault();
      tabEls[nextIndex].focus();
      activateTab(tabEls[nextIndex]);
    });
  }

  /* ---------- delete handlers (event delegation) ---------- */
  function setupDeleteHandlers(){
    const tables = {
      "income-body": "income", "savings-body": "savings", "spending-body": "spending",
      "investments-body": "investments", "protection-body": "protection"
    };
    Object.keys(tables).forEach(tbodyId=>{
      document.getElementById(tbodyId).addEventListener("click", ev=>{
        const btn = ev.target.closest(".del-btn");
        if(!btn) return;
        if(!confirm("Delete this entry? This can't be undone.")) return;
        const key = tables[tbodyId];
        state[key] = state[key].filter(e=>e.id !== btn.dataset.id);
        renderAll();
      });
    });
  }

  /* ---------- form handlers ---------- */
  function setupForms(){
    document.getElementById("form-income").addEventListener("submit", ev=>{
      ev.preventDefault();
      state.income.push({
        id:uid(), date:document.getElementById("in-date").value || "—",
        source:document.getElementById("in-source").value,
        category:document.getElementById("in-category").value,
        expected:document.getElementById("in-expected").value,
        actual:document.getElementById("in-actual").value,
        status:document.getElementById("in-status").value
      });
      ev.target.reset();
      renderAll();
    });

    document.getElementById("form-savings").addEventListener("submit", ev=>{
      ev.preventDefault();
      state.savings.push({
        id:uid(), goal:document.getElementById("sv-goal").value,
        account:document.getElementById("sv-account").value,
        target:document.getElementById("sv-target").value,
        saved:document.getElementById("sv-saved").value,
        deadline:document.getElementById("sv-deadline").value
      });
      ev.target.reset();
      renderAll();
    });

    document.getElementById("form-spending").addEventListener("submit", ev=>{
      ev.preventDefault();
      state.spending.push({
        id:uid(), desc:document.getElementById("sp-desc").value,
        category:document.getElementById("sp-category").value,
        need:document.getElementById("sp-need").value,
        method:document.getElementById("sp-method").value,
        budget:document.getElementById("sp-budget").value,
        actual:document.getElementById("sp-actual").value,
        recurring:document.getElementById("sp-recurring").value
      });
      ev.target.reset();
      renderAll();
    });

    document.getElementById("form-investments").addEventListener("submit", ev=>{
      ev.preventDefault();
      state.investments.push({
        id:uid(), type:document.getElementById("iv-type").value,
        platform:document.getElementById("iv-platform").value,
        invested:document.getElementById("iv-invested").value,
        current:document.getElementById("iv-current").value,
        risk:document.getElementById("iv-risk").value
      });
      ev.target.reset();
      renderAll();
    });

    document.getElementById("form-protection").addEventListener("submit", ev=>{
      ev.preventDefault();
      state.protection.push({
        id:uid(), type:document.getElementById("pr-type").value,
        provider:document.getElementById("pr-provider").value,
        coverage:document.getElementById("pr-coverage").value,
        premium:document.getElementById("pr-premium").value,
        frequency:document.getElementById("pr-frequency").value,
        status:document.getElementById("pr-status").value
      });
      ev.target.reset();
      renderAll();
    });

    document.getElementById("reset-all").addEventListener("click", ()=>{
      if(confirm("Reset all of your dashboard data? This only affects your account.")){
        state = {income:[],savings:[],spending:[],investments:[],protection:[]};
        renderAll();
      }
    });
  }

  /* ---------- backup: export / import ---------- */
  // Firestore is now the primary copy, synced across devices — but export/
  // import is still handy as a manual backup/migration tool.
  function setupBackup(){
    document.getElementById("export-data-btn").addEventListener("click", ()=>{
      const payload = {
        exportedAt: new Date().toISOString(),
        account: currentUser.email,
        data: state
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `5-pillar-finance-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    const REQUIRED_KEYS = ["income","savings","spending","investments","protection"];

    document.getElementById("import-data-input").addEventListener("change", ev=>{
      const file = ev.target.files && ev.target.files[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try{
          parsed = JSON.parse(reader.result);
        }catch(e){
          alert("That file isn't valid JSON — couldn't read it as a backup file.");
          ev.target.value = "";
          return;
        }

        const incoming = parsed && parsed.data ? parsed.data : parsed; // accept either a full export or a raw state object
        const looksValid = incoming && REQUIRED_KEYS.every(k => Array.isArray(incoming[k]));
        if(!looksValid){
          alert("That file doesn't look like a 5-Pillar Finance backup (missing expected data).");
          ev.target.value = "";
          return;
        }

        if(!confirm("Restore this backup? It will replace all of your current dashboard data.")){
          ev.target.value = "";
          return;
        }

        state = {
          income: incoming.income,
          savings: incoming.savings,
          spending: incoming.spending,
          investments: incoming.investments,
          protection: incoming.protection
        };
        renderAll();
        ev.target.value = "";
        alert("Backup restored.");
      };
      reader.onerror = () => {
        alert("Couldn't read that file.");
        ev.target.value = "";
      };
      reader.readAsText(file);
    });
  }

  /* ---------- table search / filter ---------- */
  function setupTableFilters(){
    var TABLE_FILTERS = [
      { tbodyId: "income-body",       inputId: "income-filter" },
      { tbodyId: "savings-body",      inputId: "savings-filter" },
      { tbodyId: "spending-body",     inputId: "spending-filter" },
      { tbodyId: "investments-body",  inputId: "investments-filter" },
      { tbodyId: "protection-body",   inputId: "protection-filter" }
    ];

    function setupTableFilter(config){
      var input = document.getElementById(config.inputId);
      var tbody = document.getElementById(config.tbodyId);
      if(!input || !tbody) return;

      function applyFilter(){
        var query = input.value.trim().toLowerCase();
        Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function(row){
          var text = row.textContent.toLowerCase();
          row.style.display = (!query || text.indexOf(query) !== -1) ? "" : "none";
        });
      }

      input.addEventListener("input", applyFilter);

      if(window.MutationObserver){
        new MutationObserver(applyFilter).observe(tbody, { childList: true });
      }
    }

    TABLE_FILTERS.forEach(setupTableFilter);
  }

  /* ---------- boot sequence ---------- */
  auth.onAuthStateChanged(async (user) => {
    if(!user){
      window.location.replace("./index.html");
      return;
    }

    // Load this user's profile (name/avatar) from Firestore. Fall back to
    // the Auth displayName if the profile doc is missing for some reason.
    let profile = { name: user.displayName || "there", avatar: null };
    try{
      const profileSnap = await db.collection("users").doc(user.uid).get();
      if(profileSnap.exists){
        const data = profileSnap.data();
        profile = { name: data.name || profile.name, avatar: data.avatar || null };
      }
    }catch(e){
      console.error("Failed to load user profile:", e);
    }

    currentUser = { uid: user.uid, email: user.email, name: profile.name, avatar: profile.avatar };
    state = await loadState(user.uid);

    renderUserBadge();
    document.getElementById("logout-btn").addEventListener("click", logout);

    setupTabs();
    setupDeleteHandlers();
    setupForms();
    setupBackup();
    setupTableFilters();

    // Exposed so other scripts (e.g. the pie-chart renderer, the assistant)
    // can read/modify the real data directly.
    window.getDashboardState = function(){ return state; };
    window.deleteDashboardEntry = function(pillar, id){
      if(!state[pillar]) return false;
      var before = state[pillar].length;
      state[pillar] = state[pillar].filter(function(e){ return e.id !== id; });
      var removed = state[pillar].length < before;
      if(removed) renderAll();
      return removed;
    };

    renderAll();
  });
})();