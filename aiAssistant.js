/*
 * 5-PILLAR FINANCE — Rule-Based Finance Assistant
 * -------------------------------------------------
 * This is a lightweight, fully client-side text parser — NOT a connection
 * to an actual AI/LLM. It recognizes common phrasing patterns ("spent 500
 * on groceries", "received 15000 salary today") using keyword matching,
 * then fills in and submits the matching pillar's existing entry form —
 * reusing the exact same code path (and state shape) as typing into the
 * form by hand. It won't understand open-ended phrasing the way a real AI
 * assistant would; a genuine AI integration needs a backend to hold an API
 * key safely, which this project doesn't have (see project notes).
 */
(function () {
  "use strict";

  /* ---------- pillar detection ---------- */
  // Checked in this order on purpose: more specific pillars first, so
  // e.g. "invested" doesn't get caught by a looser "spending" pattern.
  var PILLAR_PATTERNS = [
    { pillar: "investments", regex: /\binvest(ed|ing)?\b|\bstocks?\b|\bmutual fund\b|\buitf\b|\betf\b|\bbonds?\b|\btime deposit\b|\bshares?\b/i },
    { pillar: "protection",  regex: /\bpremium\b|\binsurance\b|\bcoverage\b/i },
    { pillar: "savings",     regex: /\bsav(e|ed|ing|ings)\b|\bemergency fund\b|\bset aside\b|\bput aside\b|\bdeposit(ed)?\b/i },
    { pillar: "income",      regex: /\bearn(ed|ings)?\b|\breceiv(e|ed)\b|\bincome\b|\bsalary\b|\bgot paid\b|\bpaid me\b|\bfreelance\b|\ballowance\b|\bbonus\b/i },
    { pillar: "spending",    regex: /\bspent\b|\bspend\b|\bbought\b|\bpaid for\b|\bexpense\b|\bpurchase(d)?\b/i }
  ];

  function detectPillar(text){
    for(var i=0; i<PILLAR_PATTERNS.length; i++){
      if(PILLAR_PATTERNS[i].regex.test(text)) return PILLAR_PATTERNS[i].pillar;
    }
    return null;
  }

  /* ---------- amount extraction ---------- */
  // Prefers a number explicitly marked as currency (₱500, "500 php",
  // "500 pesos"). Falls back to the LARGEST number in the sentence —
  // financial amounts are typically the biggest number mentioned; smaller
  // numbers are more often quantities ("2 bags") that would otherwise get
  // mistaken for the amount if we just grabbed the first number found.
  function extractAmount(text){
    var marked = text.match(/₱\s*(\d[\d,]*(?:\.\d+)?)/) || text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:php|pesos?)\b/i);
    if(marked){
      var markedVal = parseFloat(marked[1].replace(/,/g, ""));
      if(!isNaN(markedVal)) return { value: markedVal, raw: marked[1] };
    }

    var matches = text.match(/\d[\d,]*(?:\.\d+)?/g);
    if(!matches) return null;
    var best = null, bestVal = -Infinity;
    matches.forEach(function(raw){
      var val = parseFloat(raw.replace(/,/g, ""));
      if(!isNaN(val) && val > bestVal){ bestVal = val; best = raw; }
    });
    if(best === null) return null;
    return { value: bestVal, raw: best };
  }

  /* ---------- category / type / account matching ---------- */
  // Picks the first option (from the same lists used in the dropdowns)
  // that appears as a whole word in the typed text, else falls back to
  // a sensible default so required fields are never left empty.
  function matchOption(text, options, fallback){
    for(var i=0; i<options.length; i++){
      var re = new RegExp("\\b" + options[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if(re.test(text)) return options[i];
    }
    return fallback;
  }

  var CATEGORY_OPTIONS = {
    income:      { list: ["Salary","Business","Freelance","Allowance","Other"], fallback: "Other" },
    spending:    { list: ["Housing","Utilities","Groceries","Transportation","Healthcare","Education","Dining Out","Shopping","Entertainment","Personal Care","Subscriptions","Miscellaneous"], fallback: "Miscellaneous" },
    savings:     { list: ["Bank Savings","Emergency Fund","Digital Bank","Cooperative","Other"], fallback: "Other" },
    investments: { list: ["Stocks","Bonds","Mutual Fund","UITF","ETF","Time Deposit","Other"], fallback: "Other" },
    protection:  { list: ["Health Insurance","Life Insurance","Property Insurance","Vehicle Insurance","Emergency Fund","Other Coverage"], fallback: "Other Coverage" }
  };

  /* ---------- date extraction ---------- */
  function toDateInputValue(date){
    return date.toISOString().slice(0, 10);
  }
  function extractDate(text){
    var now = new Date();
    if(/\byesterday\b/i.test(text)){
      now.setDate(now.getDate() - 1);
    }
    return toDateInputValue(now);
  }

  /* ---------- leftover-text description ---------- */
  // Strips the amount and common filler/trigger words, so whatever's left
  // (if anything sensible) can be used as the entry's description/source.
  var FILLER_WORDS = /\b(spent|spend|bought|paid for|purchase|purchased|earned|earning|earnings|received|income|salary|got paid|paid me|invested|investing|premium|insurance|coverage|saved|saving|savings|set aside|put aside|deposit|deposited|today|yesterday|php|peso|pesos|on|for|at|from|of|to|in|my|the|a|an|and)\b/gi;

  function extractDescription(text, rawAmount){
    var cleaned = text
      .replace(/₱/g, "")
      .replace(rawAmount, "")
      .replace(FILLER_WORDS, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned;
  }

  /* ---------- form field maps per pillar ---------- */
  // required = fields that must not be left empty for the form to submit.
  var PILLAR_FORMS = {
    income: {
      formId: "form-income", panelId: "panel-income", tabPanel: "income",
      fields: function(amount, category, desc, date){
        return {
          "in-date": date,
          "in-source": desc || category,
          "in-category": category,
          "in-actual": amount
          // in-expected / in-status: left as their defaults, not required
        };
      }
    },
    spending: {
      formId: "form-spending", panelId: "panel-spending", tabPanel: "spending",
      fields: function(amount, category, desc){
        return {
          "sp-desc": desc || category,
          "sp-category": category,
          "sp-budget": amount,
          "sp-actual": amount
        };
      }
    },
    savings: {
      formId: "form-savings", panelId: "panel-savings", tabPanel: "savings",
      fields: function(amount, category, desc){
        return {
          "sv-goal": desc || category,
          "sv-account": category,
          "sv-target": amount,
          "sv-saved": amount
        };
      }
    },
    investments: {
      formId: "form-investments", panelId: "panel-investments", tabPanel: "investments",
      fields: function(amount, category, desc){
        return {
          "iv-type": category,
          "iv-platform": desc || "Manual entry",
          "iv-invested": amount,
          "iv-current": amount
        };
      }
    },
    protection: {
      formId: "form-protection", panelId: "panel-protection", tabPanel: "protection",
      fields: function(amount, category, desc){
        return {
          "pr-type": category,
          "pr-provider": desc || "Manual entry",
          "pr-premium": amount
        };
      }
    }
  };

  var PILLAR_LABELS = {
    income: "Income", spending: "Spending", savings: "Savings",
    investments: "Investments", protection: "Protection"
  };

  // Which field in each pillar's entries holds the headline peso amount —
  // used for answering "how much..." questions from real logged data.
  var VALUE_FIELD_BY_PILLAR = {
    income: "actual", spending: "actual", savings: "saved",
    investments: "current", protection: "premium"
  };

  var UNDO_PATTERN = /\b(undo|delete (the )?last( entry)?|remove (the )?last( entry)?|cancel (that|last))\b/i;
  var QUERY_PATTERN = /\b(how much|how many|what'?s|what is|total)\b/i;

  // Tracks the single most recent entry the assistant itself added this
  // session, so "undo" removes exactly that — never anything the user
  // added by hand through the forms.
  var lastAdded = null;

  function answerQuery(pillar, text){
    var state = window.getDashboardState ? window.getDashboardState() : null;
    var list = (state && state[pillar]) || [];
    var field = VALUE_FIELD_BY_PILLAR[pillar];
    var label = PILLAR_LABELS[pillar].toLowerCase();

    if(list.length === 0){
      return { ok: true, reply: "You don't have any " + label + " entries logged yet." };
    }

    var total = list.reduce(function(sum, e){ return sum + (Number(e[field]) || 0); }, 0);
    var amountText = "\u20B1" + total.toLocaleString("en-PH");
    var countText = list.length + (list.length === 1 ? " entry" : " entries");
    return { ok: true, reply: "Your total " + label + " right now is " + amountText + " across " + countText + "." };
  }

  /* ---------- main parse + fill + submit ---------- */
  function handleMessage(text){
    if(UNDO_PATTERN.test(text)){
      if(!lastAdded){
        return { ok: false, reply: "There's nothing for me to undo yet — I haven't logged anything this session." };
      }
      var removed = window.deleteDashboardEntry ? window.deleteDashboardEntry(lastAdded.pillar, lastAdded.id) : false;
      var label = lastAdded.label;
      lastAdded = null;
      if(removed) return { ok: true, reply: "Undone — removed " + label + "." };
      return { ok: false, reply: "Couldn't find that entry anymore — it may have already been edited or removed." };
    }

    var pillar = detectPillar(text);
    var amountInfo = extractAmount(text);

    if(pillar && !amountInfo && QUERY_PATTERN.test(text)){
      return answerQuery(pillar, text);
    }

    if(!pillar || !amountInfo){
      return {
        ok: false,
        reply: "I couldn't quite tell what to log from that. Try something like " +
               "\u201Cspent 500 on groceries yesterday\u201D or \u201Creceived 15000 salary today.\u201D " +
               "Include an amount and a word like spent / received / saved / invested / premium. " +
               "You can also ask things like \u201Chow much have I spent?\u201D or say \u201Cundo\u201D."
      };
    }
    var amount = amountInfo.value;

    var categoryConfig = CATEGORY_OPTIONS[pillar];
    var category = matchOption(text, categoryConfig.list, categoryConfig.fallback);
    var desc = extractDescription(text, amountInfo.raw);
    var date = extractDate(text);

    var formConfig = PILLAR_FORMS[pillar];
    var form = document.getElementById(formConfig.formId);
    if(!form) return { ok:false, reply:"Something's off — I couldn't find that section of the dashboard." };

    var values = formConfig.fields(amount, category, desc, date);
    Object.keys(values).forEach(function(fieldId){
      var el = document.getElementById(fieldId);
      if(el && values[fieldId] !== undefined && values[fieldId] !== "") el.value = values[fieldId];
    });

    // Switch to the relevant tab so the user can see where the entry landed.
    var tab = document.getElementById("tab-" + formConfig.tabPanel);
    if(tab) tab.click();

    // Submitting the real form re-uses the app's existing add-entry logic
    // and state shape exactly — no duplicated push-to-state code here.
    if(typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { cancelable: true }));

    var amountText = "\u20B1" + amount.toLocaleString("en-PH");
    var summary = amountText + " under " + PILLAR_LABELS[pillar] +
                  " (" + category + ")" + (desc ? ", \u201C" + desc + "\u201D" : "");

    // The form handler pushes synchronously, so the just-added entry is
    // now the last item in that pillar's array — remember it for "undo".
    var stateAfter = window.getDashboardState ? window.getDashboardState() : null;
    var listAfter = stateAfter && stateAfter[pillar];
    var newEntry = listAfter && listAfter[listAfter.length - 1];
    lastAdded = newEntry ? { pillar: pillar, id: newEntry.id, label: summary } : null;

    return { ok: true, reply: "Got it — logged " + summary + "." };
  }

  /* ---------- widget wiring ---------- */
  function init(){
    var toggle = document.getElementById("ai-assistant-toggle");
    var panel = document.getElementById("ai-assistant-panel");
    var closeBtn = document.getElementById("ai-assistant-close");
    var log = document.getElementById("ai-assistant-log");
    var form = document.getElementById("ai-assistant-form");
    var input = document.getElementById("ai-assistant-input");
    if(!toggle || !panel || !form || !input || !log) return; // widget markup not present on this page

    // Remembers whether the panel was open across page reloads/navigation
    // (e.g. the browser Back button) for this browser tab session — so
    // closing it and coming back later doesn't silently reset it to closed.
    var OPEN_STATE_KEY = "five-pillar-assistant-open";

    function addMessage(text, who){
      var p = document.createElement("p");
      p.className = "ai-assistant-msg ai-assistant-msg-" + who;
      p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    }

    function openPanel(focusInput){
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      try{ sessionStorage.setItem(OPEN_STATE_KEY, "1"); }catch(e){}
      if(focusInput !== false) input.focus();
    }
    function closePanel(){
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      try{ sessionStorage.setItem(OPEN_STATE_KEY, "0"); }catch(e){}
    }

    toggle.addEventListener("click", function(){
      if(panel.hidden) openPanel(); else closePanel();
    });
    closeBtn.addEventListener("click", closePanel);
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Escape" && !panel.hidden) closePanel();
    });

    // Restore whatever state this tab last left the assistant in, without
    // stealing focus the moment the page loads.
    try{
      if(sessionStorage.getItem(OPEN_STATE_KEY) === "1") openPanel(false);
    }catch(e){}

    form.addEventListener("submit", function(ev){
      ev.preventDefault();
      var text = input.value.trim();
      if(!text) return;
      addMessage(text, "user");
      input.value = "";

      var result = handleMessage(text);
      addMessage(result.reply, "bot");
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
