// Тот же приём, что в hub-share-links.tsx: navigator.clipboard — привилегия
// secure context, на голом http (см. заметки о проде без HTTPS) её нет
// вовсе — запасной путь через невидимый textarea+execCommand ему не нужен.
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // упадём на запасной путь ниже
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
    return true;
  } finally {
    document.body.removeChild(textarea);
  }
}
