/**
 * Check if user profile is complete
 * Profile is considered complete if user has name, email, phone, and date_of_birth
 */
export function isProfileComplete(user) {
  return !!(
    user.name &&
    user.email &&
    user.phone &&
    user.date_of_birth
  );
}

