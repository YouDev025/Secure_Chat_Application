export type ProfileFields = {
  username?: string;
  email?: string;
  phoneNumber?: string;
  description?: string;
  status?: string;
  avatarUrl?: string;
};

const profiles = new Map<string, ProfileFields>();

export const getProfile = (userId: string) => profiles.get(userId) || {};

export const updateProfile = (userId: string, fields: ProfileFields) => {
  const current = getProfile(userId);
  const next = { ...current, ...fields };
  profiles.set(userId, next);
  return next;
};
