import { useMemo, useRef, useState } from 'react'
import './App.css'
import { useConsole } from './hooks/useConsole'
import type { ProjectTask } from './types'
import { STAGE_LABELS, WORKFLOW_STAGES } from './types'
import {
  advanceGateHint,
  canAdvanceFrom,
  stageUnlocked,
} from './workflow/gates'

const PRESET_ROLES = ['Coordinator', 'Builder', 'Reviewer'] as const

function parseAcceptance(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export default function App() {
  const consoleApi = useConsole()
  const {
    state,
    quota,
    quotaWarning,
    banner,
    setBanner,
    savedFlash,
    startTask,
    clearTask,
    applyTaskPatch,
    advance,
    retreat,
    goStage,
    addRole,
    removeRole,
    setThreshold,
    burnQuota,
    resetQuota,
    exportJson,
    importJson,
    manualSave,
    extensions,
  } = consoleApi

  const fileRef = useRef<HTMLInputElement>(null)
  const task = state.task
  const remainingPct = quota
    ? Math.round(quota.remainingRatio * 1000) / 10
    : null

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1 className="brand">Agent Console</h1>
          <p className="brand-sub">
            Orchestrate intake, assignment, delivery, and review — with a
            quota guard that auto-saves before you run dry.
          </p>
        </div>

        <div className="quota-strip" aria-live="polite">
          <label htmlFor="quota-bar">Quota</label>
          <div
            id="quota-bar"
            className={`quota-bar${quotaWarning ? ' warn' : ''}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={remainingPct ?? 0}
          >
            <span style={{ width: `${remainingPct ?? 0}%` }} />
          </div>
          <div className="quota-meta">
            {quota
              ? `${quota.remaining}/${quota.limit} · ${remainingPct}%`
              : '—'}
          </div>
        </div>

        {banner && (
          <div className="banner" role="status">
            <span>{banner}</span>
            <div className="inline-actions">
              <button type="button" className="btn btn-warn" onClick={exportJson}>
                Export JSON
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBanner(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="tools">
          <button type="button" className="btn" onClick={manualSave}>
            Save
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importJson(file)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn" onClick={() => burnQuota(3)}>
            Burn mock quota
          </button>
          <button type="button" className="btn" onClick={resetQuota}>
            Reset quota
          </button>
          <label className="field" style={{ minWidth: '9rem' }}>
            <span className="sr-only">Auto-save threshold %</span>
            <input
              type="number"
              min={1}
              max={50}
              value={Math.round(state.quotaThreshold * 100)}
              onChange={(e) =>
                setThreshold(Math.min(50, Math.max(1, Number(e.target.value) || 10)) / 100)
              }
              title="Auto-save when remaining ≤ this %"
            />
          </label>
        </div>
      </header>

      {task ? (
        <>
          <nav className="stage-rail" aria-label="Workflow stages">
            {WORKFLOW_STAGES.map((stage) => {
              const unlocked = stageUnlocked(task, stage)
              return (
                <button
                  key={stage}
                  type="button"
                  className={task.stage === stage ? 'active' : undefined}
                  disabled={!unlocked}
                  onClick={() => goStage(stage)}
                >
                  {STAGE_LABELS[stage]}
                </button>
              )
            })}
          </nav>

          <main className="main" key={task.stage}>
            <StagePanel
              task={task}
              applyTaskPatch={applyTaskPatch}
              addRole={addRole}
              removeRole={removeRole}
            />
          </main>

          <footer className="footer">
            <div className="inline-actions">
              <button
                type="button"
                className="btn"
                onClick={retreat}
                disabled={task.stage === 'intake'}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={advance}
                disabled={!canAdvanceFrom(task) || (task.stage === 'review' && task.closed)}
                title={
                  canAdvanceFrom(task) ? undefined : advanceGateHint(task)
                }
              >
                {task.stage === 'review'
                  ? task.closed
                    ? 'Closed'
                    : 'Mark closed'
                  : 'Advance'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={clearTask}>
                New task
              </button>
            </div>
            <div className="footer-meta">
              {savedFlash ??
                (state.lastSavedAt
                  ? `Saved · ${new Date(state.lastSavedAt).toLocaleTimeString()}`
                  : 'Not saved yet')}
              {extensions.length > 0
                ? ` · ${extensions.length} ext`
                : null}
            </div>
          </footer>
          {!canAdvanceFrom(task) && task.stage !== 'review' && (
            <p className="gate-hint">{advanceGateHint(task)}</p>
          )}
          {task.stage === 'review' && !canAdvanceFrom(task) && (
            <p className="gate-hint">{advanceGateHint(task)}</p>
          )}
        </>
      ) : (
        <main className="main empty">
          <h2>Start a workflow</h2>
          <p>
            One task at a time. Capture the brief, divide roles, ship
            artifacts, then close the loop in review.
          </p>
          <button type="button" className="btn btn-primary" onClick={startTask}>
            New task
          </button>
        </main>
      )}
    </div>
  )
}

function StagePanel({
  task,
  applyTaskPatch,
  addRole,
  removeRole,
}: {
  task: ProjectTask
  applyTaskPatch: (patch: Partial<ProjectTask>) => void
  addRole: (role: { name: string; focus: string }) => void
  removeRole: (id: string) => void
}) {
  switch (task.stage) {
    case 'intake':
      return <IntakePanel task={task} applyTaskPatch={applyTaskPatch} />
    case 'assign':
      return (
        <AssignPanel
          task={task}
          applyTaskPatch={applyTaskPatch}
          addRole={addRole}
          removeRole={removeRole}
        />
      )
    case 'complete':
      return <CompletePanel task={task} applyTaskPatch={applyTaskPatch} />
    case 'review':
      return <ReviewPanel task={task} applyTaskPatch={applyTaskPatch} />
    default:
      return null
  }
}

function IntakePanel({
  task,
  applyTaskPatch,
}: {
  task: ProjectTask
  applyTaskPatch: (patch: Partial<ProjectTask>) => void
}) {
  const acceptanceText = useMemo(
    () => task.acceptance.join('\n'),
    [task.acceptance],
  )

  return (
    <section className="panel">
      <h2>Intake</h2>
      <p className="lead">Capture the goal and what “done” means.</p>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={task.title}
          onChange={(e) => applyTaskPatch({ title: e.target.value })}
          placeholder="Ship Agent Console MVP"
        />
      </div>
      <div className="field">
        <label htmlFor="brief">Brief</label>
        <textarea
          id="brief"
          value={task.brief}
          onChange={(e) => applyTaskPatch({ brief: e.target.value })}
          placeholder="One short paragraph for the team"
        />
      </div>
      <div className="field">
        <label htmlFor="acceptance">Acceptance (one per line)</label>
        <textarea
          id="acceptance"
          value={acceptanceText}
          onChange={(e) =>
            applyTaskPatch({ acceptance: parseAcceptance(e.target.value) })
          }
          placeholder={'Dev server runs\nFour-stage flow works\nQuota auto-save demos'}
        />
      </div>
    </section>
  )
}

function AssignPanel({
  task,
  applyTaskPatch,
  addRole,
  removeRole,
}: {
  task: ProjectTask
  applyTaskPatch: (patch: Partial<ProjectTask>) => void
  addRole: (role: { name: string; focus: string }) => void
  removeRole: (id: string) => void
}) {
  const [custom, setCustom] = useState('')

  return (
    <section className="panel">
      <h2>Assign</h2>
      <p className="lead">Divide work across roles or sub-agents.</p>
      <div className="chip-row">
        {PRESET_ROLES.map((name) => {
          const active = task.roles.some((r) => r.name === name)
          return (
            <button
              key={name}
              type="button"
              className={`chip${active ? ' active' : ''}`}
              onClick={() => {
                if (active) {
                  const hit = task.roles.find((r) => r.name === name)
                  if (hit) removeRole(hit.id)
                } else {
                  addRole({ name, focus: `${name} track` })
                }
              }}
            >
              {name}
            </button>
          )
        })}
      </div>
      <div className="inline-actions">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="custom-role">Custom role</label>
          <input
            id="custom-role"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Researcher"
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!custom.trim()) return
            addRole({ name: custom.trim(), focus: 'Custom track' })
            setCustom('')
          }}
        >
          Add
        </button>
      </div>
      <ul className="list">
        {task.roles.map((role) => (
          <li key={role.id}>
            <span>
              <strong>{role.name}</strong>
              <br />
              <small style={{ color: 'var(--ink-muted)' }}>{role.focus}</small>
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => removeRole(role.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="model-note">Model / routing note (optional)</label>
        <input
          id="model-note"
          value={task.modelNote}
          onChange={(e) => applyTaskPatch({ modelNote: e.target.value })}
          placeholder="Builder on Composer, Reviewer on GPT"
        />
      </div>
    </section>
  )
}

function CompletePanel({
  task,
  applyTaskPatch,
}: {
  task: ProjectTask
  applyTaskPatch: (patch: Partial<ProjectTask>) => void
}) {
  const [note, setNote] = useState('')

  return (
    <section className="panel">
      <h2>Complete</h2>
      <p className="lead">Track status and capture artifacts as you finish work.</p>
      <div className="inline-actions">
        <button
          type="button"
          className={`chip${task.status === 'working' ? ' active' : ''}`}
          onClick={() => applyTaskPatch({ status: 'working' })}
        >
          Working
        </button>
        <button
          type="button"
          className={`chip${task.status === 'done' ? ' active' : ''}`}
          onClick={() => applyTaskPatch({ status: 'done' })}
        >
          Done
        </button>
      </div>
      <div className="inline-actions">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="artifact">Artifact (link / path / note)</label>
          <input
            id="artifact"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="dist/report.md or https://…"
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!note.trim()) return
            applyTaskPatch({
              artifacts: [
                ...task.artifacts,
                { id: crypto.randomUUID(), note: note.trim() },
              ],
              noArtifact: false,
            })
            setNote('')
          }}
        >
          Add
        </button>
      </div>
      <ul className="list">
        {task.artifacts.map((item) => (
          <li key={item.id}>
            <span>{item.note}</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                applyTaskPatch({
                  artifacts: task.artifacts.filter((a) => a.id !== item.id),
                })
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className="check-row">
        <input
          type="checkbox"
          checked={task.noArtifact}
          onChange={(e) =>
            applyTaskPatch({
              noArtifact: e.target.checked,
            })
          }
        />
        <span>No artifact for this pass</span>
      </label>
    </section>
  )
}

function ReviewPanel({
  task,
  applyTaskPatch,
}: {
  task: ProjectTask
  applyTaskPatch: (patch: Partial<ProjectTask>) => void
}) {
  return (
    <section className="panel">
      <h2>Review</h2>
      <p className="lead">Retrospective checklist and closing notes.</p>
      <ul className="list">
        {task.checklist.map((item) => (
          <li key={item.id}>
            <label className="check-row">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) =>
                  applyTaskPatch({
                    checklist: task.checklist.map((c) =>
                      c.id === item.id
                        ? { ...c, done: e.target.checked }
                        : c,
                    ),
                  })
                }
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="retro">Notes</label>
        <textarea
          id="retro"
          value={task.retrospectiveNotes}
          onChange={(e) =>
            applyTaskPatch({ retrospectiveNotes: e.target.value })
          }
          placeholder="What to keep, change, or hand off"
        />
      </div>
      {task.closed && (
        <p className="lead" style={{ color: 'var(--accent)' }}>
          Closed.
        </p>
      )}
    </section>
  )
}
