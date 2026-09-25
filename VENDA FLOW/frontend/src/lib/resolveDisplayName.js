/**
 * Hierarquia canônica de nome no VendaFlow:
 * userProfile.user_name → user.apelido → user.full_name → prefixo do email → "Usuário"
 */

export function resolveDisplayName(user, userProfile) {
  return (
    userProfile?.user_name?.trim() ||
    user?.apelido?.trim() ||
    user?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Usuário'
  );
}

export function resolveDisplayNameFromUser(u) {
  return (
    u?.user_name?.trim() ||
    u?.apelido?.trim() ||
    u?.full_name?.trim() ||
    u?.name?.trim() ||
    u?.email?.split('@')[0] ||
    'Usuário'
  );
}

export function resolveAvatarInitial(user, userProfile) {
  return resolveDisplayName(user, userProfile).charAt(0).toUpperCase();
}