import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { supabase } from './supabaseClient'
import { chapterProgress, subjectProgress } from './progress'
import NotesDrawer from './NotesDrawer'
import { t } from './i18n'

// Fixed node sizes so dagre can lay nodes out without overlap.
const SIZE = {
  subject: { w: 260, h: 136 },
  chapter: { w: 260, h: 128 },
  lesson: { w: 300, h: 84 },
}

/* ---------- small UI pieces ---------- */

function Bar({ percent, track = 'bg-black/10', fill = '#16a34a' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${track}`}>
      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: fill }} />
    </div>
  )
}

const hiddenHandle = { opacity: 0, pointerEvents: 'none' }

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      className="nodrag nopan rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        {children}
      </svg>
    </button>
  )
}

function EditableName({ name, onSave, language, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setValue(name)
  }, [name])

  const finish = (save) => {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    const nextName = value.trim()
    if (save && nextName && nextName !== name) onSave(nextName)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            finish(true)
          }
          if (event.key === 'Escape') {
            setValue(name)
            finish(false)
          }
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${t(language, 'rename')} ${name}`}
        className={`nodrag nopan min-w-0 rounded border border-blue-300 bg-white px-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
    )
  }

  return (
    <>
      <span className={className}>{name}</span>
      <IconButton
        label={`${t(language, 'rename')} ${name}`}
        onClick={() => {
          setValue(name)
          editingRef.current = true
          setEditing(true)
        }}
      >
        <path d="m13.5 4.5 2 2M4 16l3.7-.8L16 6.9a1.4 1.4 0 0 0-2-2l-8.3 8.3L4 16Z" />
      </IconButton>
    </>
  )
}

function InlineAdd({ label, prompt, language, onAdd }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = async (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!value || busy) return
    setBusy(true)
    const created = await onAdd(value)
    setBusy(false)
    if (created) {
      setName('')
      setOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="nodrag nopan rounded bg-white/15 px-2 py-0.5 text-xs transition-colors hover:bg-white/25"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        + {label}
      </button>
      {open && (
        <form
          onSubmit={submit}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="nodrag nopan absolute left-0 top-[calc(100%+8px)] z-30 flex w-64 gap-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-xl"
        >
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setOpen(false)
              }
            }}
            placeholder={prompt}
            aria-label={prompt}
            disabled={busy}
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded bg-blue-700 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? '…' : t(language, 'save')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            aria-label={t(language, 'cancel')}
          >
            ×
          </button>
        </form>
      )}
    </>
  )
}

/* ---------- node types (defined outside the component so they stay stable) ---------- */

function SubjectNode({ data }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-white shadow"
      style={{ background: data.color, width: SIZE.subject.w, height: SIZE.subject.h }}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
        {t(data.language, 'subject')}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <EditableName
            name={data.name}
            onSave={(name) => data.onRename(name)}
            language={data.language}
            className="truncate font-bold"
          />
          <IconButton label={`${t(data.language, 'delete')} ${data.name}`} onClick={() => data.onDelete()}>
            <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4m3-4v4" />
          </IconButton>
        </div>
        <button
          type="button"
          className="nodrag nopan rounded px-1 hover:bg-white/15"
          onClick={(event) => {
            event.stopPropagation()
            data.onToggle()
          }}
          aria-label={`${t(data.language, data.expanded ? 'collapse' : 'expand')} ${data.name}`}
        >
          {data.expanded ? '▾' : '▸'}
        </button>
      </div>
      <div className="nodrag nopan mt-1">
        <InlineAdd
          label={t(data.language, 'addChapter')}
          prompt={t(data.language, 'newChapterPrompt')}
          language={data.language}
          onAdd={data.onAdd}
        />
      </div>
      <div className="mt-1 text-xs text-white/80">
        {data.progress.done}/{data.progress.total} {t(data.language, 'lessons')} · {data.progress.percent}%
      </div>
      <div className="mt-2">
        <Bar percent={data.progress.percent} track="bg-white/30" fill="#ffffff" />
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
    </div>
  )
}

function ChapterNode({ data }) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
      style={{ width: SIZE.chapter.w, height: SIZE.chapter.h, borderLeft: `5px solid ${data.color}` }}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {t(data.language, 'chapter')}
      </div>
      <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1">
          <EditableName
            name={data.name}
            onSave={(name) => data.onRename(name)}
            language={data.language}
            className="line-clamp-2 text-sm font-semibold leading-tight"
          />
          <IconButton label={`${t(data.language, 'delete')} ${data.name}`} onClick={() => data.onDelete()}>
            <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4m3-4v4" />
          </IconButton>
        </div>
        <button
          type="button"
          className="nodrag nopan flex shrink-0 items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs hover:bg-gray-100"
          onClick={(event) => {
            event.stopPropagation()
            data.onNotes()
          }}
          aria-label={`${t(data.language, 'notes')} ${data.name}`}
        >
          {t(data.language, 'notes')}{data.noteCount > 0 && <span>{data.noteCount}</span>}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {data.progress.done}/{data.progress.total} · {data.progress.percent}%
        </span>
        <div className="flex items-center gap-1">
          <InlineAdd
            label={t(data.language, 'addLesson')}
            prompt={t(data.language, 'newLessonPrompt')}
            language={data.language}
            onAdd={data.onAdd}
          />
          <button
            type="button"
            className="nodrag nopan rounded px-1 hover:bg-gray-100"
            onClick={(event) => {
              event.stopPropagation()
              data.onToggle()
            }}
            aria-label={`${t(data.language, data.expanded ? 'collapse' : 'expand')} ${data.name}`}
          >
            {data.expanded ? '▾' : '▸'}
          </button>
        </div>
      </div>
      <div className="mt-1.5">
        <Bar percent={data.progress.percent} fill={data.color} />
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
    </div>
  )
}

function LessonNode({ data }) {
  const confidenceStyles = {
    1: { border: '#ef4444', background: data.done ? '#f0fdf4' : '#fef2f2' },
    2: { border: '#eab308', background: data.done ? '#f0fdf4' : '#fefce8' },
    3: { border: '#22c55e', background: '#f0fdf4' },
  }
  const confidenceStyle = confidenceStyles[data.confidence] ?? {
    border: data.done ? '#22c55e' : '#d1d5db',
    background: data.done ? '#f0fdf4' : '#ffffff',
  }
  const confidenceClass =
    data.confidence === 1
      ? 'lesson-confidence-shaky'
      : data.confidence === 2
        ? 'lesson-confidence-okay'
        : data.confidence === 3
          ? 'lesson-confidence-solid'
          : ''
  const confidenceLevels = [
    { value: 1, key: 'shaky', color: '#ef4444' },
    { value: 2, key: 'okay', color: '#eab308' },
    { value: 3, key: 'solid', color: '#22c55e' },
  ]

  return (
    <div
      className={`flex flex-col justify-center gap-1.5 rounded-lg border-2 px-3 py-2 shadow-sm transition-colors duration-200 ${confidenceClass}`}
      style={{
        width: SIZE.lesson.w,
        height: SIZE.lesson.h,
        borderColor: confidenceStyle.border,
        borderWidth: data.confidence === 1 ? 4 : 2,
        backgroundColor: confidenceStyle.background,
      }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          type="checkbox"
          checked={data.done}
          onChange={data.onToggle}
          aria-label={t(data.language, 'markDone', { name: data.title })}
          className="nodrag nopan h-4 w-4 shrink-0 cursor-pointer accent-green-600"
        />
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
          {t(data.language, 'lesson')}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <EditableName
            name={data.title}
            onSave={(title) => data.onRename(title)}
            language={data.language}
            className={`line-clamp-2 text-xs leading-tight ${
              data.done ? 'text-gray-400 line-through' : ''
            }`}
          />
          <IconButton label={`${t(data.language, 'delete')} ${data.title}`} onClick={() => data.onDelete()}>
            <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M8.5 9v4m3-4v4" />
          </IconButton>
          <button
            type="button"
            aria-label={t(data.language, data.focused ? 'removeFromFocus' : 'addToFocus', {
              name: data.title,
            })}
            aria-pressed={data.focused}
            title={t(data.language, data.focused ? 'removeFromFocus' : 'addToFocus', {
              name: data.title,
            })}
            onClick={(event) => {
              event.stopPropagation()
              data.onToggleFocus()
            }}
            className={`nodrag nopan rounded p-1 transition-colors ${
              data.focused
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'text-gray-500 hover:bg-gray-100 hover:text-blue-700'
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="10" cy="10" r="6.5" />
              <circle cx="10" cy="10" r="2.2" />
              <path d="M10 1.8v2M18.2 10h-2M10 18.2v-2M1.8 10h2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="nodrag nopan flex items-center gap-1 pl-5">
        <span className="mr-1 text-[10px] font-medium text-gray-500">
          {t(data.language, 'confidence')}
        </span>
        {confidenceLevels.map(({ value, key, color }) => (
          <button
            key={value}
            type="button"
            aria-label={`${t(data.language, 'confidence')}: ${t(data.language, key)}`}
            aria-pressed={data.confidence === value}
            title={t(data.language, key)}
            onClick={(event) => {
              event.stopPropagation()
              data.onConfidence(value)
            }}
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors"
            style={
              data.confidence === value
                ? { color: '#fff', borderColor: color, backgroundColor: color }
                : { color, borderColor: color, backgroundColor: 'transparent' }
            }
          >
            {value} · {t(data.language, key)}
          </button>
        ))}
        <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      </div>
    </div>
  )
}

const nodeTypes = { subject: SubjectNode, chapter: ChapterNode, lesson: LessonNode }

/* ---------- dagre layout ---------- */

function layout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 150 })
  nodes.forEach((n) => g.setNode(n.id, { width: SIZE[n.type].w, height: SIZE[n.type].h }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - SIZE[n.type].w / 2, y: p.y - SIZE[n.type].h / 2 } }
  })
}

