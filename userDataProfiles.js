(function () {
  "use strict";

  // Must match systemDashboard.js's SESSION_KEY — this is how we know
  // *which* signed-in account the saved profile edit belongs to.
  var SESSION_KEY = "five-pillar-finance-session-v2";
  var NAME_PREFIX = "Signed in: ";

  function currentUserEmail() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return "";
      var session = JSON.parse(raw);
      return (session && session.email) || "";
    } catch (e) { return ""; }
  }

  // Per-account storage key (e.g. "dashboard-user-profile:monaliza@example.com").
  // Returns null if we can't identify the signed-in user, so we never fall
  // back to a shared key that would leak one account's edits into another's.
  function storageKey() {
    var email = currentUserEmail();
    return email ? "dashboard-user-profile:" + email : null;
  }

  function stripSignedInPrefix(text) {
    text = (text || "").trim();
    return text.indexOf(NAME_PREFIX) === 0 ? text.slice(NAME_PREFIX.length) : text;
  }

  var menu          = document.getElementById("user-menu");
  var trigger        = document.getElementById("user-menu-trigger");
  var dropdown        = document.getElementById("user-menu-dropdown");
  var editProfileBtn  = document.getElementById("edit-profile-btn");

  var overlay          = document.getElementById("profile-modal-overlay");
  var nameInput        = document.getElementById("profile-name-input");
  var avatarInput      = document.getElementById("profile-avatar-input");
  var avatarPreview     = document.getElementById("profile-avatar-preview");
  var avatarPreviewFallback = document.getElementById("profile-avatar-preview-fallback");
  var removePhotoBtn    = document.getElementById("profile-avatar-remove");
  var cancelBtn        = document.getElementById("profile-cancel-btn");
  var saveBtn          = document.getElementById("profile-save-btn");

  var navAvatarImg      = document.getElementById("user-avatar");
  var navAvatarFallback  = document.getElementById("user-avatar-fallback");
  var navNameText       = document.getElementById("user-name-text");

  var pendingAvatar; // undefined = unchanged, null = removed, string = new dataURL
  var applyingProfile = false; // guards against our own DOM writes re-triggering the observer below

  function initials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var out = parts[0][0];
    if (parts.length > 1) out += parts[parts.length - 1][0];
    return out.toUpperCase();
  }

  function loadProfile() {
    var key = storageKey();
    if (!key) return null;
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveProfile(profile) {
    var key = storageKey();
    if (!key) return; // no signed-in user identified — don't save anywhere shared
    try {
      localStorage.setItem(key, JSON.stringify(profile));
    } catch (e) { /* storage unavailable — profile just won't persist */ }
  }

  function currentDisplayName() {
    var profile = loadProfile();
    if (profile && profile.name) return profile.name;
    return stripSignedInPrefix(navNameText.textContent);
  }

  // Apply a saved profile to the nav badge. Runs after the page's own
  // script has finished setting the badge, so a saved edit always wins.
  function applyProfileToNav() {
    var profile = loadProfile();
    if (!profile) return;

    applyingProfile = true;

    if (profile.name) navNameText.textContent = NAME_PREFIX + profile.name;

    if (profile.avatar) {
      navAvatarImg.src = profile.avatar;
      navAvatarImg.hidden = false;
      navAvatarFallback.hidden = true;
    } else {
      navAvatarImg.hidden = true;
      navAvatarImg.removeAttribute("src");
      navAvatarFallback.hidden = false;
      navAvatarFallback.textContent = initials(profile.name || stripSignedInPrefix(navNameText.textContent));
    }

    // Let the DOM settle before re-enabling the observer, so our own
    // writes above don't trigger another pass.
    window.setTimeout(function () { applyingProfile = false; }, 0);
  }

  // ---- Dropdown open/close ----
  function positionDropdown() {
    var r = trigger.getBoundingClientRect();
    dropdown.style.top = Math.round(r.bottom + 8) + "px";
    // Align the dropdown's right edge with the trigger's right edge,
    // but never let it run off the left side of the viewport.
    var right = Math.max(8, window.innerWidth - r.right);
    dropdown.style.right = Math.round(right) + "px";
    dropdown.style.left = "auto";
  }
  function openDropdown() {
    dropdown.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionDropdown();
  }
  function closeDropdown() {
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    if (dropdown.hidden) openDropdown(); else closeDropdown();
  });
  document.addEventListener("click", function (e) {
    if (!menu.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDropdown();
  });
  window.addEventListener("resize", function () {
    if (!dropdown.hidden) positionDropdown();
  });
  window.addEventListener("scroll", function () {
    if (!dropdown.hidden) closeDropdown();
  }, true);

  // ---- Modal open/close ----
  function openModal() {
    closeDropdown();
    var profile = loadProfile();
    pendingAvatar = undefined;

    nameInput.value = currentDisplayName();

    var avatarSrc = (profile && profile.avatar) || (!navAvatarImg.hidden ? navAvatarImg.src : null);
    if (avatarSrc) {
      avatarPreview.src = avatarSrc;
      avatarPreview.hidden = false;
      avatarPreviewFallback.hidden = true;
    } else {
      avatarPreview.hidden = true;
      avatarPreviewFallback.hidden = false;
      avatarPreviewFallback.textContent = initials(nameInput.value);
    }

    overlay.hidden = false;
    nameInput.focus();
  }
  function closeModal() {
    overlay.hidden = true;
    avatarInput.value = "";
  }

  editProfileBtn.addEventListener("click", openModal);
  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  nameInput.addEventListener("input", function () {
    if (avatarPreview.hidden) {
      avatarPreviewFallback.textContent = initials(nameInput.value);
    }
  });

  avatarInput.addEventListener("change", function () {
    var file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingAvatar = reader.result;
      avatarPreview.src = reader.result;
      avatarPreview.hidden = false;
      avatarPreviewFallback.hidden = true;
    };
    reader.readAsDataURL(file);
  });

  removePhotoBtn.addEventListener("click", function () {
    pendingAvatar = null;
    avatarInput.value = "";
    avatarPreview.hidden = true;
    avatarPreview.removeAttribute("src");
    avatarPreviewFallback.hidden = false;
    avatarPreviewFallback.textContent = initials(nameInput.value);
  });

  saveBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    var existing = loadProfile() || {};
    var avatar = pendingAvatar === undefined ? (existing.avatar || null) : pendingAvatar;

    saveProfile({ name: name, avatar: avatar });
    applyProfileToNav();
    closeModal();
  });

  // Let any existing sign-in script set the badge first, then layer the
  // saved profile on top. Also keep watching: if that script re-renders
  // the "Signed in" area later (or on an interval/async fetch), our saved
  // name/avatar is re-applied so the edit isn't silently lost — without
  // touching anything else in that area.
  window.addEventListener("load", applyProfileToNav);

  if (window.MutationObserver) {
    var reapplyQueued = false;
    var navObserver = new MutationObserver(function () {
      if (applyingProfile || reapplyQueued) return;
      reapplyQueued = true;
      window.setTimeout(function () {
        reapplyQueued = false;
        applyProfileToNav();
      }, 0);
    });
    navObserver.observe(navNameText, { childList: true, characterData: true, subtree: true });
    navObserver.observe(navAvatarImg, { attributes: true, attributeFilter: ["src", "hidden"] });
    navObserver.observe(navAvatarFallback, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }
})();
