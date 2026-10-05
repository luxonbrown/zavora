import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, Menu, X } from 'lucide-react';

import { Mark as LogoMark } from '../brand/Logo.jsx';
import { cx } from '../../utils/format.js';

/**
 * Reference B shell: a near-black sidebar framing a white rounded canvas.
 *
 * Shared by the customer dashboard and (from step 15) the admin, so the two
 * can never drift apart. `groups` renders the collapsible "Sales channels" /
 * "Apps" sections; the customer dashboard passes none, which is what makes it
 * feel lighter than the admin.
 */
function NavItems({ items, collapsed, onNavigate }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cx(
                'group flex h-9 items-center rounded-lg text-[14px] transition-colors duration-150',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? 'bg-brand-gradient text-paper'
                  : 'text-muted-on-dark hover:bg-white/10 hover:text-paper'
              )
            }
          >
            <item.icon className="size-[17px] shrink-0" strokeWidth={1.6} aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}

            {!collapsed && item.badge ? (
              <span className="tnum ml-auto grid min-w-5 place-items-center rounded-full bg-paper/15 px-1.5 text-[11px] leading-4 font-medium text-paper">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SidebarBody({ nav, groups, footer, collapsed, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Section" className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems items={nav} collapsed={collapsed} onNavigate={onNavigate} />

        {groups?.map((group) => (
          <div key={group.label} className="mt-6">
            <p
              className={cx(
                't-caption px-3 font-medium text-paper/35',
                collapsed && 'text-center px-0'
              )}
            >
              {collapsed ? '···' : group.label}
            </p>
            <div className="mt-2">
              <NavItems items={group.items} collapsed={collapsed} onNavigate={onNavigate} />
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-paper/10 p-3">{footer}</div>
    </div>
  );
}

export default function DashboardShell({
  nav = [],
  groups,
  footer,
  header,
  children,
  ariaLabel = 'Dashboard',
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-navy">
      {/* Desktop sidebar */}
      <aside
        className={cx(
          'hidden shrink-0 flex-col transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[68px]' : 'w-[220px]'
        )}
      >
        <div
          className={cx(
            'flex h-16 shrink-0 items-center border-b border-paper/10',
            collapsed ? 'justify-center px-2' : 'gap-2 px-4'
          )}
        >
          <NavLink
            to="/"
            aria-label="MARKETHUB — home"
            className={cx('shrink-0', collapsed ? '' : 'mr-auto')}
          >
            <LogoMark tone="light" size={26} />
            {!collapsed ? (
              <span className="wordmark ml-2 text-[15px] leading-none text-paper">MarketHub</span>
            ) : null}
          </NavLink>

          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="grid size-8 place-items-center rounded-lg text-muted-on-dark transition-colors duration-150 hover:bg-white/10 hover:text-paper"
            >
              <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1">
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="mx-auto mt-3 grid size-9 place-items-center rounded-lg text-muted-on-dark transition-colors duration-150 hover:bg-white/10 hover:text-paper"
            >
              <Menu className="size-4" strokeWidth={1.8} aria-hidden />
            </button>
          ) : null}

          <SidebarBody
            nav={nav}
            groups={groups}
            footer={footer}
            collapsed={collapsed}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-100 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <div className="page-rise absolute inset-y-0 left-0 flex w-[272px] flex-col bg-navy">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-paper/10 px-4">
              <span className="flex items-center gap-2">
                <LogoMark tone="light" size={24} />
                <span className="wordmark text-[14px] leading-none text-paper">MarketHub</span>
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center rounded-lg text-muted-on-dark transition-colors duration-150 hover:bg-white/10 hover:text-paper"
              >
                <X className="size-4" strokeWidth={1.8} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarBody
                nav={nav}
                groups={groups}
                footer={footer}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Canvas */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-surface-muted"
          >
            <Menu className="size-5" strokeWidth={1.6} aria-hidden />
          </button>
          <span className="flex items-center gap-2">
            <LogoMark tone="dark" size={24} />
            <span className="wordmark text-[14px] leading-none text-ink">MarketHub</span>
          </span>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-tl-[20px] bg-paper"
          aria-label={ariaLabel}
        >
          {header}
          {children}
        </div>
      </div>
    </div>
  );
}