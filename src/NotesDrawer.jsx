import { useState } from 'react'
import { t } from './i18n'

export default function NotesDrawer({
  chapter,
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
  language,
}) {
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  const editingNote = sorted.find((note) => note.id === editingId)

  async function submit(event) {
    event.preventDefault()
    const content = text.trim()
    if (!content || busy) return

    setBusy(true)
    setError('')
    try {
      const err = editingId
        ? await onUpdate(editingId, content)
        : await onAdd(chapter.id, content)
      if (err) {
        setError(err)
        return
      }
      setText('')
      setEditingId(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError))
    } finally {
      setBusy(false)
    }
  }

  async function removeNote(id) {
    setBusy(true)
    setError('')
    try {
      const err = await onDelete(id)
      if (err) {
        setError(err)
        return
      }
      setDeleteId(null)
      if (editingId === id) {
        setEditingId(null)
        setText('')
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError))
    } finally {
      setBusy(false)
    }
  }

  function editNote(note) {
    setEditingId(note.id)
    setText(note.content)
    setDeleteId(null)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setText('')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label={t(language, 'closeNotes')}
        onClick={onClose}
        className="absolute inset-0 bg-gray-950/35 backdrop-blur-[1px]"
      />
      <aside
        aria-labelledby="notes-drawer-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:inset-y-4 sm:left-auto sm:right-4 sm:max-h-none sm:w-[min(28rem,calc(100vw-2rem))] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t(language, 'notesFor')}
            </p>
            <h2 id="notes-drawer-title" className="mt-1 truncate text-lg font-bold leading-tight">
              {chapter.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(language, 'closeNotes')}
            className="shrink-0 rounded-lg px-3 py-2 text-xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {sorted.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-5 text-sm leading-relaxed text-gray-500">
              {t(language, 'noNotes')}
            </p>
          ) : (
            sorted.map((note) => (
              <article key={note.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">
                  {note.content}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
                  <p className="min-w-0 truncate text-xs text-gray-500">
                    {note.author_email} · {new Date(note.created_at).toLocaleString()}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    {deleteId === note.id ? (
                      <>
                        <span className="mr-1 text-xs text-gray-600">{t(language, 'confirmDeleteNote')}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeNote(note.id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {t(language, 'delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(null)}
                          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          {t(language, 'cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => editNote(note)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          {t(language, 'edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(note.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          {t(language, 'delete')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          {editingNote && (
            <div className="flex items-center justify-between text-xs font-medium text-blue-700">
              <span>{t(language, 'editingNote')}</span>
              <button type="button" onClick={cancelEdit} className="rounded px-2 py-1 hover:bg-blue-50">
                {t(language, 'cancel')}
              </button>
            </div>
          )}
          <label htmlFor="chapter-note-input" className="sr-only">
            {t(language, 'writeNote')}
          </label>
          <textarea
            id="chapter-note-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={t(language, 'writeNote')}
            className="max-h-40 min-h-24 w-full resize-y rounded-xl border border-gray-300 bg-white p-3 text-sm outline-none transition-shadow placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500">{text.length}/5000</span>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="min-w-32 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? t(language, 'saving')
                : t(language, editingId ? 'save' : 'addNote')}
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      </aside>
    </div>
  )
}
