export const RECOVERY_MODE_TAP_COUNT = 7;

export function createRecoveryModeController({
  logo,
  emergencySection,
  showToast,
  alwaysVisible = false,
}) {
  let tapCount = 0;
  let active = alwaysVisible;

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
  if (!alwaysVisible) logo?.addEventListener('click', handleLogoTap);

  return {
    isActive: () => active,
    tapCount: () => tapCount,
    destroy: () => {
      if (!alwaysVisible) logo?.removeEventListener('click', handleLogoTap);
    },
  };
}
