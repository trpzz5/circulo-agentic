import './sidebar.css'

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Command Center',
    code: '01',
  },
  {
    id: 'analysis-input',
    label: 'Analysis Input',
    code: '02',
  },
  {
    id: 'decision',
    label: 'Decision',
    code: '03',
  },
  {
    id: 'network',
    label: 'Industrial Network',
    code: '04',
  },
  {
    id: 'what-if',
    label: 'What-If',
    code: '05',
  },
  {
    id: 'memory',
    label: 'Memory',
    code: '06',
  },
  {
    id: 'factories',
    label: 'Factories',
    code: '07',
  },
]

function scrollToSection(id) {
  const element = document.getElementById(id)

  if (!element) {
    return
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">
          <span />
          <span />
          <span />
        </div>

        <div className="sidebar__brand-copy">
          <strong>CIRCULO</strong>
          <span className="mono">
            INDUSTRIAL INTELLIGENCE
          </span>
        </div>
      </div>

      <div className="sidebar__system">
        <span className="sidebar__system-dot" />

        <div>
          <span className="sidebar__system-label mono">
            SYSTEM
          </span>
          <span className="sidebar__system-value">
            COMMAND MODE
          </span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        <div className="sidebar__nav-heading mono">
          NAVIGATION
        </div>

        <div className="sidebar__nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sidebar__nav-item"
              onClick={() => scrollToSection(item.id)}
            >
              <span className="sidebar__nav-code mono">
                {item.code}
              </span>

              <span className="sidebar__nav-label">
                {item.label}
              </span>

              <span
                className="sidebar__nav-arrow"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-line" />

        <div className="sidebar__footer-meta">
          <span className="mono">
            CIRCULO ENGINE
          </span>

          <span className="mono">
            v1.0
          </span>
        </div>

        <div className="sidebar__footer-caption">
          Agentic industrial symbiosis
          <br />
          decision infrastructure
        </div>
      </div>
    </aside>
  )
}