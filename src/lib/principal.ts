// Identidad reservada del propietario. No puede renombrarse desde la aplicación.
export const PRINCIPAL_USER = 'jucsendoya';

export function isPrincipal(usuario: string) {
  return usuario.trim().toLowerCase() === PRINCIPAL_USER;
}

export function principalEditError(
  actorId: string,
  target: { id: string; usuario: string },
  nextUsername: string,
): string | null {
  if (isPrincipal(target.usuario)) {
    if (actorId !== target.id)
      return 'Solo el administrador principal puede modificar su propia cuenta.';
    if (nextUsername !== PRINCIPAL_USER)
      return 'El usuario del administrador principal no se puede cambiar.';
  } else if (isPrincipal(nextUsername)) {
    return 'Este usuario está reservado para el administrador principal.';
  }
  return null;
}
