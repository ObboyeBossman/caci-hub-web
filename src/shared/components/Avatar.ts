// src/shared/components/Avatar.ts
// Renders a member avatar — photo or colour-coded initials fallback.
// Mirrors: member_avatar.dart (Flutter)

const PALETTE = [
  '#004BA0', '#C60026', '#1A5FB4',
  '#7C3AED', '#1A7F37', '#9A6700',
]

function _colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}

export interface AvatarOptions {
  firstName:       string
  lastName:        string
  profilePhotoUrl: string | null
  size?:           number  // px, default 36
}

/**
 * Returns the HTML string for a member avatar.
 * Drop it anywhere with innerHTML = avatarHtml(...)
 */
export function avatarHtml(opts: AvatarOptions): string {
  const size     = opts.size ?? 36
  const fontSize = Math.round(size * 0.36)
  const inits    = `${opts.firstName?.[0] ?? ''}${opts.lastName?.[0] ?? ''}`.toUpperCase()
  const color    = _colorFromName(`${opts.firstName} ${opts.lastName}`)

  if (opts.profilePhotoUrl) {
    return `
      <div class="caci-avatar" style="width:${size}px;height:${size}px">
        <img src="${opts.profilePhotoUrl}" alt="${inits}" loading="lazy"
          onerror="this.parentElement.innerHTML='<span style=\\"font-size:${fontSize}px\\">${inits}</span>';
            this.parentElement.style.background='${color}'">
      </div>
    `
  }

  return `
    <div class="caci-avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;background:${color}">
      ${inits}
    </div>
  `
}