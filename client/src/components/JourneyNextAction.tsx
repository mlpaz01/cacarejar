import { ArrowRight } from "lucide-react";

export function JourneyNextAction({
  title,
  text,
  label,
  onClick,
  disabled = false,
}: {
  title: string;
  text: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#ffd6ce] bg-[#fff8f6] p-5 shadow-sm mb-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-[#ff3217] text-white grid place-items-center flex-shrink-0">
        <ArrowRight className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
          Jornada guiada
        </p>
        <h2 className="text-xl font-black text-[#071b44] mt-1">{title}</h2>
        <p className="text-sm text-[#61708a] leading-relaxed mt-1">{text}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-xl bg-[#071b44] text-white px-4 py-2 text-xs font-black inline-flex items-center justify-center gap-2 hover:bg-[#0b255c] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label} <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </section>
  );
}
