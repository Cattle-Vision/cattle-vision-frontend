"use client";

import React, { useId } from "react";

interface BrandMarkProps {
  /** Classe Tailwind para dimensionamento (ex.: "h-9 w-9") */
  className?: string;
}

/**
 * Marca visual canônica do CattleVision (`BrandMark`), sincronizada 1:1 com `/icon.svg`.
 * Usa `useId()` no gradiente SVG para evitar colisões de ID quando renderizada múltiplas
 * vezes na mesma árvore DOM (header, footer, telas de auth).
 */
export function BrandMark({ className = "h-9 w-9" }: BrandMarkProps) {
  const gradId = `cv-brand-${useId().replace(/:/g, "")}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradId})`} />
      {/* Cantoneiras do visor de enquadramento anatômico */}
      <path
        d="M96 156 V112 Q96 96 112 96 H156"
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M356 96 H400 Q416 96 416 112 V156"
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M96 356 V400 Q96 416 112 416 H156"
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M356 416 H400 Q416 416 416 400 V356"
        fill="none"
        stroke="#A7F3D0"
        strokeWidth="20"
        strokeLinecap="round"
      />
      {/* Mira concêntrica de garupa bovina */}
      <circle
        cx="256"
        cy="256"
        r="88"
        fill="#FFFFFF"
        fillOpacity="0.16"
        stroke="#FFFFFF"
        strokeWidth="20"
      />
      <circle cx="256" cy="256" r="38" fill="#FFFFFF" />
    </svg>
  );
}
