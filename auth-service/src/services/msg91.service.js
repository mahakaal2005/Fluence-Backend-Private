import { getConfig } from '../config/index.js';

export function normalizePhoneNumber(phone, defaultCountryCode) {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  const digitsOnly = phone.replace(/[^\d]/g, '');
  if (digitsOnly.startsWith(defaultCountryCode)) {
    return digitsOnly;
  }
  if (phone.startsWith('+')) {
    return digitsOnly;
  }
  return `${defaultCountryCode}${digitsOnly}`;
}

export async function sendOtpSms({ phone, otp }) {
  const { msg91 } = getConfig();

  if (!msg91.authKey) {
    throw new Error('MSG91 auth key is not configured');
  }
  if (!msg91.templateId) {
    throw new Error('MSG91 template ID is not configured');
  }

  const mobile = normalizePhoneNumber(phone, msg91.defaultCountryCode);
  const url = `${msg91.baseUrl}/api/v5/otp`;

  const payload = {
    template_id: msg91.templateId,
    mobile,
    otp,
    otp_length: otp.length
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: msg91.authKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorMessage = `MSG91 request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.message || errorMessage;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }

  return true;
}

