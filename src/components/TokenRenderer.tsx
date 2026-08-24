import smallToken from '../assets/base_tokens/small_blank.png'
import mediumToken from '../assets/base_tokens/medium_blank.png'
import largeToken from '../assets/base_tokens/large_blank.png'

export type BaseSize = 'Small' | 'Medium' | 'Large'

const TOKEN_IMG: Record<BaseSize, string> = {
  Small: smallToken,
  Medium: mediumToken,
  Large: largeToken,
}

export const TOKEN_SIZE_MM: Record<BaseSize, { width: number; height: number }> = {
  Small: { width: 39, height: 71 },
  Medium: { width: 59, height: 102 },
  Large: { width: 73.5, height: 129 },
}

export function TokenRenderer({ baseSize }: { baseSize: BaseSize }) {
  const { width, height } = TOKEN_SIZE_MM[baseSize]
  return (
    <img
      className="token-image"
      style={{ width: `${width}mm`, height: `${height}mm` }}
      src={TOKEN_IMG[baseSize]}
      alt={`${baseSize} base token`}
    />
  )
}
