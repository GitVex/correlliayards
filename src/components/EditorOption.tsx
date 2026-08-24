type CommonProps = {
  label: string
  /** Compact layout: label above a narrow input, used inside quad grids. */
  compact?: boolean
  maxWidth?: number
}

type TextOptionProps = CommonProps & {
  kind: 'text' | 'number'
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

type SelectOptionProps = CommonProps & {
  kind: 'select'
  value: string
  choices: string[]
  onChange: (value: string) => void
}

type TextareaOptionProps = CommonProps & {
  kind: 'textarea'
  defaultValue?: string
  onChange?: (value: string) => void
}

export type EditorOptionProps = TextOptionProps | SelectOptionProps | TextareaOptionProps

export function EditorOption(props: EditorOptionProps) {
  const { label, compact } = props

  const input = (() => {
    switch (props.kind) {
      case 'text':
      case 'number':
        return (
          <input
            type={props.kind === 'number' ? 'number' : 'text'}
            className={props.kind === 'number' ? 'field field--num' : 'field'}
            style={props.maxWidth ? { maxWidth: props.maxWidth } : undefined}
            value={props.value}
            defaultValue={props.value === undefined ? props.defaultValue : undefined}
            onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
          />
        )
      case 'select':
        return (
          <select
            className="field"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
          >
            {props.choices.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        )
      case 'textarea':
        return (
          <textarea
            className="field"
            defaultValue={props.defaultValue}
            onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
          />
        )
    }
  })()

  if (compact) {
    return (
      <div className="quad__cell">
        <span className="quad__cap">{label}</span>
        {input}
      </div>
    )
  }

  return (
    <div className="row">
      <label className="lbl">{label}</label>
      {input}
    </div>
  )
}
