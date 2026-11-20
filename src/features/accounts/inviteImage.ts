import type qrcode from 'qrcode-generator'

export function makeInviteImage(username: string, initial: string, pigment: string, code: ReturnType<typeof qrcode>) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 440
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  const dark = '#211e26'
  ctx.fillStyle = '#f7f5ec'
  ctx.fillRect(0, 0, 800, 440)
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.roundRect(28, 32, 752, 396, 24)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(20, 20, 752, 396, 24)
  ctx.fillStyle = pigment
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = dark
  ctx.stroke()

  ctx.fillStyle = '#fffef9'
  ctx.fillRect(66, 84, 104, 104)
  ctx.strokeRect(66, 84, 104, 104)
  ctx.fillStyle = dark
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 60px sans-serif'
  ctx.fillText(initial || 'S', 118, 137, 88)
  ctx.textAlign = 'left'
  ctx.font = 'bold 60px sans-serif'
  ctx.fillText('Spend', 66, 250)
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('@' + username, 66, 309, 355)

  const modules = code.getModuleCount()
  const cell = Math.floor(276 / (modules + 8))
  const codeSize = (modules + 8) * cell
  const x = Math.round(593 - codeSize / 2)
  const y = Math.round(217 - codeSize / 2)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, codeSize, codeSize)
  ctx.fillStyle = '#000'
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (code.isDark(row, col)) ctx.fillRect(x + (col + 4) * cell, y + (row + 4) * cell, cell, cell)
    }
  }

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(new File([blob], 'spend-' + username + '.png', { type: 'image/png' }))
      else reject(new Error('Couldn’t encode the invite image'))
    }, 'image/png')
  })
}
