import type qrcode from 'qrcode-generator'

export function makeInviteImage(username: string, initial: string, code: ReturnType<typeof qrcode>) {
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
  ctx.fillStyle = '#f6eedf'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = dark
  ctx.stroke()

  for (const [outer, fill, edge] of [[45, '#c7ead4', '#93b9a2'], [748, '#dac7fa', '#aa91d1']] as const) {
    ctx.beginPath()
    ctx.moveTo(outer, 78)
    ctx.lineTo(396, 104)
    ctx.lineTo(396, 389)
    ctx.lineTo(outer, 362)
    ctx.closePath()
    ctx.save()
    ctx.shadowColor = dark
    ctx.shadowOffsetY = 5
    ctx.fillStyle = edge
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = '#ffe58d'
  ctx.beginPath()
  ctx.arc(118, 136, 52, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
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
  ctx.beginPath()
  ctx.roundRect(447, 71, 292, 292, 12)
  ctx.save()
  ctx.shadowColor = dark
  ctx.shadowOffsetX = 4
  ctx.shadowOffsetY = 5
  ctx.fill()
  ctx.restore()
  ctx.stroke()
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
