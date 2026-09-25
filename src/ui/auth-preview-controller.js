const AUTH_VIEWS = new Set(['login', 'invite-request', 'invite-sent', 'set-password', 'recover', 'recovery-sent', 'migration']);
const BETA_CODE_FINGERPRINT = 'ea73c2bc99125ecf3e6c0e8be42b4708bcca6566448a137d64ba63f6b5767215';

async function betaCodeMatches(value) {
  const normalized = String(value || '').normalize('NFKC').trim();
  if (!normalized || !globalThis.crypto?.subtle) return false;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return fingerprint === BETA_CODE_FINGERPRINT;
}

export function passwordStrength(value) {
  const password = String(value || '');
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\p{L}\d]/u.test(password)) score += 1;
  return score;
}

export function passwordValidation(password, confirmation) {
  if (String(password).length < 10) return 'Usa al menos 10 caracteres.';
  if (passwordStrength(password) < 3) return 'Combina mayúsculas, minúsculas, números y símbolos.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return '';
}

export function createAuthPreviewController({
  document,
  state,
  onContinue,
  onAuthenticated,
  onLinkSave,
  onSkipSave,
  service,
  recoveryRedirectTo,
  googleRedirectTo,
}) {
  const gate = document.getElementById('authGate');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const copy = {
    login: ['Bienvenido de nuevo', 'Entra con la cuenta de Google que ya vinculaste a Freedom.'],
    'invite-request': ['Accede a Freedom Beta', 'Introduce primero tu código de acceso para continuar con Google.'],
    'invite-sent': ['Revisa tu correo', 'El enlace de activación será personal y tendrá una duración limitada.'],
    'set-password': ['Activa tu cuenta', 'Tu invitación te da acceso a la beta privada de Freedom.'],
    recover: ['Recupera el acceso', 'Te enviaremos un enlace seguro para elegir una nueva contraseña.'],
    'recovery-sent': ['Revisa tu correo', 'El enlace caducará y solo podrá utilizarse una vez.'],
    migration: ['Vincula tu progreso', 'Hemos encontrado una partida guardada en este dispositivo.'],
  };

  const show = (requested = 'login') => {
    const view = AUTH_VIEWS.has(requested) ? requested : 'login';
    gate.hidden = false;
    document.getElementById('onboard').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('mainNav').classList.remove('show');
    gate.querySelectorAll('[data-auth-view]').forEach(element => {
      element.classList.toggle('active', element.dataset.authView === view);
    });
    [title.textContent, subtitle.textContent] = copy[view];
    gate.scrollTop = 0;
    if (view === 'migration') {
      document.getElementById('authMigrationDays').textContent = Object.keys(state?.days || {}).length;
      document.getElementById('authMigrationHabits').textContent = state?.habits?.items?.length || 0;
      document.getElementById('authMigrationHero').textContent = state?.game?.name || 'Sin elegir';
    }
  };

  const showError = (id, error) => {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = error?.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
    box.hidden = false;
  };
  const showRateLimit = minutes => {
    const modal = document.getElementById('authRateLimitBg');
    const message = document.getElementById('authRateLimitMessage');
    if (!modal || !message) return false;
    message.textContent = `Ya solicitaste un enlace para este correo. Revisa tu bandeja o vuelve a intentarlo en ${minutes} minutos.`;
    modal.classList.add('show');
    return true;
  };
  document.getElementById('authRateLimitClose')?.addEventListener('click', () => {
    document.getElementById('authRateLimitBg')?.classList.remove('show');
  });

  const run = async (button, action) => {
    button.disabled = true;
    try {
      await action();
    } finally {
      button.disabled = false;
    }
  };

  gate.querySelectorAll('[data-auth-target]').forEach(button => {
    button.addEventListener('click', () => show(button.dataset.authTarget));
  });
  gate.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'OCULTAR' : 'VER';
      button.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
  document.getElementById('authNewPassword').addEventListener('input', event => {
    document.getElementById('authStrength').dataset.level = passwordStrength(event.target.value);
  });
  const inviteCodeInput = document.getElementById('authInviteCode');
  const inviteGoogleButton = document.getElementById('authInviteGoogle');
  const syncInviteGoogleButton = async () => {
    const candidate = inviteCodeInput.value;
    inviteGoogleButton.disabled = true;
    const matches = await betaCodeMatches(candidate);
    if (inviteCodeInput.value === candidate) inviteGoogleButton.disabled = !matches;
  };
  inviteCodeInput.addEventListener('input', () => { void syncInviteGoogleButton(); });
  void syncInviteGoogleButton();
  document.getElementById('authLogin').addEventListener('submit', async event => {
    event.preventDefault();
    if (!service) return;
    const form = event.currentTarget;
    await run(form.querySelector('[type="submit"]'), async () => {
      try {
        document.getElementById('authLoginError').hidden = true;
        await service.signInWithGoogle(googleRedirectTo);
      } catch (error) {
        showError('authLoginError', error);
      }
    });
  });
  document.getElementById('authSetPassword').addEventListener('submit', async event => {
    event.preventDefault();
    const error = passwordValidation(
      document.getElementById('authNewPassword').value,
      document.getElementById('authConfirmPassword').value,
    );
    const errorBox = document.getElementById('authPasswordError');
    errorBox.textContent = error;
    errorBox.hidden = !error;
    if (!error && service) {
      await run(event.currentTarget.querySelector('[type="submit"]'), async () => {
        try {
          await service.setPassword(document.getElementById('authNewPassword').value);
          if (onAuthenticated) await onAuthenticated();
          else onContinue?.();
        } catch (submitError) {
          showError('authPasswordError', submitError);
        }
      });
    } else if (!error) onContinue?.();
  });
  document.getElementById('authRecover').addEventListener('submit', async event => {
    event.preventDefault();
    if (!service) return show('recovery-sent');
    await run(event.currentTarget.querySelector('[type="submit"]'), async () => {
      const errorBox = document.getElementById('authRecoveryError');
      errorBox.hidden = true;
      try {
        const request = await service.requestPasswordRecovery(document.getElementById('authRecoveryEmail').value.trim());
        if (request?.deduplicated) {
          const minutes = Math.max(1, Math.ceil((request.retryAfterSeconds || 120) / 60));
          if (!showRateLimit(minutes)) showError('authRecoveryError', new Error(`Ya solicitaste un enlace para este correo. Revisa tu bandeja o vuelve a intentarlo en ${minutes} minutos.`));
          return;
        }
        show('recovery-sent');
      } catch (error) {
        const rateLimited = /rate limit/i.test(error?.message || '');
        showError('authRecoveryError', rateLimited
          ? new Error('Se han enviado demasiados correos seguidos. Espera unos minutos antes de solicitar otro enlace.')
          : error);
      }
    });
  });
  document.getElementById('authInviteRequest').addEventListener('submit', async event => {
    event.preventDefault();
    if (!service) return;
    await run(event.currentTarget.querySelector('[type="submit"]'), async () => {
      try {
        const code = document.getElementById('authInviteCode').value;
        document.getElementById('authInviteError').hidden = true;
        if (await service.session()) {
          await service.claimBetaAccess(code);
          if (onAuthenticated) await onAuthenticated();
        } else {
          await service.signInWithGoogle(googleRedirectTo, code);
        }
      } catch (error) {
        showError('authInviteError', error);
      }
    });
  });
  document.getElementById('authLinkSave').addEventListener('click', async event => {
    if (!onLinkSave) return onContinue?.();
    await run(event.currentTarget, async () => {
      try {
        await onLinkSave();
      } catch (error) {
        const duplicateSave = error?.code === '23505' || /migration_id|duplicate key|already linked/i.test(error?.message || '');
        if (duplicateSave) document.getElementById('authDuplicateSaveBg')?.classList.add('show');
        else showError('authMigrationError', error);
      }
    });
  });
  document.getElementById('authDuplicateSaveClose')?.addEventListener('click', () => {
    document.getElementById('authDuplicateSaveBg')?.classList.remove('show');
  });
  document.getElementById('authExistingAccountContinue')?.addEventListener('click', async () => {
    document.getElementById('authExistingAccountBg')?.classList.remove('show');
    if (onAuthenticated) await onAuthenticated();
  });
  document.getElementById('authSkipSave').addEventListener('click', () => {
    if (onSkipSave) onSkipSave();
    else onContinue?.();
  });
  document.getElementById('authSignOutPreview').addEventListener('click', async () => {
    await service?.signOut();
    show('login');
  });

  return {
    show,
    showExistingAccount() {
      show('login');
      document.getElementById('authExistingAccountBg')?.classList.add('show');
    },
  };
}
