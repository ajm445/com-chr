import { autoUpdater } from 'electron-updater'
import { app, dialog, BrowserWindow } from 'electron'

/**
 * GitHub Releases 기반 자동 업데이트.
 * - 앱 시작 시 1회 체크 + 4시간 주기 재체크
 * - 새 버전 발견 시 백그라운드 다운로드
 * - 다운로드 완료 시 사용자에게 재시작 여부 확인
 */
export function initAutoUpdater(getWindow: () => BrowserWindow | null) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message ?? err)
  })

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] up to date:', app.getVersion())
  })

  autoUpdater.on('download-progress', (p) => {
    console.log(`[updater] downloading ${Math.round(p.percent)}% (${Math.round(p.bytesPerSecond / 1024)} KB/s)`)
  })

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('[updater] downloaded:', info.version)
    const win = getWindow()
    const result = await dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
      title: '업데이트 준비 완료',
      message: `새 버전 v${info.version} 이(가) 다운로드되었습니다.`,
      detail: '재시작하면 새 버전이 적용됩니다.',
    })
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  // 첫 체크
  autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed:', e))

  // 4시간마다 재체크
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] periodic check failed:', e))
  }, 4 * 60 * 60 * 1000)
}
