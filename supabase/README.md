# Backend Supabase de Freedom

Esta carpeta contiene únicamente infraestructura reproducible. No contiene contraseñas,
claves administrativas ni el código compartido de la beta.

## Diseño inicial

- `profiles`: datos mínimos de cada cuenta.
- `game_saves`: una partida completa y versionada por usuario.
- `game_save_history`: hasta diez puntos de recuperación anteriores.
- `save_game_state`: guardado atómico con control de revisión para evitar sobrescrituras.
- `request-beta-invite`: valida correo y código en el servidor y envía la invitación.

Las tablas privadas usan RLS, no conceden acceso anónimo y cada usuario autenticado solo
puede leer sus propias filas. La escritura de partidas pasa por una función que comprueba
la revisión anterior. El código beta y la clave administrativa se configuran como secretos
de Supabase y nunca se incluyen en GitHub.

## Orden de despliegue

1. Revisar y aplicar la migración SQL.
2. Configurar `BETA_ACCESS_CODE`, `INVITE_REDIRECT_URL` y `ALLOWED_ORIGINS` como secretos.
3. Desplegar `request-beta-invite` sin verificación JWT, ya que se usa antes del registro.
4. Configurar la URL del sitio y las redirecciones permitidas en Auth.
5. Probar aislamiento, reintentos, conflictos y migración con la cuenta del propietario.

