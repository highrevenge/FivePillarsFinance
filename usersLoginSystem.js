/*
 * 5-PILLAR FINANCE
 * Login / Registration / Forgot Password System
 */

const USERS_STORAGE_KEY =
    "five-pillar-finance-users-v2";

const SESSION_STORAGE_KEY =
    "five-pillar-finance-session-v2";

let recoveryEmail = "";

let recoveryVerified = false;


/*
 * Get registered users
 */
function getUsers() {

    try {

        return JSON.parse(
            localStorage.getItem(
                USERS_STORAGE_KEY
            ) || "{}"
        );

    } catch {

        return {};
    }
}


/*
 * Save users
 */
function saveUsers(users) {

    localStorage.setItem(
        USERS_STORAGE_KEY,
        JSON.stringify(users)
    );
}


/*
 * Normalize email
 */
function normalizeUserEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();
}


/*
 * Display message
 */
function showMessage(
    id,
    message,
    type = ""
) {

    const element =
        document.getElementById(id);

    if (!element) return;

    element.textContent = message;

    element.className =
        "msg" +
        (type ? ` ${type}` : "");
}


/*
 * Toast notification
 */
function showToast(message) {

    const toast =
        document.getElementById(
            "toastMessage"
        );

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 3500);
}


/*
 * Switch between Login,
 * Forgot Password and Register
 */
function showSection(sectionId) {

    [
        "login",
        "forgot",
        "register"
    ].forEach(id => {

        const section =
            document.getElementById(id);

        if (section) {

            section.hidden =
                id !== sectionId;
        }

    });
}


/*
 * Reset forgot password process
 */
function resetForgotFlow() {

    recoveryEmail = "";

    recoveryVerified = false;

    document.getElementById(
        "forgotEmailStep"
    ).hidden = false;

    document.getElementById(
        "forgotVerificationStep"
    ).hidden = true;

    document.getElementById(
        "forgotPasswordStep"
    ).hidden = true;

    showMessage(
        "forgotMsg",
        ""
    );

    showMessage(
        "forgotVerifyMsg",
        ""
    );

    showMessage(
        "forgotPasswordMsg",
        ""
    );

    const codeInput =
        document.getElementById(
            "verificationCode"
        );

    if (codeInput) {

        codeInput.value = "";
    }

    const newPassword =
        document.getElementById(
            "newPassword"
        );

    const confirmPassword =
        document.getElementById(
            "confirmNewPassword"
        );

    if (newPassword) {

        newPassword.value = "";
    }

    if (confirmPassword) {

        confirmPassword.value = "";
    }
}


/*
 * Convert profile picture
 * into Base64
 */
function fileToDataURL(file) {

    return new Promise(
        (resolve, reject) => {

            if (!file) {

                resolve("");

                return;
            }

            const reader =
                new FileReader();

            reader.onload = () => {

                resolve(
                    reader.result
                );
            };

            reader.onerror = () => {

                reject(
                    new Error(
                        "Could not read profile picture."
                    )
                );
            };

            reader.readAsDataURL(file);
        }
    );
}


/*
 * Start application
 */
