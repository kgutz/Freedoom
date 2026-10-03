# Fusiones de la Hydra (Gargantilla de las Tres Fauces)

Implementadas en local, **sin publicar**. Pruebas: `src/domain/hydra-fusions.test.js`.

## Reliquia base `relic_11` · Tres Fauces (familia: experiencia)

En Cacería, cada enemigo derrotado concede un % extra de **su propia XP base** (no del total):

| Rango | 1.er enemigo | 2.º | 3.º (minijefe) | Ataque / Poder / Defensa |
|---|---:|---:|---:|---:|
| I | +3% | +6% | +10% | +5 |
| II | +6% | +10% | +15% | +6 |
| III | +10% | +15% | +20% | +7 |

- Redondeo: `Math.round(XP base del enemigo × %)`.
- No se multiplica con la Chuche de Experiencia: la chuche calcula su +50% sin contar `rewards.hydraXp`.
- Solo con la reliquia (o una fusión con ella) equipada; se reinicia en cada Cacería; solo premia a los enemigos derrotados.
- El valor guardado por rango (`RELIC_RANK_EFFECTS.relic_11` = 3 / 6 / 10) es el % del primer enemigo y actúa de clave (`hydraXpPercents`). Las fusiones lo heredan por `inheritedEffects`.
- Antiguo efecto (XP por 3 hábitos distintos) eliminado. La XP ya ganada con él se conserva (`storedRelicXp` sigue leyendo las activaciones antiguas).

## Incompatibilidades

`relic_03` (Daga) y `relic_04` (Yelmo) comparten familia con la Hydra: añadidas a `PERMANENTLY_INCOMPATIBLE_FUSIONS`. `fusionRecipeStatus` devuelve `incompatible`, la vista previa no es válida y `fuseRelics` falla. No hay recetas con fusionadas ni con la máscara de Halloween.

## Sinergias

| Fusión | Ingredientes | Sinergia (I / II / III) | Clave de efecto |
|---|---|---|---|
| 43 Corazón de las Tres Fauces | relic_01 + relic_11 | Reduce 1 / 2 / 3 el primer golpe que conecte el minijefe | `miniFirstHitShield` |
| 44 Lágrima del Eco Triple | relic_02 + relic_11 | 1 / 2 / 3 de maná con el primer ataque dañino a cada enemigo | `firstHitManaEach` |
| 45 Redoma de las Tres Gargantas | relic_05 + relic_11 | 2 / 3 / 4 de maná al derrotar al minijefe (1 vez por Cacería) | `miniVictoryMana` |
| 46 Colmillo de la Hidra Renacida | relic_06 + relic_11 | 2 / 3 / 4 de vida al derrotar al minijefe, sin resucitar | `miniVictoryHealthFlat` |
| 47 Gargantilla del Hambre Triple | relic_07 + relic_11 | +1 / 2 / 3 pp de Vampirismo vs minijefe | `miniVampirism` |
| 48 Ojo de las Tres Vigilias | relic_08 + relic_11 | +2 / 3 / 4 pp a Mirada petrificante vs minijefe | `miniPetrification` |
| 49 Malla de la Hidra Acorazada | relic_09 + relic_11 | +1 / 2 / 3 pp a Escamas protectoras vs minijefe | `miniArmor` |
| 50 Puño del Juramento Triple | relic_12 + relic_11 | +1 / 2 / 3 de daño en el primer ataque dañino a cada enemigo | `firstHitDamageEach` |
| 39 Gargantilla de las Tres Almas (revisada) | relic_11 + relic_10 | +2 / 3 / 4 de daño en el primer ataque dañino al minijefe | `miniFirstHitDamage` |

## Decisiones tomadas con las reglas actuales

1. **Fusión 48:** la Mirada petrificante actual no tiene tirada de probabilidad (se activa siempre tras tu primer ataque y reduce el siguiente golpe un X%). «Probabilidad» se aplicó como +pp a esa reducción, igual que la fusión 37.
2. **Fusión 43 y 39:** «tras derrotar a los dos primeros enemigos» se cumple siempre que se llega al minijefe, así que no necesita estado extra.
3. **Atributos:** la Hydra suma Ataque, Poder y Defensa a la vez. Una fusión suma los atributos de sus dos ingredientes por tipo (p. ej. fusión 39: Poder = Calavera + Hydra).
4. **Compatibilidad:** `normalizeLootState` recalcula `inheritedEffects.relic_11` desde el rango guardado al cargar, igual que ya hacía con Mirada, Escamas, etc. Inventario, colección, rango y equipo no se tocan. La fusión 39 conserva ids y recetas.
5. **Cacerías en curso al actualizar:** conservan los efectos guardados al empezar; el viejo `miniThreeHabitsHit` se ignora.

## Sesión ficticia

`http://localhost:5173/?demoHydraFusions=1&demoQuiet=1&demoHydraRank=3` (rango 1, 2 o 3). Partida temporal y aislada: no usa ni modifica partidas reales.
