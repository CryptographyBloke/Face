import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../config'
import { friendlyError, useI18n } from '../i18n'
import { SourceImageProblem, drawSquare, loadSourceImage, renderAvatarFile } from '../image'
import { href } from '../router'
import { publishSnapshotAvatar } from '../snapshot'
import { uploadAvatar } from '../storage'
import { useAvatarRecord } from '../useAvatarRecord'
import { useWallet } from '../useWallet'
import { WalletButton } from './Layout'
import { AvatarImage, Notice } from './ui'

type Phase = 'idle' | 'uploading' | 'signing' | 'publishing' | 'done'
type EnsState = { status: 'idle' | 'working' } | { status: 'done' | 'error'; message: string }

export function Studio() {
  const { t } = useI18n()
  const { address, walletClient } = useWallet()
  const [refreshKey, setRefreshKey] = useState(0)
  const record = useAvatarRecord(address, refreshKey)

  const [source, setSource] = useState<{ bitmap: ImageBitmap; png: boolean } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [publishedUri, setPublishedUri] = useState<string | null>(null)
  const [ens, setEns] = useState<EnsState>({ status: 'idle' })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Reset when the wallet changes.
  useEffect(() => {
    setSource(null)
    setPhase('idle')
    setError(null)
    setPublishedUri(null)
    setEns({ status: 'idle' })
  }, [address])

  useEffect(() => {
    if (source && canvasRef.current) drawSquare(canvasRef.current, source.bitmap, zoom, 320)
  }, [source, zoom])

  useEffect(() => () => source?.bitmap.close(), [source])

  const busy = phase === 'uploading' || phase === 'signing' || phase === 'publishing'

  const chooseFile = async (file?: File) => {
    if (!file) return
    setError(null)
    try {
      const bitmap = await loadSourceImage(file)
      setSource({ bitmap, png: file.type === 'image/png' })
      setZoom(1)
      setPhase('idle')
      setPublishedUri(null)
      setEns({ status: 'idle' })
    } catch (cause) {
      if (cause instanceof SourceImageProblem) {
        setError(
          cause.kind === 'invalid-type' ? t.studio.invalidType : cause.kind === 'too-large' ? t.studio.tooLarge : t.studio.unreadable,
        )
      } else setError(friendlyError(cause, t))
    }
  }

  const publish = async () => {
    if (!address || !walletClient || !source) return
    setError(null)
    try {
      setPhase('uploading')
      const file = await renderAvatarFile(source.bitmap, zoom, source.png)
      const uri = await uploadAvatar(file)
      setPhase('signing')
      await publishSnapshotAvatar(walletClient, address, uri, () => setPhase('publishing'))
      setPublishedUri(uri)
      setPhase('done')
      // Give the hub a moment, then re-read so the "current" view catches up.
      window.setTimeout(() => setRefreshKey((key) => key + 1), 4000)
    } catch (cause) {
      setError(friendlyError(cause, t))
      setPhase('idle')
    }
  }

  const writeEns = async () => {
    if (!address || !publishedUri) return
    setEns({ status: 'working' })
    try {
      const { publishEnsAvatar } = await import('../ens')
      const result = await publishEnsAvatar(address, publishedUri)
      setEns(
        result.updated
          ? { status: 'done', message: result.direct ? t.studio.ensDoneAddress : t.studio.ensDoneName(result.name) }
          : { status: 'error', message: t.studio.ensMissing },
      )
    } catch (cause) {
      setEns({ status: 'error', message: friendlyError(cause, t) })
    }
  }

  if (!address) {
    return (
      <div className="studio card">
        <h2>{t.studio.title}</h2>
        <div className="studioEmpty">
          <AvatarImage sources={[]} alt="" size={120} />
          <p className="muted">{t.studio.connectFirst}</p>
          <WalletButton onError={setError} />
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </div>
    )
  }

  const currentSources =
    record.status === 'ready' && record.record.avatar
      ? [...record.record.avatar.gateways, imageUrl(address, 320)]
      : record.status === 'ready'
        ? []
        : [imageUrl(address, 320)]

  return (
    <div className="studio card">
      <div className="studioHead">
        <h2>{t.studio.title}</h2>
        <a className="ghost small" href={href({ page: 'profile', id: address })}>
          {t.studio.viewProfile} →
        </a>
      </div>

      <div className="studioBody">
        <div className="studioPreview">
          {source ? (
            <canvas ref={canvasRef} className="avatar previewCanvas" width={320} height={320} aria-label={t.studio.title} />
          ) : (
            <AvatarImage sources={currentSources} alt={t.studio.current} size={200} />
          )}
          {!source && record.status === 'ready' && !record.record.avatar && <p className="muted small">{t.studio.none}</p>}
        </div>

        <div className="studioControls">
          <label className={`fileDrop ${busy ? 'disabled' : ''}`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onClick={(event) => {
                event.currentTarget.value = ''
              }}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
            <strong>{source ? t.studio.chooseAnother : t.studio.choose}</strong>
            <span className="muted small">{t.studio.dropHint}</span>
          </label>

          {source && (
            <label className="zoom">
              <span>{t.studio.zoom}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                disabled={busy}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          )}

          <button className="primary block" disabled={!source || busy || phase === 'done'} onClick={() => void publish()}>
            {busy ? t.common.working : t.studio.publish}
          </button>

          {phase === 'uploading' && <Notice>{t.studio.uploading}</Notice>}
          {phase === 'signing' && <Notice>{t.studio.signing}</Notice>}
          {phase === 'publishing' && <Notice>{t.studio.publishing}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}

          {phase === 'done' && publishedUri && (
            <>
              <Notice tone="success">{t.studio.published}</Notice>
              <code className="uri" title={publishedUri}>
                {publishedUri}
              </code>
              <div className="ensBox">
                <strong>{t.studio.ensTitle}</strong>
                <p className="muted small">{t.studio.ensBody}</p>
                <button className="ghost" disabled={ens.status === 'working' || ens.status === 'done'} onClick={() => void writeEns()}>
                  {ens.status === 'working' ? t.studio.ensWorking : t.studio.ensButton}
                </button>
                {ens.status === 'done' && <Notice tone="success">{ens.message}</Notice>}
                {ens.status === 'error' && <Notice tone="error">{ens.message}</Notice>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
