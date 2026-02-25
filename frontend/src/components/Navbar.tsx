"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";

export function Navbar() {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/upload", label: "Segmenter" },
    { href: "/pricing", label: "Tarifs" },
  ];

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 z-50 w-full border-b border-red-900/40 bg-gray-900/95 backdrop-blur-xl shadow-lg shadow-red-950/10"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
          <motion.span
            className="text-red-500"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ♥
          </motion.span>
          <span>CardioSeg</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm transition-colors ${
                pathname === link.href
                  ? "text-white font-medium"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {link.label}
              {pathname === link.href && (
                <motion.div
                  layoutId="navbar-indicator"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          ))}
          {!loading && user ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 hidden sm:inline">
                {user.email}
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signOut()}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
              >
                Déconnexion
              </motion.button>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/auth"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Connexion
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
