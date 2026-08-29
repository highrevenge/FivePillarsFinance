/*
 * 5-PILLAR FINANCE — Profile Edit Modal — Firebase Edition
 * ------------------------------------------------------------
 * The old version had to layer a locally-saved profile on top of
 * whatever systemDashboard.js rendered, because they used two separate
 * storage systems (localStorage keyed by email) that could drift out of
 * sync. With Firestore, there's exactly one source of truth — the
 * "users/{uid}" document — that BOTH this file and systemDashboard.js
 * read from, so that whole reconciliation mechanism (MutationObserver,
 * re-apply-on-change, etc.) is gone. This file now only handles the
 * edit-profile modal: open it, load the current profile, save changes
 * back to Firestore, update the nav badge to match.
 *
 * Requires firebase-config.js to be loaded first.
 */
(function () {
  "use strict";

  const auth = window.auth;
  const db = window.db;

  function currentUid() {
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  function userDocRef() {
    const uidValue = currentUid();
    return uidValue ? db.collection("users").doc(uidValue) : null;
  }

  function stripSignedInPrefix(text) {
    const NAME_PREFIX = "Signed in: ";
    text = (text || "").trim();
    return text.indexOf(NAME_PREFIX) === 0 ? text.slice(NAME_PREFIX.length) : text;
  }

  const menu          = document.getElementById("user-menu");
  const trigger        = document.getElementById("user-menu-trigger");
  const dropdown        = document.getElementById("user-menu-dropdown");
  const editProfileBtn  = document.getElementById("edit-profile-btn");

  const overlay          = document.getElementById("profile-modal-overlay");
  const nameInput        = document.getElementById("profile-name-input");
  const avatarInput      = document.getElementById("profile-avatar-input");
  const avatarPreview     = document.getElementById("profile-avatar-preview");
  const avatarPreviewFallback = document.getElementById("profile-avatar-preview-fallback");
  const removePhotoBtn    = document.getElementById("profile-avatar-remove");
  const cancelBtn        = document.getElementById("profile-cancel-btn");
  const saveBtn          = document.getElementById("profile-save-btn");

  const navAvatarImg      = document.getElementById("user-avatar");
  const navAvatarFallback  = document.getElementById("user-avatar-fallback");
  const navNameText       = document.getElementById("user-name-text");

  // Same limit usersLoginSystem.js uses for registration avatars, so a
  // profile-edit upload can't blow past Firestore's ~1MB document cap.
  const MAX_AVATAR_BYTES = 700 * 1024;

  let pendingAvatar; // undefined = unchanged, null = removed, string = new dataURL

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    let out = parts[0][0];
    if (parts.length > 1) out += parts[parts.length - 1][0];
    return out.toUpperCase();
  }

  function applyProfileToNav(profile) {
    if (profile.name) navNameText.textContent = "Signed in: " + profile.name;

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
  }

  // ---- Dropdown open/close ----
  function positionDropdown() {
    const r = trigger.getBoundingClientRect();
    dropdown.style.top = Math.round(r.bottom + 8) + "px";
    const right = Math.max(8, window.innerWidth - r.right);
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
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdown.hidden) openDropdown(); else closeDropdown();
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdown();
  });
  window.addEventListener("resize", () => {
    if (!dropdown.hidden) positionDropdown();
  });
  window.addEventListener("scroll", () => {
    if (!dropdown.hidden) closeDropdown();
  }, true);

  // ---- Modal open/close ----
  async function openModal() {
    closeDropdown();
    pendingAvatar = undefined;

    const ref = userDocRef();
    let profile = { name: stripSignedInPrefix(navNameText.textContent), avatar: null };
    if (ref) {
      try {
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data();
          profile = { name: data.name || profile.name, avatar: data.avatar || null };
        }
      } catch (e) {
        console.error("Failed to load profile for editing:", e);
      }
    }

    nameInput.value = profile.name;

    if (profile.avatar) {
      avatarPreview.src = profile.avatar;
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
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  nameInput.addEventListener("input", () => {
    if (avatarPreview.hidden) {
      avatarPreviewFallback.textContent = initials(nameInput.value);
    }
  });

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      avatarInput.value = "";
      alert(`Profile picture must be under ${Math.round(MAX_AVATAR_BYTES / 1024)}KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      pendingAvatar = reader.result;
      avatarPreview.src = reader.result;
      avatarPreview.hidden = false;
      avatarPreviewFallback.hidden = true;
    };
    reader.readAsDataURL(file);
  });

  removePhotoBtn.addEventListener("click", () => {
    pendingAvatar = null;
    avatarInput.value = "";
    avatarPreview.hidden = true;
    avatarPreview.removeAttribute("src");
    avatarPreviewFallback.hidden = false;
    avatarPreviewFallback.textContent = initials(nameInput.value);
  });

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const ref = userDocRef();
    if (!ref) {
      alert("You're not signed in — please log in again.");
      return;
    }

    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const snap = await ref.get();
      const existing = snap.exists ? snap.data() : {};
      const avatar = pendingAvatar === undefined ? (existing.avatar || null) : pendingAvatar;

      await ref.set({ name: name, avatar: avatar }, { merge: true });

      // Keep the Auth displayName in sync too, so it stays correct as a
      // fallback anywhere the code reads user.displayName directly.
      if (auth.currentUser) {
        auth.currentUser.updateProfile({ displayName: name }).catch(() => {});
      }

      applyProfileToNav({ name: name, avatar: avatar });
      closeModal();
    } catch (e) {
      console.error("Failed to save profile:", e);
      alert("Couldn't save your profile changes. Please try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });
})();