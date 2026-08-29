/*
 * 5-PILLAR FINANCE
 * Login / Registration / Forgot Password System — Firebase Edition
 * --------------------------------------------------------------------
 * Accounts and dashboard data now live in Firebase (Authentication +
 * Firestore) instead of localStorage, so the SAME account works across
 * any device/browser — register on one, log in from another.
 *
 * Requires firebase-config.js to be loaded first (sets up window.auth
 * and window.db). See that file for setup instructions.
 *
 * The old EmailJS-based "enter a 6-digit code" password reset flow is
 * gone — Firebase Auth has its own built-in reset-link email, which is
 * simpler and doesn't need EmailJS at all. emailVerification.js is no
 * longer used by this file.
 */

const auth = window.auth;
const db = window.db;

// Avatars are stored inline in the user's Firestore document. Firestore
// caps a document at ~1MB total, and base64-encoding a file inflates its
// size by about a third — so the raw file needs to stay well under that
// to leave room for the rest of the profile fields. (A larger limit would
// need Firebase Storage instead of embedding the image in Firestore.)
const MAX_AVATAR_BYTES = 700 * 1024;


/*
 * Normalize email
 */
function normalizeUserEmail(email) {
    return String(email || "").trim().toLowerCase();
}


/*
 * Display message
 */
function showMessage(id, message, type = "") {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.className = "msg" + (type ? ` ${type}` : "");
}


/*
 * Toast notification
 */
function showToast(message) {
    const toast = document.getElementById("toastMessage");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/*
 * Switch between Login, Forgot Password and Register
 */
function showSection(sectionId) {
    ["login", "forgot", "register"].forEach(id => {
        const section = document.getElementById(id);
        if (section) section.hidden = id !== sectionId;
    });
}


/*
 * Reset forgot-password form back to its starting state
 */
function resetForgotFlow() {
    showMessage("forgotMsg", "");
    const forgotEmailInput = document.getElementById("forgotEmail");
    if (forgotEmailInput) forgotEmailInput.value = "";
}


/*
 * Convert profile picture into Base64
 */
function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve("");
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            reject(new Error(`Profile picture must be under ${Math.round(MAX_AVATAR_BYTES / 1024)}KB.`));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read profile picture."));
        reader.readAsDataURL(file);
    });
}


/*
 * Turn a Firebase Auth error into a friendly message
 */
function firebaseErrorMessage(error) {
    const code = error && error.code;
    switch (code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/user-not-found":
            return "No account was found with that email.";
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Please wait a moment and try again.";
        case "auth/network-request-failed":
            return "Network error — check your internet connection.";
        default:
            return (error && error.message) || "Something went wrong. Please try again.";
    }
}


/*
 * Disables a form's submit button while a submit is in progress, so a
 * fast double-click (or a slow network round-trip) can't fire the
 * handler twice.
 */
function guardSubmit(form, busyText) {
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyText;
    return function release() {
        btn.disabled = false;
        btn.textContent = originalText;
    };
}


/*
 * Start application
 */
