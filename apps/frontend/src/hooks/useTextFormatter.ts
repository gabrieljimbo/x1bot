import { useCallback, RefObject } from 'react'

export type FormatType = 'bold' | 'italic' | 'strikethrough' | 'monospace'

const FORMAT_MARKERS: Record<FormatType, string | [string, string]> = {
  bold:          '*',
  italic:        '_',
  strikethrough: '~',
  monospace:     ['```', '```'],
}

export function useTextFormatter(
  textareaRef: RefObject<HTMLTextAreaElement>,
  value: string,
  onChange: (newValue: string) => void,
) {
  const applyFormat = useCallback((type: FormatType) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start    = textarea.selectionStart
    const end      = textarea.selectionEnd
    const selected = value.slice(start, end)

    const marker = FORMAT_MARKERS[type]
    const open   = Array.isArray(marker) ? marker[0] : marker
    const close  = Array.isArray(marker) ? marker[1] : marker

    // Toggle: se já está formatado, remover; se não, aplicar
    const alreadyFormatted =
      value.slice(start - open.length, start) === open &&
      value.slice(end, end + close.length) === close

    let newValue: string
    let newStart: number
    let newEnd: number

    if (alreadyFormatted) {
      // Remover formatação
      newValue =
        value.slice(0, start - open.length) +
        selected +
        value.slice(end + close.length)
      newStart = start - open.length
      newEnd   = end   - open.length
    } else {
      // Aplicar formatação
      newValue =
        value.slice(0, start) +
        open + selected + close +
        value.slice(end)
      newStart = start + open.length
      newEnd   = end   + open.length
    }

    onChange(newValue)

    // Restaurar seleção após re-render
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(newStart, newEnd)
    })
  }, [textareaRef, value, onChange])

  return { applyFormat }
}
