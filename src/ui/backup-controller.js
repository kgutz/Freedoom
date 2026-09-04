import { exportBackup, importBackup, isImportCommand } from '../storage/state-storage.js';

function localDateLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function backupFileName(date = new Date()) {
  return `Freedom-partida-${localDateLabel(date)}.txt`;
}

function createBackupFile(data, name) {
  const options = { type: 'text/plain;charset=utf-8' };
  if (typeof File === 'function') return new File([data], name, options);
  const blob = new Blob([data], options);
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

function downloadBackupFile(document, file) {
  const urlApi = globalThis.URL;
  if (!document?.createElement || !document?.body || !urlApi?.createObjectURL) return false;
  const url = urlApi.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => urlApi.revokeObjectURL(url), 0);
  return true;
}

export function bindBackupControls({
  document,
  navigator,
  getState,
  onImported,
  showToast,
  createFile = createBackupFile,
  downloadFile = (file) => downloadBackupFile(document, file),
  now = () => new Date(),
}) {
  let mode = 'export';
  const background = document.getElementById('backupBg');
  const textArea = document.getElementById('backupText');

  document.getElementById('btnExport').addEventListener('click', async () => {
    const data = exportBackup(getState());
    const file = createFile(data, backupFileName(now()));
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Partida de Freedom',
          text: 'Copia de seguridad de mi partida de Freedom.',
          files: [file],
        });
        showToast('Partida compartida ✓', 'heal');
        return;
      }
      if (downloadFile(file)) {
        showToast('Partida descargada ✓', 'heal');
        return;
      }
      await navigator.clipboard.writeText(data);
      showToast('Datos copiados al portapapeles ✓', 'heal');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (downloadFile(file)) {
        showToast('Partida descargada ✓', 'heal');
        return;
      }
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
