'use client'

import { FormatType } from '@/hooks/useTextFormatter'

const BUTTONS: { type: FormatType; label: string; title: string; className: string }[] = [
  { type: 'bold',          label: 'B',  title: 'Negrito (*texto*)',        className: 'font-bold'         },
  { type: 'italic',        label: 'I',  title: 'Itálico (_texto_)',        className: 'italic'            },
  { type: 'strikethrough', label: 'S',  title: 'Riscado (~texto~)',        className: 'line-through'      },
  { type: 'monospace',     label: '<>', title: 'Monoespaço (```texto```)', className: 'font-mono text-xs' },
]

interface FormattingToolbarProps {
  onFormat: (type: FormatType) => void
  disabled?: boolean
}

export function FormattingToolbar({ onFormat, disabled }: FormattingToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10">
      {BUTTONS.map((btn) => (
        <button
          key={btn.type}
          type="button"
          title={btn.title}
          disabled={disabled}
          onMouseDown={(e) => {
            // Prevenir blur do textarea para preservar a seleção
            e.preventDefault()
            onFormat(btn.type)
          }}
          className={`w-7 h-7 flex items-center justify-center rounded text-sm text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${btn.className}`}
        >
          {btn.label}
        </button>
      ))}

      <div className="w-px h-4 bg-white/10 mx-1" />

      <span className="text-xs text-gray-500 ml-1 select-none">
        *negrito* _itálico_ ~riscado~
      </span>
    </div>
  )
}
