"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** 0 a 4: comprimento, maiúsculas+minúsculas, números e símbolos. */
export function passwordScore(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(4, value.length < 8 ? Math.min(score, 1) : score);
}

const LEVELS = [
  { label: "Muito fraca", bar: "bg-red-500" },
  { label: "Fraca", bar: "bg-red-500" },
  { label: "Média", bar: "bg-amber-500" },
  { label: "Boa", bar: "bg-green-500" },
  { label: "Forte", bar: "bg-green-600" },
];

/** Campo de senha com botão de mostrar/ocultar e, opcionalmente, indicador de força. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  showStrength = false,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: string;
  showStrength?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = passwordScore(value);
  return (
    <div>
      <div className="relative">
        <input
          className="input pr-10"
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute top-1/2 right-1 btn-icon -translate-y-1/2"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1.5 flex-1 rounded-full ${step <= score ? LEVELS[score].bar : "bg-surface-sunken"}`}
              />
            ))}
          </div>
          <p className="caption mt-1">Força da senha: {LEVELS[score].label}</p>
        </div>
      )}
    </div>
  );
}
