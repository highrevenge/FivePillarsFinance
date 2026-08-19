(function(){
  "use strict";

  const SESSION_KEY = "five-pillar-finance-session-v2";
  const USERS_KEY = "five-pillar-finance-users-v2";
  const DATA_PREFIX = "five-pillar-user-data-v2:";
  const uid = () => Math.random().toString(36).slice(2, 10);

  const seed = {
    income: [
      {id:uid(), date:"2026-08-01", source:"Salary", category:"Salary", expected:25000, actual:25000, status:"Received"},
      {id:uid(), date:"2026-08-05", source:"Freelance", category:"Freelance", expected:5000, actual:3500, status:"Partial"},
      {id:uid(), date:"2026-08-10", source:"Business", category:"Business", expected:8000, actual:8000, status:"Received"}
    ],
    savings: [
      {id:uid(), goal:"Emergency Fund", account:"Emergency Fund", target:30000, saved:5000, deadline:"2026-12-31"},
      {id:uid(), goal:"Tuition", account:"Bank Savings", target:20000, saved:8000, deadline:"2026-10-30"}
    ],
    spending: [
      {id:uid(), desc:"Rent", category:"Housing", need:"Need", method:"Bank Transfer", budget:8000, actual:8000, recurring:"Recurring"},
      {id:uid(), desc:"Groceries", category:"Groceries", need:"Need", method:"GCash", budget:4000, actual:3500, recurring:"One-Time"},
      {id:uid(), desc:"Dinner", category:"Dining Out", need:"Want", method:"GCash", budget:1500, actual:1800, recurring:"One-Time"},
      {id:uid(), desc:"Streaming", category:"Subscriptions", need:"Want", method:"Debit Card", budget:500, actual:500, recurring:"Recurring"}
    ],
    investments: [
      {id:uid(), type:"Stocks", platform:"Brokerage", invested:5000, current:5200, risk:"Moderate"},
      {id:uid(), type:"UITF", platform:"Bank", invested:3000, current:3050, risk:"Moderate"}
    ],
    protection: [
      {id:uid(), type:"Health Insurance", provider:"Sample Provider", coverage:500000, premium:1200, frequency:"Monthly", status:"Active"},
      {id:uid(), type:"Emergency Fund", provider:"Bank", coverage:30000, premium:3000, frequency:"Monthly", status:"Active"}
    ]
  };

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
    catch(e){ return {}; }
  }

  function getSession(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch(e){ return null; }
  }

  const session = getSession();
  const sessionEmail = session && session.email;
  const users = getUsers();

  if(!sessionEmail || !users[sessionEmail]){
    window.location.replace("./index.html");
    throw new Error("Login required.");
  }

  const currentUser = users[sessionEmail];

  function loadState(){
    try{
      const raw = localStorage.getItem(DATA_PREFIX + currentUser.email);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return {income:[],savings:[],spending:[],investments:[],protection:[]};
  }

  function saveState(){
    try{
      localStorage.setItem(DATA_PREFIX + currentUser.email, JSON.stringify(state));
    }catch(e){}
  }

  function logout(){
    try {
      saveState();
    } catch(e) {}

    localStorage.removeItem(SESSION_KEY);
    window.location.replace("./index.html");
  }

  let state = loadState();

  const money = n => "₱" + Math.round(Number(n)||0).toLocaleString("en-PH");
  const pct = n => (Number.isFinite(n) ? Math.round(n*1000)/10 : 0) + "%";
  const sum = (arr, fn) => arr.reduce((a,e)=>a+(Number(fn(e))||0), 0);
  const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---------- tab switching ---------- */
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

  document.getElementById("user-name-text").textContent = "Signed in: " + currentUser.name;
  (function(){
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
  })();
  document.getElementById("logout-btn").addEventListener("click", logout);

  function renderAll(){
    renderIncome(); renderSavings(); renderSpending(); renderInvestments(); renderProtection(); renderDashboard();
    saveState();
  }

  /* ---------- delete handlers (event delegation) ---------- */
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

  /* ---------- form handlers ---------- */
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

  /* ---------- backup: export / import ---------- */
  // Data only lives in this browser's localStorage — clearing browser data,
  // switching devices, or a corrupted profile loses it permanently. These
  // let the user save a copy to a file and restore it later.
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

  // Exposed so other scripts (e.g. the pie-chart renderer) can read the
  // real numeric data directly instead of re-parsing formatted table text.
  // This is a function (not a direct reference) because `state` gets
  // reassigned on "reset all" — the function always returns the current one.
  window.getDashboardState = function(){ return state; };

  renderAll();
})();
