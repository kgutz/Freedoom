# Instrucciones del proyecto Freedoom

## Confirmación visual de desarrollo

Cuando el usuario pida desarrollar o implementar cambios y el trabajo haya terminado correctamente, incluye exactamente esta confirmación visual en la respuesta final. Haz lo mismo cuando una subida o publicación en GitHub haya terminado correctamente:

Listo ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅

Úsala solo al completar el desarrollo y su validación. No la uses para avances parciales, tareas bloqueadas, consultas, explicaciones ni trabajo que siga pendiente.

En conversaciones por voz, publícala en la superficie visible del chat; no basta con incluirla únicamente en una respuesta interna o hablada.

## Número de versión visible

Antes de publicar en GitHub cualquier actualización funcional o visible para el usuario, incrementa la versión del proyecto y mantén sincronizados `package.json`, `package-lock.json`, `APP_VERSION` en `src/main.js` y los valores de respaldo `obVersion` y `settingsVersion` de `index.html`. El número que aparece en Ajustes, debajo del logo, debe permitir comprobar inequívocamente que la publicación nueva ya está cargada.
