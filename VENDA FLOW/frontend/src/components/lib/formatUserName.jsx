import { resolveDisplayName, resolveDisplayNameFromUser } from '@/lib/resolveDisplayName';

export default function formatUserName(user, userProfile = null) {
  if (userProfile) return resolveDisplayName(user, userProfile);
  return resolveDisplayNameFromUser(user);
}

export { resolveDisplayName, resolveDisplayNameFromUser };

export function formatRole(role) {
  const roleMap = {
    admin: "Administrador",
    gestor: "Gestor",
    sdr: "SDR",
    closer: "Closer"
  };
  return roleMap[role?.toLowerCase()] || "SDR";
}