document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const forgotEmailForm = document.getElementById("forgotEmailForm");

    /*
     * FORGOT PASSWORD BUTTON
     */
    document.getElementById("forgotBtn").addEventListener("click", () => {
        resetForgotFlow();
        showSection("forgot");
    });

    /*
     * REGISTER BUTTON
     */
    document.getElementById("registerBtn").addEventListener("click", () => {
        showSection("register");
    });

    /*
     * LOGIN BUTTON
     */
    document.getElementById("loginBtn").addEventListener("click", () => {
        showSection("login");
    });

    /*
     * BACK TO LOGIN
     */
    document.getElementById("backToLoginBtn").addEventListener("click", () => {
        resetForgotFlow();
        showSection("login");
    });

    /*
     * PROFILE PICTURE PREVIEW
     */
    const avatarInput = document.getElementById("avatarInput");
    const avatarPreview = document.getElementById("avatarPreview");
    const avatarPlaceholder = document.getElementById("avatarPlaceholder");

    avatarInput.addEventListener("change", () => {
        const file = avatarInput.files && avatarInput.files[0];

        if (!file) {
            avatarPreview.hidden = true;
            avatarPreview.removeAttribute("src");
            avatarPlaceholder.hidden = false;
            return;
        }

        if (file.size > MAX_AVATAR_BYTES) {
            avatarInput.value = "";
            avatarPreview.hidden = true;
            avatarPlaceholder.hidden = false;
            showMessage(
                "registerMsg",
                `Profile picture must be under ${Math.round(MAX_AVATAR_BYTES / 1024)}KB.`,
                "error"
            );
            return;
        }

        const reader = new FileReader();
        reader.onload = event => {
            avatarPreview.src = event.target.result;
            avatarPreview.hidden = false;
            avatarPlaceholder.hidden = true;
        };
        reader.readAsDataURL(file);
    });

    /*
     * LOGIN
     */
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const release = guardSubmit(loginForm, "Signing in...");

        const email = normalizeUserEmail(document.getElementById("email").value);
        const password = document.getElementById("password").value;

        try {
            const credential = await auth.signInWithEmailAndPassword(email, password);

            showMessage("loginMsg", "Login successful! Redirecting...", "success");
            showToast(`Welcome back, ${credential.user.displayName || "there"}!`);

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 700);
        } catch (error) {
            release();
            showMessage("loginMsg", firebaseErrorMessage(error), "error");
        }
    });

    /*
     * REGISTRATION
     */
    registerForm.addEventListener("submit", async event => {
        event.preventDefault();
        const release = guardSubmit(registerForm, "Creating account...");

        const name = document.getElementById("name").value.trim();
        const email = normalizeUserEmail(document.getElementById("regEmail").value);
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const avatarFile = document.getElementById("avatarInput").files[0];

        if (password !== confirmPassword) {
            release();
            showMessage("registerMsg", "Passwords do not match.", "error");
            return;
        }

        if (password.length < 6) {
            release();
            showMessage("registerMsg", "Password must be at least 6 characters.", "error");
            return;
        }

        let avatar = "";
        try {
            avatar = await fileToDataURL(avatarFile);
        } catch (error) {
            release();
            showMessage("registerMsg", error.message, "error");
            return;
        }

        try {
            const credential = await auth.createUserWithEmailAndPassword(email, password);
            await credential.user.updateProfile({ displayName: name });

            await db.collection("users").doc(credential.user.uid).set({
                name: name,
                email: email,
                avatar: avatar || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Firebase signs the new account in automatically — sign back
            // out so the person lands on the login screen next, matching
            // the original register → login flow instead of skipping
            // straight into the dashboard.
            await auth.signOut();

            release();
            registerForm.reset();
            avatarPreview.hidden = true;
            avatarPreview.removeAttribute("src");
            avatarPlaceholder.hidden = false;

            showMessage("registerMsg", "Account created successfully. You can now log in.", "success");
            showToast("Your account was created successfully.");

            setTimeout(() => {
                showSection("login");
            }, 900);
        } catch (error) {
            release();
            showMessage("registerMsg", firebaseErrorMessage(error), "error");
        }
    });

    /*
     * FORGOT PASSWORD — send Firebase's built-in reset-link email
     */
    forgotEmailForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = normalizeUserEmail(document.getElementById("forgotEmail").value);
        const button = document.getElementById("sendCodeBtn");

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            await auth.sendPasswordResetEmail(email);
            showMessage(
                "forgotMsg",
                "Check your email for a link to reset your password. It may take a minute to arrive — check spam too.",
                "success"
            );
        } catch (error) {
            showMessage("forgotMsg", firebaseErrorMessage(error), "error");
        } finally {
            button.disabled = false;
            button.textContent = "Send reset link";
        }
    });
});