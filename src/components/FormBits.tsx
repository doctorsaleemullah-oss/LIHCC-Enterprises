"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function ImageField({ name, label, current }: { name: string; label: string; current?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" className="h-16 mb-2 rounded-lg border" />
      ) : null}
      <input
        className="input"
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const hidden = e.currentTarget.parentElement?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
          if (!file || !hidden) return;
          if (file.size > 2_000_000) {
            alert("Please use a file under 2 MB.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            hidden.value = String(reader.result || "");
          };
          reader.readAsDataURL(file);
        }}
      />
      <input type="hidden" name={name} defaultValue={current || ""} />
    </div>
  );
}
