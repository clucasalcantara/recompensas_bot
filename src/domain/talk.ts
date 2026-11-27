export function helloLine(raw: string, name: string): string {
  const text = fold(raw);
  if (text.startsWith("bom dia")) return `Bom dia, ${name}.`;
  if (text.startsWith("boa tarde")) return `Boa tarde, ${name}.`;
  if (text.startsWith("boa noite")) return `Boa noite, ${name}.`;
  return `Oi, ${name}.`;
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
