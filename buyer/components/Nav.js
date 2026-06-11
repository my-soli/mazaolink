import Link from 'next/link'

const EMOJI = {
  tea: '🌿', milk: '🥛', maziwa: '🥛', chai: '🌿',
  vegetables: '🥬', mboga: '🥬', viazi: '🥔', potatoes: '🥔',
  cattle: '🐄', cow: '🐄', friesian: '🐄', zebu: '🐄',
  default: '🌾'
}

export function getEmoji(type = '') {
  return EMOJI[type.toLowerCase()] || EMOJI.default
}

export default function Nav() {
  return (
    <nav>
      <div className="nav-inner">
        <Link href="/" className="logo">🌿 MazaoLink</Link>
        <Link href="/" className="nav-link">Browse Listings</Link>
      </div>
    </nav>
  )
}
