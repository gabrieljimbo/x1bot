export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIP = 'VIP',
}

export const hasRole = (userRole: string | undefined, requiredRole: UserRole): boolean => {
  if (!userRole) return false

  if (requiredRole === UserRole.SUPER_ADMIN) {
    return userRole === UserRole.SUPER_ADMIN
  }

  if (userRole === UserRole.SUPER_ADMIN) return true
  if (userRole === UserRole.ADMIN && requiredRole !== UserRole.SUPER_ADMIN) return true

  return userRole === requiredRole
}

export const isSuperAdmin = (userRole: string | undefined): boolean => {
  return userRole === UserRole.SUPER_ADMIN
}

export const isAdmin = (userRole: string | undefined): boolean => {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN
}

