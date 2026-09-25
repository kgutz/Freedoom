# Estado del endurecimiento de seguridad — variante Nube

Fecha: 22 de septiembre de 2026  
Base: Freedom v2.28.58 copiada de forma independiente. Esta carpeta no está conectada al repositorio publicado.

## Completado en esta fase

- Corregida la XSS persistente identificada en nombre del héroe, ficha y selector de hábitos de habilidades mediante codificación HTML contextual compartida.
- Añadidas pruebas de regresión con etiquetas, comillas y manejadores de eventos sintéticos.
- Las exportaciones nuevas usan un contenedor identificado como `freedoom-backup` y `schemaVersion: 1`.
- La importación conserva compatibilidad con copias antiguas, pero rechaza contenedores versionados desconocidos.
- Límite previo a lectura de 4 MiB para archivos y texto importado.
- Límites de profundidad, nodos, arrays, propiedades, longitud de claves y textos.
- Validación específica de nombre, clase, hábitos, tareas, días, recursos, transacciones, reliquias y colección.
- Rechazo explícito de `__proto__`, `prototype` y `constructor` en cualquier nivel.
- Eliminados los comandos públicos que concedían recursos, energía, outfits o marcos.
- Aviso visible de privacidad en exportación/importación y desactivación de autocompletado/corrección en campos personales.
- El registro auxiliar de acciones conserva únicamente tipo y fecha; ya no duplica cantidades ni fechas de consumo.
- “Reiniciar app” elimina todas las claves locales de la partida, snapshots, action log e IndexedDB antes de crear el estado inicial.
- Vitest actualizado a 4.1.11 y dependencia transitiva vulnerable corregida. `npm audit` informa cero avisos conocidos.

## Compatibilidad y límites deliberados

- Las copias antiguas de Freedom siguen siendo importables si superan la validación.
- Las copias siguen siendo texto legible: el aviso de privacidad es explícito, pero todavía no se ofrece exportación cifrada con frase de paso.
- Mientras no exista servidor, economía e inventario continúan siendo locales. No deben convertirse en activos compartidos ni comerciables.
- No se ha añadido Supabase, Auth, RLS, clanes, sincronización ni tradeo en esta fase.
- No se ha configurado CSP estricta: todavía existen estilos y manejadores inline heredados que requieren una migración separada y pruebas visuales amplias.
- No se ha publicado ni modificado la aplicación actual de GitHub.

## Bloqueantes para la siguiente fase

1. Diseñar las tablas separando perfil social y registros privados.
2. Definir RLS y grants mínimos antes de introducir datos reales.
3. Diseñar Auth, recuperación, sesiones y MFA administrativo.
4. Crear un libro mayor servidor-autoritativo para economía e inventario.
5. Definir migración local→nube idempotente; saldo y objetos de una copia nunca son autoridad.
6. Definir conflictos multidispositivo y límites offline.
7. Definir borrado, exportación, retención y restauración de backups del servidor.
8. Eliminar HTML inline necesario y activar CSP estricta antes de guardar sesiones en el origen.

## Validación ejecutada

- 66 archivos de pruebas superados.
- 1.223 pruebas superadas.
- Build de producción correcto.
- Comprobación de tipos correcta.
- `npm audit`: 0 vulnerabilidades conocidas en 124 dependencias contabilizadas.

