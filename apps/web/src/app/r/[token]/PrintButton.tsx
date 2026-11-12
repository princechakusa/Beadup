"use client";

/** Opens the browser's print dialog (also "Save as PDF" on phones and computers). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/15 text-[14px] font-semibold"
    >
      Print or save PDF
    </button>
  );
}
