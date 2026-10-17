import { useState } from 'react'
import { catalog, DIFFICULTY_LABELS, DISCIPLINES, type CatalogEntry, type Discipline } from '../../challenge/catalog'
import type { Difficulty, InteractionMode } from '../../challenge/types'
import Icon from '../icons/Icon'
import { MODE_LABELS } from '../workbench/WorkbenchChrome'
import { MODE_INFO, modeStatus } from './ChallengeDrawer'
import TechnicalArt from './TechnicalArt'

// Challenge library (task 13.5; Req 34.1, 34.2, 34.8): featured challenge, discipline and
// difficulty filters, text search, Explore/Saved views, and the design-mode cards. Cards come
// from `challenge/catalog.ts`; only the entry linked to the loaded challenge is available.

export type LibraryView = 'Explore' | 'Saved'
export type DisciplineFilter = Discipline | 'All disciplines'
export type DifficultyFilter = Difficulty | 'all'

export interface LibraryFilters {
  discipline: DisciplineFilter
  difficulty: DifficultyFilter
  search: string
  view: LibraryView
}

export const DEFAULT_FILTERS: LibraryFilters = {
  discipline: 'All disciplines',
  difficulty: 'all',
  search: '',
  view: 'Explore',
}

/** Filters the catalog by discipline, difficulty, case-insensitive text, and the saved view. */
export function filterCatalog(
  entries: readonly CatalogEntry[],
  f: LibraryFilters,
  saved: readonly string[],
): CatalogEntry[] {
  const q = f.search.trim().toLowerCase()
  return entries.filter(
    (c) =>
      (f.discipline === 'All disciplines' || c.discipline === f.discipline) &&
      (f.difficulty === 'all' || c.difficulty === f.difficulty) &&
      `${c.title} ${c.description} ${c.concepts.join(' ')}`.toLowerCase().includes(q) &&
      (f.view !== 'Saved' || saved.includes(c.id)),
  )
}

export interface LibraryPageProps {
  /** Catalog entry for the loaded challenge (featured). */
  featured: CatalogEntry
  isRunnable: (entry: CatalogEntry) => boolean
  allowedModes: readonly InteractionMode[]
  started: boolean
  saved: readonly string[]
  onToggleSaved: (id: string) => void
  onOpenFeatured: () => void
  onShowDetail: (entry: CatalogEntry, mode?: InteractionMode) => void
  /** Library entries; defaults to the bundled catalog. */
  entries?: readonly CatalogEntry[]
  /** Modes of a runnable entry's own challenge; defaults to `allowedModes`. */
  modesFor?: (entry: CatalogEntry) => readonly InteractionMode[]
}

const modeList = (modes: readonly InteractionMode[]) =>
  MODE_INFO.filter((m) => modes.includes(m.mode))
    .map((m) => MODE_LABELS[m.mode])
    .join(' · ')

