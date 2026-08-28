import { exportBackup, importBackup, isImportCommand } from '../storage/state-storage.js';

export function bindBackupControls({
  document,
  navigator,
  getState,
  onImported,
  showToast,
}) {
  let mode = 'export';
  const background = document.getElementById('backupBg');
  const textArea = document.getElementById('backupText');

  document.getElementById('btnExport').addEventListener('click', async () => {
    const data = exportBackup(getState());
    try {
      await navigator.clipboard.writeText(data);
      showToast('Datos copiados al portapapeles ✓', 'heal');
    } catch {
      mode = 'export';
      document.getElementById('backupTitle').textContent = 'Exportar datos';
      textArea.value = data;
      textArea.readOnly = true;
      document.getElementById('backupAction').textContent = 'Cerrar';
      background.classList.add('show');
      textArea.focus();
      textArea.select();
    }
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    mode = 'import';
    document.getElementById('backupTitle').textContent = 'Importar datos';
    textArea.value = '';
    textArea.readOnly = false;
    textArea.placeholder = 'Pega aquí tu copia de seguridad…';
    document.getElementById('backupAction').textContent = 'Importar';
    background.classList.add('show');
  });

  document.getElementById('backupAction').addEventListener('click', () => {
    if (mode === 'import') {
      try {
        const command = isImportCommand(textArea.value);
        onImported(importBackup(getState(), textArea.value));
        showToast(command ? 'Comando aplicado ✓' : 'Datos importados ✓', 'heal');
      } catch {
        showToast(isImportCommand(textArea.value) ? 'Comando no válido' : 'No se pudo leer la copia', 'dmg');
        return;
      }
    }
    background.classList.remove('show');
  });

  background.addEventListener('click', (event) => {
    if (event.target.id === 'backupBg') background.classList.remove('show');
  });
}