/* ---------- main component ---------- */

function Tree({ userEmail, userId, language, nightMode }) {
  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow()
  const [data, setData] = useState({ subjects: [], chapters: [], lessons: [], notes: [] })
  const [nodePositions, setNodePositions] = useState(() => {
    const saved = localStorage.getItem(`bacii-node-positions-${userEmail}`)
    if (!saved) return {}
    try {
      const positions = JSON.parse(saved)
      return positions && typeof positions === 'object' && !Array.isArray(positions)
        ? positions
        : {}
    } catch (error) {
      console.error('Could not restore saved tree positions.', error)
      return {}
    }
  })
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Subjects start expanded; chapters start collapsed.
  const [collapsedSubjects, setCollapsedSubjects] = useState(new Set())
  const [expandedChapters, setExpandedChapters] = useState(new Set())
  const [searchCollapsedSubjects, setSearchCollapsedSubjects] = useState(new Set())
  const [searchCollapsedChapters, setSearchCollapsedChapters] = useState(new Set())
  const [notesChapterId, setNotesChapterId] = useState(null)
  const [search, setSearch] = useState('')
  const [zoomPercent, setZoomPercent] = useState(100)
  const [focusedLessonIds, setFocusedLessonIds] = useState(() => {
    const saved = localStorage.getItem(`bacii-focused-lessons-${userEmail}`)
    if (!saved) return new Set()
    try {
      const ids = JSON.parse(saved)
      return Array.isArray(ids) ? new Set(ids.filter((id) => typeof id === 'string')) : new Set()
    } catch (error) {
      console.error('Could not restore focused lessons.', error)
      return new Set()
    }
  })
  const [panelTab, setPanelTab] = useState('focus')
  const [pendingFocusLessonId, setPendingFocusLessonId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem(`bacii-node-positions-${userEmail}`, JSON.stringify(nodePositions))
  }, [nodePositions, userEmail])

  useEffect(() => {
    localStorage.setItem(
      `bacii-focused-lessons-${userEmail}`,
      JSON.stringify([...focusedLessonIds])
    )
  }, [focusedLessonIds, userEmail])

  useEffect(() => {
    if (loading || error) return
    const lessonIds = new Set(data.lessons.map((lesson) => lesson.id))
    setFocusedLessonIds((current) => {
      const next = new Set([...current].filter((id) => lessonIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [data.lessons, error, loading])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [s, c, l, n, savedLayout] = await Promise.all([
      supabase.from('subjects').select('*').order('sort_order'),
      supabase.from('chapters').select('*').order('sort_order'),
      supabase.from('lessons').select('*').order('sort_order'),
      supabase.from('notes').select('*').order('created_at', { ascending: false }),
      supabase
        .from('tree_layouts')
        .select('node_positions')
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    const err = s.error || c.error || l.error || n.error
    if (err) setError(err.message)
    else setData({ subjects: s.data, chapters: c.data, lessons: l.data, notes: n.data })

    if (savedLayout.error) {
      setError((current) => current || savedLayout.error.message)
    } else if (savedLayout.data?.node_positions) {
      const positions = savedLayout.data.node_positions
      if (typeof positions === 'object' && !Array.isArray(positions)) {
        setNodePositions(positions)
      } else {
        setError('Saved tree positions have an invalid format.')
      }
    } else {
      const savedLocally = localStorage.getItem(`bacii-node-positions-${userEmail}`)
      if (savedLocally) {
        try {
          const positions = JSON.parse(savedLocally)
          if (positions && typeof positions === 'object' && !Array.isArray(positions)) {
            setNodePositions(positions)
            if (Object.keys(positions).length > 0) {
              try {
                const { error: migrationError } = await supabase.from('tree_layouts').upsert({
                  user_id: userId,
                  node_positions: positions,
                })
                if (migrationError) setError((current) => current || migrationError.message)
              } catch (migrationError) {
                setError((current) =>
                  current ||
                  (migrationError instanceof Error
                    ? migrationError.message
                    : String(migrationError))
                )
              }
            }
          }
        } catch (restoreError) {
          console.error('Could not restore saved tree positions.', restoreError)
        }
      }
    }
    setPositionsLoaded(true)
    setLoading(false)
  }, [userEmail, userId])

  useEffect(() => {
    load()
  }, [load])

  // Fit the view once the first load finishes.
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => fitView({ padding: 0.15 }), 50)
      return () => clearTimeout(t)
    }
  }, [loading, fitView])

  const toggleIn = (setter, id) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleLesson = useCallback(async (lesson) => {
    const done = !lesson.done
    const done_at = done ? new Date().toISOString() : null
    const patch = (d, vals) => ({
      ...d,
      lessons: d.lessons.map((x) => (x.id === lesson.id ? { ...x, ...vals } : x)),
    })
    setData((d) => patch(d, { done, done_at })) // optimistic update
    const { error } = await supabase.from('lessons').update({ done, done_at }).eq('id', lesson.id)
    if (error) {
      setData((d) => patch(d, { done: lesson.done, done_at: lesson.done_at })) // revert
      setError(error.message)
    }
  }, [])

  const updateConfidence = useCallback(async (lesson, confidence) => {
    const previousConfidence = lesson.confidence ?? null
    setError('')
    setData((current) => ({
      ...current,
      lessons: current.lessons.map((item) =>
        item.id === lesson.id ? { ...item, confidence } : item
      ),
    }))

    const { error } = await supabase
      .from('lessons')
      .update({ confidence })
      .eq('id', lesson.id)
    if (error) {
      setData((current) => ({
        ...current,
        lessons: current.lessons.map((item) =>
          item.id === lesson.id ? { ...item, confidence: previousConfidence } : item
        ),
      }))
      setError(error.message)
    }
  }, [])

  const toggleFocusedLesson = useCallback((lessonId) => {
    setFocusedLessonIds((current) => {
      const next = new Set(current)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
  }, [])

  const goToLesson = useCallback((lesson) => {
    const chapter = data.chapters.find((item) => item.id === lesson.chapter_id)
    if (!chapter) {
      setError(`Could not find the chapter for "${lesson.title}".`)
      return
    }

    setError('')
    setSearch('')
    setCollapsedSubjects((current) => {
      const next = new Set(current)
      next.delete(chapter.subject_id)
      return next
    })
    setExpandedChapters((current) => new Set(current).add(chapter.id))
    setPendingFocusLessonId(lesson.id)
  }, [data.chapters])

  const addNote = useCallback(
    async (chapterId, content) => {
      const { data: note, error } = await supabase
        .from('notes')
        .insert({ chapter_id: chapterId, author_email: userEmail, content })
        .select()
        .single()
      if (error) return error.message
      setData((current) => ({ ...current, notes: [note, ...current.notes] }))
      return null
    },
    [userEmail]
  )

  const updateNote = useCallback(async (noteId, content) => {
    const { data: note, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', noteId)
      .select()
      .single()
    if (error) return error.message
    setData((current) => ({
      ...current,
      notes: current.notes.map((item) => (item.id === noteId ? note : item)),
    }))
    return null
  }, [])

  const deleteNote = useCallback(async (noteId) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) return error.message
    setData((current) => ({
      ...current,
      notes: current.notes.filter((item) => item.id !== noteId),
    }))
    return null
  }, [])

  const renameItem = useCallback(async (type, id, name) => {
    setError('')
    const table = type === 'subject' ? 'subjects' : type === 'chapter' ? 'chapters' : 'lessons'
    const column = type === 'lesson' ? 'title' : 'name'
    const { error } = await supabase.from(table).update({ [column]: name }).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setData((current) => ({
      ...current,
      [table]: current[table].map((item) => (item.id === id ? { ...item, [column]: name } : item)),
    }))
  }, [])

  const addItem = useCallback(
    async (type, parentId, name) => {
      const isChapter = type === 'chapter'
      const trimmedName = name.trim()
      if (!trimmedName) return false

      setError('')
      const siblings = isChapter
        ? data.chapters.filter((chapter) => chapter.subject_id === parentId)
        : data.lessons.filter((lesson) => lesson.chapter_id === parentId)
      const sortOrder = siblings.reduce(
        (max, sibling) => Math.max(max, sibling.sort_order ?? 0),
        -1
      ) + 1
      const table = isChapter ? 'chapters' : 'lessons'
      const values = isChapter
        ? { subject_id: parentId, name: trimmedName, sort_order: sortOrder }
        : { chapter_id: parentId, title: trimmedName, sort_order: sortOrder }
      const { data: created, error } = await supabase.from(table).insert(values).select().single()
      if (error) {
        setError(error.message)
        return false
      }

      setData((current) => ({ ...current, [table]: [...current[table], created] }))
      if (isChapter) {
        setCollapsedSubjects((current) => {
          const next = new Set(current)
          next.delete(parentId)
          return next
        })
      } else {
        setExpandedChapters((current) => new Set(current).add(parentId))
      }
      return true
    },
    [data.chapters, data.lessons, language]
  )

  const deleteItem = useCallback((type, id, name) => {
    const chapterIds =
      type === 'subject'
        ? new Set(data.chapters.filter((chapter) => chapter.subject_id === id).map((chapter) => chapter.id))
        : new Set([id])
    const chapterCount = chapterIds.size
    const lessonCount =
      type === 'subject'
        ? data.lessons.filter((lesson) => chapterIds.has(lesson.chapter_id)).length
        : type === 'chapter'
          ? data.lessons.filter((lesson) => lesson.chapter_id === id).length
          : 0
    const detailKey =
      type === 'subject'
        ? 'deleteSubjectDetails'
        : type === 'chapter'
          ? 'deleteChapterDetails'
          : 'deleteLessonDetails'
    setPendingDelete({
      type,
      id,
      name,
      detail: t(language, detailKey, {
        chapters: chapterCount,
        lessons: lessonCount,
      }),
    })
  }, [data.chapters, data.lessons, language])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleteBusy) return
    const { type, id } = pendingDelete
    setDeleteBusy(true)
    setError('')
    const table = type === 'subject' ? 'subjects' : type === 'chapter' ? 'chapters' : 'lessons'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      setError(error.message)
      setDeleteBusy(false)
      return
    }

    if (
      notesChapterId &&
      (type === 'chapter' && notesChapterId === id ||
        type === 'subject' &&
          data.chapters.some(
            (chapter) => chapter.subject_id === id && chapter.id === notesChapterId
          ))
    ) {
      setNotesChapterId(null)
    }

    setData((current) => {
      if (type === 'subject') {
        const chapterIds = new Set(
          current.chapters.filter((chapter) => chapter.subject_id === id).map((chapter) => chapter.id)
        )
        return {
          ...current,
          subjects: current.subjects.filter((subject) => subject.id !== id),
          chapters: current.chapters.filter((chapter) => chapter.subject_id !== id),
          lessons: current.lessons.filter((lesson) => !chapterIds.has(lesson.chapter_id)),
          notes: current.notes.filter((note) => !chapterIds.has(note.chapter_id)),
        }
      }
      if (type === 'chapter') {
        return {
          ...current,
          chapters: current.chapters.filter((chapter) => chapter.id !== id),
          lessons: current.lessons.filter((lesson) => lesson.chapter_id !== id),
          notes: current.notes.filter((note) => note.chapter_id !== id),
        }
      }
      return { ...current, lessons: current.lessons.filter((lesson) => lesson.id !== id) }
    })
    setPendingDelete(null)
    setDeleteBusy(false)
  }, [data.chapters, deleteBusy, notesChapterId, pendingDelete])

  // Build nodes + edges from data and collapse state, then lay out with dagre.
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([])
  const { nodes, edges } = useMemo(() => {
    const rawNodes = []
    const rawEdges = []
    const { subjects, chapters, lessons, notes } = data
    const query = search.trim().toLocaleLowerCase()

    subjects.forEach((s) => {
      const subjectMatches = !query || s.name.toLocaleLowerCase().includes(query)
      const subjectChapters = chapters.filter((chapter) => chapter.subject_id === s.id)

      const matchingChapters = subjectChapters.filter((chapter) => {
        const chapterMatches = chapter.name.toLocaleLowerCase().includes(query)
        const lessonMatches = lessons.some(
          (lesson) =>
            lesson.chapter_id === chapter.id &&
            lesson.title.toLocaleLowerCase().includes(query)
        )
        return chapterMatches || lessonMatches
      })
      if (query && !subjectMatches && matchingChapters.length === 0) return

      const color = s.color || '#374151'
      const subjectOpen = query
        ? !searchCollapsedSubjects.has(s.id)
        : !collapsedSubjects.has(s.id)
      rawNodes.push({
        id: `sub-${s.id}`,
        type: 'subject',
        data: {
          name: s.name,
          color,
          language,
          expanded: subjectOpen,
          progress: subjectProgress(s.id, chapters, lessons),
          onToggle: () =>
            toggleIn(query ? setSearchCollapsedSubjects : setCollapsedSubjects, s.id),
          onRename: (name) => renameItem('subject', s.id, name),
          onDelete: () => deleteItem('subject', s.id, s.name),
          onAdd: (name) => addItem('chapter', s.id, name),
        },
      })
      if (!subjectOpen) return

      const visibleChapters =
        query && !subjectMatches ? matchingChapters : subjectChapters
      visibleChapters.forEach((c) => {
          const chapterMatches = c.name.toLocaleLowerCase().includes(query)
          const matchingLessons = lessons.filter(
            (lesson) =>
              lesson.chapter_id === c.id &&
              lesson.title.toLocaleLowerCase().includes(query)
          )
          const chapterOpen = query
            ? (chapterMatches || matchingLessons.length > 0) &&
              !searchCollapsedChapters.has(c.id)
            : expandedChapters.has(c.id)
          rawNodes.push({
            id: `chap-${c.id}`,
            type: 'chapter',
            data: {
              name: c.name,
              color,
              language,
              expanded: chapterOpen,
              progress: chapterProgress(c.id, lessons),
              noteCount: notes.filter((n) => n.chapter_id === c.id).length,
              onToggle: () =>
                toggleIn(query ? setSearchCollapsedChapters : setExpandedChapters, c.id),
              onNotes: () => setNotesChapterId(c.id),
              onRename: (name) => renameItem('chapter', c.id, name),
              onDelete: () => deleteItem('chapter', c.id, c.name),
              onAdd: (name) => addItem('lesson', c.id, name),
            },
          })
          rawEdges.push({
            id: `edge-sub-${s.id}-chap-${c.id}`,
            source: `sub-${s.id}`,
            target: `chap-${c.id}`,
            type: 'default', // smooth bezier curve
            style: { stroke: color, strokeWidth: 2 },
          })
          if (!chapterOpen) return

          const chapterLessons = lessons.filter((lesson) => lesson.chapter_id === c.id)
          const visibleLessons =
            query && !chapterMatches ? matchingLessons : chapterLessons
          visibleLessons.forEach((l) => {
              rawNodes.push({
                id: `les-${l.id}`,
                type: 'lesson',
                data: {
                  title: l.title,
                  done: l.done,
                  confidence: l.confidence,
                  focused: focusedLessonIds.has(l.id),
                  language,
                  onToggle: () => toggleLesson(l),
                  onConfidence: (confidence) => updateConfidence(l, confidence),
                  onToggleFocus: () => toggleFocusedLesson(l.id),
                  onRename: (title) => renameItem('lesson', l.id, title),
                  onDelete: () => deleteItem('lesson', l.id, l.title),
                },
              })
              rawEdges.push({
                id: `edge-chap-${c.id}-les-${l.id}`,
                source: `chap-${c.id}`,
                target: `les-${l.id}`,
                type: 'default',
                style: { stroke: color, strokeWidth: 1.5 },
              })
          })
        })
    })

    const positionedNodes = layout(rawNodes, rawEdges).map((node) => ({
      ...node,
      position: nodePositions[node.id] ?? node.position,
      draggable: true,
    }))
    return { nodes: positionedNodes, edges: rawEdges }
  }, [
    data,
    collapsedSubjects,
    expandedChapters,
    toggleLesson,
    updateConfidence,
    renameItem,
    deleteItem,
    addItem,
    language,
    nodePositions,
    search,
    searchCollapsedSubjects,
    searchCollapsedChapters,
    focusedLessonIds,
    toggleFocusedLesson,
  ])

  useEffect(() => {
    setFlowNodes(nodes)
    setFlowEdges(edges)
  }, [nodes, edges, setFlowNodes, setFlowEdges])

  useEffect(() => {
    if (!pendingFocusLessonId) return
    const targetId = `les-${pendingFocusLessonId}`
    if (!flowNodes.some((node) => node.id === targetId)) return

    fitView({
      nodes: [{ id: targetId }],
      duration: 650,
      padding: 0.4,
      maxZoom: 1.2,
    })
    setPendingFocusLessonId(null)
  }, [flowNodes, fitView, pendingFocusLessonId])

  const notesChapter = data.chapters.find((c) => c.id === notesChapterId)
  const completedLessons = data.lessons.filter((lesson) => lesson.done).length
  const subjectOrder = new Map(data.subjects.map((subject, index) => [subject.id, index]))
  const chaptersById = new Map(data.chapters.map((chapter) => [chapter.id, chapter]))
  const orderedLessons = data.lessons
    .map((lesson) => ({
      ...lesson,
      chapter: chaptersById.get(lesson.chapter_id),
    }))
    .sort((a, b) => {
      const chapterA = a.chapter
      const chapterB = b.chapter
      if (!chapterA || !chapterB) return chapterA ? -1 : chapterB ? 1 : 0
      return (
        (subjectOrder.get(chapterA.subject_id) ?? Number.MAX_SAFE_INTEGER) -
          (subjectOrder.get(chapterB.subject_id) ?? Number.MAX_SAFE_INTEGER) ||
        (chapterA.sort_order ?? 0) - (chapterB.sort_order ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
    })
  const reviewConfidence = { shaky: 1, okay: 2, solid: 3 }[panelTab]
  const panelLessons =
    panelTab === 'focus'
      ? orderedLessons.filter((lesson) => focusedLessonIds.has(lesson.id))
      : orderedLessons.filter((lesson) => lesson.confidence === reviewConfidence)
  const panelTitleKey = panelTab === 'focus' ? 'focus' : panelTab
  const panelDescriptionKey =
    panelTab === 'focus' ? 'focusListDescription' : 'confidenceReviewDescription'
  const overallPercent = data.lessons.length
    ? Math.round((completedLessons / data.lessons.length) * 100)
    : 0

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{t(language, 'overallConfidence')}</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-700">
              {overallPercent}%
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {completedLessons}/{data.lessons.length} {t(language, 'completedLessons')}
          </p>
          <div
            role="progressbar"
            aria-label={t(language, 'overallConfidence')}
            aria-valuenow={overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-gray-200"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="relative">
            <span className="sr-only">{t(language, 'search')}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setSearchCollapsedSubjects(new Set())
                setSearchCollapsedChapters(new Set())
              }}
              placeholder={t(language, 'search')}
              className="w-56 rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm outline-none transition-shadow placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              ⌕
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span><strong className="text-gray-900">{data.subjects.length}</strong> {t(language, 'subjects')}</span>
            <span><strong className="text-gray-900">{data.chapters.length}</strong> {t(language, 'chapters')}</span>
            <span><strong className="text-gray-900">{data.lessons.length}</strong> {t(language, 'lessons')}</span>
          </div>
        </div>
      </section>
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          className={selectionMode ? 'selection-mode' : undefined}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          selectionOnDrag={selectionMode}
          selectionMode="partial"
          panOnDrag={!selectionMode}
          multiSelectionKeyCode="Shift"
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          zoomActivationKeyCode={null}
          minZoom={0.05}
          maxZoom={2.25}
          onMove={(_event, viewport) => setZoomPercent(Math.round(viewport.zoom * 100))}
          onNodeDragStop={async () => {
            const positions = getNodes().reduce((current, currentNode) => {
              current[currentNode.id] = currentNode.position
              return current
            }, {})
            const nextPositions = { ...nodePositions, ...positions }
            setNodePositions(nextPositions)
            localStorage.setItem(
              `bacii-node-positions-${userEmail}`,
              JSON.stringify(nextPositions)
            )
            if (!positionsLoaded) return

            try {
              const { error: saveError } = await supabase.from('tree_layouts').upsert({
                user_id: userId,
                node_positions: nextPositions,
              })
              if (saveError) setError(saveError.message)
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : String(saveError))
            }
          }}
          onNodeClick={(event, node) => {
            if (!event.shiftKey && (node.type === 'subject' || node.type === 'chapter')) {
              node.data.onToggle()
            }
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color={nightMode ? '#374151' : '#d1d5db'} />
          <Panel position="top-left" className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={selectionMode}
              title={selectionMode ? t(language, 'selectionHint') : t(language, 'multiSelectHint')}
              onClick={() => setSelectionMode((current) => !current)}
              className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                selectionMode
                  ? 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800'
                  : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              {t(language, selectionMode ? 'selecting' : 'selectMode')}
            </button>
            {flowNodes.some((node) => node.selected) && (
              <>
                <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {t(language, 'selected', {
                    count: flowNodes.filter((node) => node.selected).length,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFlowNodes((current) =>
                      current.map((node) => ({ ...node, selected: false }))
                    )
                  }
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  {t(language, 'clearSelection')}
                </button>
              </>
            )}
            <button
              onClick={() => fitView({ padding: 0.2, duration: 450 })}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              {t(language, 'fitToScreen')}
            </button>
            <button
              type="button"
              aria-label={t(language, 'zoomOut')}
              title={t(language, 'zoomOut')}
              onClick={() => zoomOut({ duration: 220 })}
              className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-base leading-none hover:bg-gray-50"
            >
              −
            </button>
            <span className="min-w-12 self-center text-center text-xs font-medium tabular-nums text-gray-600">
              {zoomPercent}%
            </span>
            <button
              type="button"
              aria-label={t(language, 'zoomIn')}
              title={t(language, 'zoomIn')}
              onClick={() => zoomIn({ duration: 220 })}
              className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-base leading-none hover:bg-gray-50"
            >
              +
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? t(language, 'loading') : t(language, 'refresh')}
            </button>
          </Panel>
          <Panel position="top-right" className="hidden sm:block">
            <span className="rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-500 shadow-sm backdrop-blur">
              {t(language, selectionMode ? 'selectionHint' : 'multiSelectHint')}
            </span>
          </Panel>
          {error && (
            <Panel position="bottom-left">
              <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            </Panel>
          )}
        </ReactFlow>
        </div>
        <aside className="z-10 flex max-h-72 w-full shrink-0 flex-col border-t border-gray-200 bg-white shadow-sm lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t(language, panelTitleKey)}</h2>
              <p className="text-xs text-gray-500">
                {t(language, panelDescriptionKey)}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {panelLessons.length}
            </span>
          </div>
          <div
            role="tablist"
            aria-label={t(language, 'lessonViews')}
            className="grid grid-cols-4 gap-1 border-b border-gray-200 px-2 py-2"
          >
            {['focus', 'shaky', 'okay', 'solid'].map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`lesson-tab-${tab}`}
                aria-selected={panelTab === tab}
                aria-controls="lesson-panel"
                onClick={() => setPanelTab(tab)}
                className={`rounded-md px-1 py-2 text-xs font-medium transition-colors ${
                  panelTab === tab
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {t(language, tab === 'focus' ? 'focus' : tab)}
              </button>
            ))}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            <div
              id="lesson-panel"
              role="tabpanel"
              aria-labelledby={`lesson-tab-${panelTab}`}
              className="space-y-2"
            >
            {panelLessons.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">
                {t(language, panelTab === 'focus' ? 'noFocusedLessons' : 'noConfidenceLessons')}
              </p>
            ) : (
              panelLessons.map((lesson) => (
                <article
                  key={lesson.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => goToLesson(lesson)}
                      className="block w-full truncate text-left text-sm font-medium text-gray-900 hover:text-blue-700 focus:outline-none focus:underline"
                    >
                      {lesson.title}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {lesson.chapter?.name ?? t(language, 'chapter')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToLesson(lesson)}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {t(language, 'goTo')}
                  </button>
                </article>
              ))
            )}
            </div>
          </div>
        </aside>
      </div>

      {notesChapter && (
        <NotesDrawer
          key={notesChapter.id}
          chapter={notesChapter}
          notes={data.notes.filter((n) => n.chapter_id === notesChapter.id)}
          onAdd={addNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onClose={() => setNotesChapterId(null)}
          language={language}
        />
      )}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteBusy) setPendingDelete(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !deleteBusy) setPendingDelete(null)
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-gray-900">
              {t(language, 'deleteTitle')}
            </h2>
            <p id="delete-dialog-description" className="mt-2 text-sm leading-6 text-gray-600">
              <span className="font-medium text-gray-900">{pendingDelete.name}</span>
              <br />
              {pendingDelete.detail} {t(language, 'deleteDescription')}
            </p>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {deleteBusy ? t(language, 'deleting') : t(language, 'confirmDelete')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default function TreeView(props) {
  return (
    <ReactFlowProvider>
      <Tree {...props} />
    </ReactFlowProvider>
  )
}
