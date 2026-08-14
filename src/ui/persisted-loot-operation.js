export async function commitLootOperation({
  previousState,
  nextState,
  applyState,
  persist,
}) {
  applyState(nextState);
  try {
    const saveResult = await persist();
    if (saveResult?.blocked) throw new Error('El guardado fue bloqueado');
    return { ok: true, saveResult };
  } catch (error) {
    applyState(previousState);
    return { ok: false, error };
  }
}
