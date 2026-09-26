export function withCloudTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error('No se pudo contactar con Freedom Nube. Comprueba tu conexión e inténtalo de nuevo.');
      error.code = 'cloud-timeout';
      error.label = label;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