export default function LibraryPage({
  featured,
  isRunnable,
  allowedModes,
  started,
  saved,
  onToggleSaved,
  onOpenFeatured,
  onShowDetail,
  entries = catalog,
  modesFor = () => allowedModes,
}: LibraryPageProps) {
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS)
  const set = (patch: Partial<LibraryFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const filtered = filterCatalog(entries, filters, saved)

  return (
    <>
      <section className="library-heading">
        <h1>Challenges</h1>
      </section>
      <section className="featured-challenge">
        <div className="featured-copy">
          <div className="eyebrow">
            <span className="tiny-dot" />
            FEATURED CHALLENGE
          </div>
          <h2>{featured.title}</h2>
          <p>{featured.description}</p>
          <div className="feature-meta">
            <span>{featured.discipline}</span>
            <span>{DIFFICULTY_LABELS[featured.difficulty]}</span>
            <span>
              <Icon name="clock" size={12} />
              {featured.time}
            </span>
          </div>
          <button type="button" className="primary" onClick={onOpenFeatured}>
            {started ? 'Continue challenge' : 'Open challenge'}
            <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="featured-art">
          <TechnicalArt kind={featured.art} large />
          <span className="featured-caption">
            {featured.title.toUpperCase()}{' '}
            <span>
              {featured.id} / {featured.discipline.toUpperCase()}
            </span>
          </span>
        </div>
      </section>
      <section className="library-section">
        <div className="library-section-top">
          <div className="library-tabs">
            {(['Explore', 'Saved'] as const).map((t) => (
              <button
                type="button"
                key={t}
                className={filters.view === t ? 'active' : ''}
                aria-pressed={filters.view === t}
                onClick={() => set({ view: t })}
              >
                {t === 'Explore' ? 'Challenge library' : 'Saved for later'}
                <span>{t === 'Explore' ? entries.length : saved.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="library-filters">
          <div className="discipline-filters">
            {(['All disciplines', ...DISCIPLINES] as const).map((c) => (
              <button
                type="button"
                key={c}
                className={filters.discipline === c ? 'active' : ''}
                aria-pressed={filters.discipline === c}
                onClick={() => set({ discipline: c })}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="filter-inputs">
            <select
              aria-label="Filter difficulty"
              value={filters.difficulty}
              onChange={(e) => set({ difficulty: e.target.value as DifficultyFilter })}
            >
              <option value="all">All levels</option>
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
            <div className="search-input">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <input
                aria-label="Search challenges"
                placeholder="Find a challenge..."
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="challenge-grid">
          {filtered.map((c) => {
            const runnable = isRunnable(c)
            const isSaved = saved.includes(c.id)
            return (
              <article className={`challenge-card theme-${c.art}`} key={c.id}>
                <button
                  type="button"
                  className="card-art"
                  onClick={() => onShowDetail(c)}
                  aria-label={`View ${c.title}`}
                >
                  <TechnicalArt kind={c.art} />
                  <span className={`availability ${runnable ? 'available' : ''}`}>
                    {runnable ? (
                      <>
                        <span className="tiny-dot" />
                        Available
                      </>
                    ) : (
                      'Concept preview'
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className={`save-card ${isSaved ? 'is-saved' : ''}`}
                  aria-label={`${isSaved ? 'Unsave' : 'Save'} ${c.title}`}
                  aria-pressed={isSaved}
                  onClick={() => onToggleSaved(c.id)}
                >
                  <svg
                    width="14"
                    height="17"
                    viewBox="0 0 18 22"
                    fill={isSaved ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.4"
                    aria-hidden="true"
                  >
                    <path d="M3 2h12v17l-6-4-6 4z" />
                  </svg>
                </button>
                <div className="card-body">
                  <div className="card-classification">
                    <span>{c.discipline}</span>
                    <span className={`level level-${c.difficulty}`}>{DIFFICULTY_LABELS[c.difficulty]}</span>
                  </div>
                  <button type="button" className="card-title" onClick={() => onShowDetail(c)}>
                    {c.title}
                    <Icon name="arrow" size={16} />
                  </button>
                  <p>{c.description}</p>
                  <div className="concept-tags">
                    {c.concepts.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="card-bottom">
                    <span>
                      <Icon name="clock" size={12} />
                      {c.time}
                    </span>
                    <span>{runnable ? modeList(modesFor(c)) : 'Planned challenge'}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <div className="library-empty">
            <Icon name="grid" size={30} />
            <h3>{filters.view === 'Saved' ? 'No saved challenges' : 'No challenges match just yet.'}</h3>
            <p>
              {filters.view === 'Saved'
                ? 'Save any challenge using its bookmark to collect it here.'
                : 'Try another discipline, level, or search term.'}
            </p>
            <button type="button" className="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Explore all challenges
            </button>
          </div>
        )}
      </section>
      <section className="mode-overview">
        <div>
          <h2>Design modes</h2>
        </div>
        <div className="mode-cards">
          {MODE_INFO.map((m, i) => (
            <button type="button" key={m.mode} onClick={() => onShowDetail(featured, m.mode)}>
              <span className="mode-number">
                0{i + 1}
                <Icon name={m.icon} size={19} />
              </span>
              <strong>
                {MODE_LABELS[m.mode]}
                <small>{modeStatus(m.mode, allowedModes)}</small>
              </strong>
              <p>{m.summary}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
