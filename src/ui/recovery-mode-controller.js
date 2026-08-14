export const RECOVERY_MODE_TAP_COUNT = 7;

export function createRecoveryModeController({
  logo,
  emergencySection,
  showToast,
}) {
  let tapCount = 0;
  let active = false;

  const render = () => {
    if (emergencySection) emergencySection.hidden = !active;
  };

  const handleLogoTap = () => {
    if (active) return;
    tapCount += 1;
    if (tapCount < RECOVERY_MODE_TAP_COUNT) return;
    active = true;
    render();
    showToast?.('Modo de recuperación activado', 'heal');
  };

  render();
  logo?.addEventListener('click', handleLogoTap);

  return {
    isActive: () => active,
    tapCount: () => tapCount,
    destroy: () => logo?.removeEventListener('click', handleLogoTap),
  };
}
