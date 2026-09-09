'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Monitor,
  History,
  Users,
  LogOut,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
export function Shell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { nombre: string; rol: string } | null;
}) {
  const pathname = usePathname();
  const admin = user?.rol === 'admin';
  const links = [
    { href: '/', label: 'Inventario de equipos', icon: Monitor },
    ...(admin
      ? [
          { href: '/admin', label: 'Administración', icon: LayoutDashboard },
          { href: '/admin/movimientos', label: 'Bitácora de cambios', icon: History },
          { href: '/admin/usuarios', label: 'Usuarios y accesos', icon: Users },
        ]
      : []),
  ];
  return (
    <>
      <header className="header">
        <Link href="/" className="brand">
          <img src="/sena-principal.png" alt="SENA" />
          <div className="brand-title">
            Hoja de Vida Equipos SENA<small>Gestión del inventario institucional</small>
          </div>
        </Link>
        {user ? (
          <div className="account">
            <div className="avatar">{user.nombre.slice(0, 2).toUpperCase()}</div>
            <div className="identity">
              <div className="text-sm font-medium">{user.nombre}</div>
              <small>{admin ? 'Administrador' : 'Consulta'}</small>
            </div>
            <button
              className="icon-button"
              onClick={() => signOut({ callbackUrl: '/' })}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={17} />
            </button>
          </div>
        ) : (
          <span className="badge gray">Consulta pública</span>
        )}
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="nav-caption">Gestión de equipos</div>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname === href || (href === '/' && pathname.startsWith('/equipos')) ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <div className="sidebar-bottom">
            <ShieldCheck size={23} className="mb-3 text-forest" />
            {user ? 'Acceso institucional protegido' : 'Inventario de consulta pública'}
            <br />
            Servicio Nacional de Aprendizaje
            <br />
            <span className="text-[#007832]">SENA · 2026</span>
          </div>
        </aside>
        <main className="main">
          <div className="breadcrumbs">
            <span>SENA</span>
            <ChevronRight size={13} />
            <span>
              {pathname.startsWith('/admin') ? 'Administración' : 'Inventario de equipos'}
            </span>
          </div>
          {children}
          {!user && (
            <section className="panel mt-8" aria-label="Acceso de administración">
              <div className="panel-body flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2>Administración de equipos</h2>
                  <p className="muted text-sm mt-2">
                    Ingresa para editar la información y generar la hoja de vida en Excel.
                  </p>
                </div>
                <Link href="/login" className="button">
                  <ShieldCheck size={18} />
                  Entrar como administrador
                </Link>
              </div>
            </section>
          )}
          <footer className="footer">
            <span>Servicio Nacional de Aprendizaje SENA</span>
            <span>Formato GTI-F-132 · Versión 06</span>
          </footer>
        </main>
      </div>
    </>
  );
}
