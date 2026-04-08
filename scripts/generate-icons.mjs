// 슬라임 idle 첫 프레임을 추출해 앱/트레이/exe 아이콘 생성
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceSprite = join(root, 'src/renderer/src/assets/sprites/chr_idle.png')

await mkdir(join(root, 'build'), { recursive: true })
await mkdir(join(root, 'resources'), { recursive: true })

// 1프레임 추출 (64x64, 좌상단)
const frame = await sharp(sourceSprite)
  .extract({ left: 0, top: 0, width: 64, height: 64 })
  .png()
  .toBuffer()

// 픽셀 보존 업스케일을 위한 nearest-neighbor 리사이즈 함수
const upscale = (size) =>
  sharp(frame, { unlimited: true })
    .resize(size, size, { kernel: sharp.kernel.nearest })
    .png()

// 트레이용 (32x32 — 16x16은 너무 흐려져서 32 권장)
await upscale(32).toFile(join(root, 'resources/tray.png'))

// 앱 메타 / 메인 (512x512)
await upscale(512).toFile(join(root, 'resources/icon.png'))

// electron-builder Windows용 (256x256 PNG; electron-builder가 ico로 변환)
await upscale(256).toFile(join(root, 'build/icon.png'))

// .ico 멀티사이즈 생성 (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256]
const pngBuffers = await Promise.all(
  icoSizes.map((s) => upscale(s).toBuffer())
)
const icoBuffer = await pngToIco(pngBuffers)
await writeFile(join(root, 'build/icon.ico'), icoBuffer)

console.log('icons generated:')
console.log('  resources/tray.png  (32x32)')
console.log('  resources/icon.png  (512x512)')
console.log('  build/icon.png      (256x256)')
console.log('  build/icon.ico      (multi-size)')