document.addEventListener(
    "DOMContentLoaded",
    () => {

        const loginForm =
            document.getElementById(
                "loginForm"
            );

        const registerForm =
            document.getElementById(
                "registerForm"
            );

        const forgotEmailForm =
            document.getElementById(
                "forgotEmailForm"
            );

        const forgotVerifyForm =
            document.getElementById(
                "forgotVerifyForm"
            );

        const forgotPasswordForm =
            document.getElementById(
                "forgotPasswordForm"
            );


        /*
         * FORGOT PASSWORD BUTTON
         */
        document
            .getElementById("forgotBtn")
            .addEventListener(
                "click",
                () => {

                    resetForgotFlow();

                    showSection(
                        "forgot"
                    );
                }
            );


        /*
         * REGISTER BUTTON
         */
        document
            .getElementById("registerBtn")
            .addEventListener(
                "click",
                () => {

                    showSection(
                        "register"
                    );
                }
            );


        /*
         * LOGIN BUTTON
         */
        document
            .getElementById("loginBtn")
            .addEventListener(
                "click",
                () => {

                    showSection(
                        "login"
                    );
                }
            );


        /*
         * BACK TO LOGIN
         */
        document
            .getElementById(
                "backToLoginBtn"
            )
            .addEventListener(
                "click",
                () => {

                    resetForgotFlow();

                    showSection(
                        "login"
                    );
                }
            );


        /*
         * BACK TO EMAIL
         */
        document
            .getElementById(
                "backToEmailBtn"
            )
            .addEventListener(
                "click",
                () => {

                    if (recoveryEmail) {

                        clearVerificationCode(
                            recoveryEmail
                        );
                    }

                    resetForgotFlow();
                }
            );


        /*
         * PROFILE PICTURE PREVIEW
         */
        const avatarInput =
            document.getElementById(
                "avatarInput"
            );

        const avatarPreview =
            document.getElementById(
                "avatarPreview"
            );

        const avatarPlaceholder =
            document.getElementById(
                "avatarPlaceholder"
            );


        avatarInput.addEventListener(
            "change",
            () => {

                const file =
                    avatarInput.files &&
                    avatarInput.files[0];


                if (!file) {

                    avatarPreview.hidden =
                        true;

                    avatarPreview.removeAttribute(
                        "src"
                    );

                    avatarPlaceholder.hidden =
                        false;

                    return;
                }


                /*
                 * Maximum 5 MB
                 */
                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    avatarInput.value = "";

                    avatarPreview.hidden =
                        true;

                    avatarPlaceholder.hidden =
                        false;

                    showMessage(
                        "registerMsg",
                        "Profile picture must be under 5MB.",
                        "error"
                    );

                    return;
                }


                const reader =
                    new FileReader();


                reader.onload =
                    event => {

                        avatarPreview.src =
                            event.target.result;

                        avatarPreview.hidden =
                            false;

                        avatarPlaceholder.hidden =
                            true;
                    };


                reader.readAsDataURL(
                    file
                );
            }
        );


        /*
         * LOGIN
         */
        loginForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                const email =
                    normalizeUserEmail(
                        document.getElementById(
                            "email"
                        ).value
                    );


                const password =
                    document.getElementById(
                        "password"
                    ).value;


                const users =
                    getUsers();


                const user =
                    users[email];


                if (!user) {

                    showMessage(
                        "loginMsg",
                        "No account was found with that email.",
                        "error"
                    );

                    return;
                }


                if (
                    user.password !==
                    password
                ) {

                    showMessage(
                        "loginMsg",
                        "Incorrect password.",
                        "error"
                    );

                    return;
                }


                localStorage.setItem(
                    SESSION_STORAGE_KEY,
                    JSON.stringify({

                        email: email,

                        name: user.name,

                        avatar:
                            user.avatar || "",

                        signedInAt:
                            Date.now()
                    })
                );


                showMessage(
                    "loginMsg",
                    "Login successful! Redirecting...",
                    "success"
                );


                showToast(
                    `Welcome back, ${user.name}!`
                );


                setTimeout(
                    () => {

                        window.location.href =
                            "dashboard.html";

                    },
                    700
                );
            }
        );


        /*
         * REGISTRATION
         */
        registerForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const name =
                    document.getElementById(
                        "name"
                    ).value.trim();


                const email =
                    normalizeUserEmail(
                        document.getElementById(
                            "regEmail"
                        ).value
                    );


                const password =
                    document.getElementById(
                        "regPassword"
                    ).value;


                const confirmPassword =
                    document.getElementById(
                        "confirmPassword"
                    ).value;


                const avatarFile =
                    document.getElementById(
                        "avatarInput"
                    ).files[0];


                if (
                    password !==
                    confirmPassword
                ) {

                    showMessage(
                        "registerMsg",
                        "Passwords do not match.",
                        "error"
                    );

                    return;
                }


                if (
                    password.length < 6
                ) {

                    showMessage(
                        "registerMsg",
                        "Password must be at least 6 characters.",
                        "error"
                    );

                    return;
                }


                const users =
                    getUsers();


                if (users[email]) {

                    showMessage(
                        "registerMsg",
                        "An account with this email already exists.",
                        "error"
                    );

                    return;
                }


                let avatar = "";


                try {

                    avatar =
                        await fileToDataURL(
                            avatarFile
                        );

                } catch (error) {

                    showMessage(
                        "registerMsg",
                        error.message,
                        "error"
                    );

                    return;
                }


                users[email] = {

                    name: name,

                    email: email,

                    password: password,

                    avatar: avatar,

                    createdAt:
                        Date.now()
                };


                saveUsers(users);


                registerForm.reset();


                avatarPreview.hidden =
                    true;

                avatarPreview.removeAttribute(
                    "src"
                );

                avatarPlaceholder.hidden =
                    false;


                showMessage(
                    "registerMsg",
                    "Account created successfully. You can now log in.",
                    "success"
                );


                showToast(
                    "Your account was created successfully."
                );


                setTimeout(
                    () => {

                        showSection(
                            "login"
                        );

                    },
                    900
                );
            }
        );


        /*
         * STEP 1
         *
         * SEND VERIFICATION CODE
         */
        forgotEmailForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const email =
                    normalizeUserEmail(
                        document.getElementById(
                            "forgotEmail"
                        ).value
                    );


                const users =
                    getUsers();


                /*
                 * Make sure account exists
                 */
                if (!users[email]) {

                    showMessage(
                        "forgotMsg",
                        "No registered account was found with that email.",
                        "error"
                    );

                    return;
                }


                const button =
                    document.getElementById(
                        "sendCodeBtn"
                    );


                button.disabled =
                    true;

                button.textContent =
                    "Sending...";


                /*
                 * Call EmailJS
                 */
                const result =
                    await sendVerificationCode(
                        email
                    );


                button.disabled =
                    false;

                button.textContent =
                    "Send verification code";


                /*
                 * EmailJS failed
                 */
                if (!result.success) {

                    showMessage(
                        "forgotMsg",
                        result.message,
                        "error"
                    );

                    return;
                }


                /*
                 * Email successfully sent
                 */
                recoveryEmail =
                    email;

                recoveryVerified =
                    false;


                document.getElementById(
                    "forgotEmailStep"
                ).hidden = true;


                document.getElementById(
                    "forgotVerificationStep"
                ).hidden = false;


                showMessage(
                    "forgotVerifyMsg",
                    result.message,
                    "success"
                );


                document.getElementById(
                    "verificationCode"
                ).focus();
            }
        );


        /*
         * STEP 2
         *
         * VERIFY CODE
         */
        forgotVerifyForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                if (!recoveryEmail) {

                    showMessage(
                        "forgotVerifyMsg",
                        "Please request a new verification code.",
                        "error"
                    );

                    return;
                }


                const enteredCode =
                    document.getElementById(
                        "verificationCode"
                    ).value;


                const result =
                    verifyCode(
                        recoveryEmail,
                        enteredCode
                    );


                /*
                 * Incorrect code
                 */
                if (!result.success) {

                    showMessage(
                        "forgotVerifyMsg",
                        result.message,
                        "error"
                    );

                    return;
                }


                /*
                 * Correct code
                 */
                recoveryVerified =
                    true;


                document.getElementById(
                    "forgotVerificationStep"
                ).hidden = true;


                document.getElementById(
                    "forgotPasswordStep"
                ).hidden = false;


                showMessage(
                    "forgotPasswordMsg",
                    result.message,
                    "success"
                );


                document.getElementById(
                    "newPassword"
                ).focus();
            }
        );


        /*
         * STEP 3
         *
         * RESET PASSWORD
         */
        forgotPasswordForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();


                if (
                    !recoveryEmail ||
                    !recoveryVerified
                ) {

                    showMessage(
                        "forgotPasswordMsg",
                        "Please verify your email first.",
                        "error"
                    );

                    return;
                }


                const newPassword =
                    document.getElementById(
                        "newPassword"
                    ).value;


                const confirmPassword =
                    document.getElementById(
                        "confirmNewPassword"
                    ).value;


                if (
                    newPassword.length < 6
                ) {

                    showMessage(
                        "forgotPasswordMsg",
                        "Password must be at least 6 characters.",
                        "error"
                    );

                    return;
                }


                if (
                    newPassword !==
                    confirmPassword
                ) {

                    showMessage(
                        "forgotPasswordMsg",
                        "Passwords do not match.",
                        "error"
                    );

                    return;
                }


                const users =
                    getUsers();


                if (!users[recoveryEmail]) {

                    showMessage(
                        "forgotPasswordMsg",
                        "Account no longer exists.",
                        "error"
                    );

                    return;
                }


                /*
                 * Change password
                 */
                users[
                    recoveryEmail
                ].password =
                    newPassword;


                users[
                    recoveryEmail
                ].passwordChangedAt =
                    Date.now();


                saveUsers(users);


                /*
                 * Remove used verification code
                 */
                clearVerificationCode(
                    recoveryEmail
                );


                showMessage(
                    "forgotPasswordMsg",
                    "Password changed successfully! You can now log in.",
                    "success"
                );


                showToast(
                    "Password changed successfully."
                );


                recoveryEmail = "";

                recoveryVerified =
                    false;


                setTimeout(
                    () => {

                        resetForgotFlow();

                        showSection(
                            "login"
                        );

                    },
                    1200
                );
            }
        );
    }
);
