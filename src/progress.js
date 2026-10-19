// Pure helpers. Percentages are always computed from lesson data, never stored.

function summarize(lessons) {
  const total = lessons.length
  const done = lessons.filter((l) => l.done).length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Progress for one chapter: done lessons / total lessons in it (0% if none). */
export function chapterProgress(chapterId, lessons) {
  return summarize(lessons.filter((l) => l.chapter_id === chapterId))
}

/** Progress for one subject: done lessons across all its chapters / total. */
export function subjectProgress(subjectId, chapters, lessons) {
  const chapterIds = new Set(
    chapters.filter((c) => c.subject_id === subjectId).map((c) => c.id)
  )
  return summarize(lessons.filter((l) => chapterIds.has(l.chapter_id)))
}
