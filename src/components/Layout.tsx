import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Calendar, Droplets, LogIn, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { signOutUser } from '../lib/auth'
import { ToastContainer } from './ToastContainer'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Droplets },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOutUser()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-cyan/10 text-cyan'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ backgroundColor: '#0a0f1e' }}>
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-slate-800 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2">
          <Droplets className="text-cyan" style={{ color: '#00d4ff' }} size={28} />
          <span className="text-lg font-bold text-white">AquaWatch PH</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-4">
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <LogOut size={18} />
              Sign out
            </button>
          ) : (
            <NavLink to="/login" className={linkClass}>
              <LogIn size={18} />
              Sign in
            </NavLink>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 pb-20 md:p-8 md:pb-8">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-slate-800 bg-[#0a0f1e] p-2 md:hidden"
        style={{ backgroundColor: '#0a0f1e' }}
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-4 py-2 text-xs ${
                isActive ? 'text-cyan' : 'text-slate-400'
              }`
            }
            style={({ isActive }) => ({ color: isActive ? '#00d4ff' : undefined })}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      <ToastContainer />
    </div>
  )
}
