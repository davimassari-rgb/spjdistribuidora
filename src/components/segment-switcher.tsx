"use client";

import { SEGMENT_IDS, SEGMENTS, type Segment } from "@/lib/segments";

/** Troca o segmento de distribuição exibido (Autopeças, Maquiagem, Alimentação). */
export function SegmentSwitcher({
  current,
  action,
}: {
  current: Segment;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <select
        name="segment"
        aria-label="Segmento"
        defaultValue={current}
        key={current}
        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-sm font-medium text-blue-800"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {SEGMENT_IDS.map((id) => (
          <option key={id} value={id}>
            {SEGMENTS[id].label}
          </option>
        ))}
      </select>
    </form>
  );
}
