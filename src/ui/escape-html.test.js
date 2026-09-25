import { expect, it } from 'vitest';
import { escapeHtml } from './escape-html.js';

it('codifica texto no confiable en contenido y atributos HTML', () => {
  expect(escapeHtml('<img src="x" onerror=\'run()\'>&')).toBe(
    '&lt;img src=&quot;x&quot; onerror=&#039;run()&#039;&gt;&amp;',
  );
});
