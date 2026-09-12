import { useEffect, useState } from 'react'
import './Sidebar.css'

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '⌂',
    target: 'dashboard',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: '⌁',
    target: 'analysis-input',
  },
  {
    id: 'simulate',
    label: 'Simulate',
    icon: '◈',
    target: 'what-if',
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: '◇',
    target: 'memory',
  },
  {
    id: 'factories',
    label: 'Factories',
    icon: '▦',
    target: 'network',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '▤',
    target: 'decision',
  },
]

function scrollToTarget(target) {
  if (target === 'dashboard') {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })

    return
  }

  const element = document.getElementById(target)

  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
}

export default function Sidebar() {
  const [active, setActive] = useState('dashboard')

  useEffect(() => {
    const sections = NAV_ITEMS
      .map((item) => document.getElementById(item.target))
      .filter(Boolean)

    if (!sections.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio,
          )

        if (visible[0]) {
          const found = NAV_ITEMS.find(
            (item) => item.target === visible[0].target.id,
          )

          if (found) {
            setActive(found.id)
          }
        }
      },
      {
        root: null,
        threshold: [0.15, 0.35, 0.6],
        rootMargin: '-15% 0px -55% 0px',
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  function handleNavigation(item) {
    setActive(item.id)
    scrollToTarget(item.target)
  }

  return (
    <aside className="circulo-sidebar">
      <div className="circulo-sidebar__brand">
        <div className="circulo-sidebar__logo">
          ◉
        </div>

        <div>
          <div className="circulo-sidebar__name">
            CIRCULO
          </div>

          <div className="circulo-sidebar__subtitle">
            INDUSTRIAL SYMBIOSIS
          </div>
        </div>
      </div>

      <div className="circulo-sidebar__divider" />

      <nav className="circulo-sidebar__nav">
        <div className="circulo-sidebar__section-label">
          WORKSPACE
        </div>

        {NAV_ITEMS.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              'circulo-nav-item',
              active === item.id
                ? 'circulo-nav-item--active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleNavigation(item)}
          >
            <span className="circulo-nav-item__icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </button>
        ))}

        <div className="circulo-sidebar__section-label circulo-sidebar__section-label--system">
          SYSTEM
        </div>

        {NAV_ITEMS.slice(3).map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              'circulo-nav-item',
              active === item.id
                ? 'circulo-nav-item--active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleNavigation(item)}
          >
            <span className="circulo-nav-item__icon">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="circulo-sidebar__footer">
        <div className="circulo-sidebar__status">
          <span className="circulo-sidebar__status-dot" />
          <span>Engine Online</span>
        </div>

        <div className="circulo-sidebar__version">
          CIRCULO v1.0
        </div>
      </div>
    </aside>
  )
}