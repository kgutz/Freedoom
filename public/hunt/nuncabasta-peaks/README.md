# Picos de Nuncabasta — arte integrado en local

La pantalla utiliza los mismos contenedores y navegación que las cacerías anteriores.

Archivos finales integrados en esta carpeta:
- `region.webp`: escenario completo, relación 21:9.
- `filled-smile.webp`: Sonrisa Rellena.
- `sugar-twisted.webp`: Retorcido del Azúcar.
- `never-enough-vendor.webp`: Quiosquero del Nunca Basta.

Los originales aprobados de `C:/Users/tripe/Downloads/FREEDOOM/zona 3` permanecen intactos. Los tres enemigos tienen alpha real (0–255), sin necesidad de retirar fondo. Exportados con Lanczos y dimensiones del pipeline de cacerías, WebP lossless tras redimensionar, sin recortar lienzos ni personajes.

| Entrega | Dimensiones | Bytes originales → WebP |
|---|---|---|
| filled-smile.webp | 384 × 384 RGBA | 563371 → 93746 |
| sugar-twisted.webp | 384 × 384 RGBA | 1083859 → 164020 |
| never-enough-vendor.webp | 384 × 384 RGBA | 888907 → 136770 |
| region.webp | 840 × 356 RGB | 1698805 → 459234 |

Total 4234942 → 853770 bytes (~80% menos). Script reproducible: `python scripts/optimize_nuncabasta_images.py "C:/Users/tripe/Downloads/FREEDOOM/zona 3"`.

Revisión local 2026-09-13: escenario y tarjetas alineadas en vista móvil de aproximadamente 400 px; nombres de dos líneas y ficha del minijefe sin cortes en corona, cetro o pies. Lore actualizado al rey hechicero. Retirado texto de arte pendiente.

649 pruebas, typecheck y build correctos. Regresión automatizada de inicio/resolución con región, enemigos y premios de las tres zonas. La demoFusions conservó nivel 18: no se afirma una expedición manual de nivel 34 completada en navegador. Balance fino pendiente de experiencia real de juego. No publicado en GitHub.
