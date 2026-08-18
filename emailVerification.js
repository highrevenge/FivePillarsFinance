// Email Verification System
const VERIFICATION_CODES = "five-pillar-verification-codes-v2";
const VERIFICATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code to email (simulated - in production would use backend)
 * For now, logs to console and stores in localStorage
 */
function sendVerificationCode(email) {
  const code = generateVerificationCode();
  const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODES) || "{}");
  
  // Store the verification code with expiration time
  codes[email] = {
    code: code,
    timestamp: Date.now(),
    attempts: 0
  };
  
  localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
  
  // In a real application, this would send an email
  console.log(`Verification code for ${email}: ${code}`);
  console.warn(`%cDEV MODE: Verification code is ${code}`, 'color: orange; font-weight: bold;');
  
  return {
    success: true,
    message: `Verification code sent to ${email}. (DEV: Check console for code)`
  };
}

/**
 * Verify the code entered by user
 */
function verifyCode(email, enteredCode) {
  const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODES) || "{}");
  const codeData = codes[email];
  
  if (!codeData) {
    return {
      success: false,
      message: "No verification code found. Please request a new one."
    };
  }
  
  // Check if code has expired (10 minutes)
  if (Date.now() - codeData.timestamp > VERIFICATION_TIMEOUT) {
    delete codes[email];
    localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
    return {
      success: false,
      message: "Verification code has expired. Please request a new one."
    };
  }
  
  // Limit verification attempts to 5
  if (codeData.attempts >= 5) {
    delete codes[email];
    localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
    return {
      success: false,
      message: "Too many failed attempts. Please request a new verification code."
    };
  }
  
  // Check if code matches
  if (enteredCode.trim() === codeData.code) {
    delete codes[email];
    localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
    return {
      success: true,
      message: "Email verified successfully!"
    };
  }
  
  // Increment failed attempts
  codeData.attempts++;
  codes[email] = codeData;
  localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
  
  const remaining = 5 - codeData.attempts;
  return {
    success: false,
    message: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
  };
}

/**
 * Clear verification code for email (called when user goes back)
 */
function clearVerificationCode(email) {
  const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODES) || "{}");
  delete codes[email];
  localStorage.setItem(VERIFICATION_CODES, JSON.stringify(codes));
}

/**
 * Check if email has pending verification
 */
function hasPendingVerification(email) {
  const codes = JSON.parse(localStorage.getItem(VERIFICATION_CODES) || "{}");
  return !!codes[email];
}
