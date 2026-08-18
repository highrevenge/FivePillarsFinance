/*
 * 5-PILLAR FINANCE
 * Email Verification System
 */

const VERIFICATION_CODES = "five-pillar-verification-codes-v3";
const VERIFICATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const EMAILJS_SERVICE_ID = "service_jh3ovfm";
const EMAILJS_TEMPLATE_ID = "template_1fgqt54";

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getVerificationCodes() {
    try {
        return JSON.parse(
            localStorage.getItem(VERIFICATION_CODES) || "{}"
        );
    } catch {
        return {};
    }
}

function saveVerificationCodes(codes) {
    localStorage.setItem(
        VERIFICATION_CODES,
        JSON.stringify(codes)
    );
}

/*
 * Send verification code through EmailJS
 */
async function sendVerificationCode(email) {

    email = normalizeEmail(email);

    if (!email) {
        return {
            success: false,
            message: "Please enter a valid email address."
        };
    }

    if (
        !window.emailjs ||
        typeof window.emailjs.send !== "function"
    ) {
        console.error("EmailJS is not available.");

        return {
            success: false,
            message:
                "Email service could not load. Check your internet connection and EmailJS setup."
        };
    }

    const code = generateVerificationCode();

    const codes = getVerificationCodes();

    /*
     * Save verification code locally
     */
    codes[email] = {
        code: code,
        timestamp: Date.now(),
        attempts: 0
    };

    saveVerificationCodes(codes);

    /*
     * Variables sent to EmailJS
     */
    const templateParams = {

        to_email: email,

        email: email,

        verification_code: code,

        passcode: code,

        code: code,

        code_expiry: "10 minutes",

        time: "10 minutes"
    };

    try {

        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );

        console.log(
            "EmailJS success:",
            response.status,
            response.text
        );

        return {

            success: true,

            message:
                `Verification code sent to ${email}. Check your inbox and spam folder.`
        };

    } catch (error) {

        console.error(
            "EmailJS send failed:",
            error
        );

        const errorText =
            error &&
            (error.text || error.message)
                ? (error.text || error.message)
                : "Unknown EmailJS error";

        return {

            success: false,

            message:
                `The email could not be sent. EmailJS said: ${errorText}`
        };
    }
}

/*
 * Verify the code entered by the user
 */
function verifyCode(email, enteredCode) {

    email = normalizeEmail(email);

    enteredCode =
        String(enteredCode || "").trim();

    const codes = getVerificationCodes();

    const codeData = codes[email];

    /*
     * No code found
     */
    if (!codeData) {

        return {

            success: false,

            message:
                "No verification code found. Please request a new code."
        };
    }

    /*
     * Check expiration
     */
    if (
        Date.now() - codeData.timestamp >
        VERIFICATION_TIMEOUT
    ) {

        delete codes[email];

        saveVerificationCodes(codes);

        return {

            success: false,

            message:
                "Verification code has expired. Please request a new one."
        };
    }

    /*
     * Maximum attempts
     */
    if (codeData.attempts >= 5) {

        delete codes[email];

        saveVerificationCodes(codes);

        return {

            success: false,

            message:
                "Too many failed attempts. Please request a new verification code."
        };
    }

    /*
     * Make sure code contains 6 digits
     */
    if (!/^\d{6}$/.test(enteredCode)) {

        return {

            success: false,

            message:
                "Please enter the 6-digit verification code."
        };
    }

    /*
     * Correct code
     */
    if (enteredCode === codeData.code) {

        delete codes[email];

        saveVerificationCodes(codes);

        return {

            success: true,

            message:
                "Email verified successfully!"
        };
    }

    /*
     * Wrong code
     */
    codeData.attempts++;

    codes[email] = codeData;

    saveVerificationCodes(codes);

    const remaining =
        5 - codeData.attempts;

    return {

        success: false,

        message:
            `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
    };
}

/*
 * Clear verification code
 */
function clearVerificationCode(email) {

    email = normalizeEmail(email);

    const codes = getVerificationCodes();

    delete codes[email];

    saveVerificationCodes(codes);
}
