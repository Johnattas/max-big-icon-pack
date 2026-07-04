import type { GeneratedIcon } from './types';

export function renderReport(
  generated: GeneratedIcon[],
  skipped: { concept: string; reason: string }[]
): string {
  const bySource = (s: string) =>
    generated.filter((g) => g.source === s).length;
  const lines: string[] = [];
  lines.push('# Ícones adicionados (max-big-icon-pack)', '');
  lines.push(`Total adicionado: ${generated.length}`);
  lines.push(`- atom: ${bySource('atom')}`);
  lines.push(`- afileicon: ${bySource('afileicon')}`, '');
  lines.push('## Adicionados', '');
  lines.push('| conceito | fonte | tipo | arquivo | associações |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const g of generated) {
    const assoc = [...g.extensions.map((e) => `.${e}`), ...g.fileNames].join(
      ', '
    );
    lines.push(
      `| ${g.concept} | ${g.source} | ${g.kind} | ${g.iconFile} | ${assoc} |`
    );
  }
  lines.push('', `## Pulados (${skipped.length})`, '');
  for (const s of skipped) lines.push(`- ${s.concept}: ${s.reason}`);
  return `${lines.join('\n')}\n`;
}
