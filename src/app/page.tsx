import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Caisse Noire
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gestion de la caisse collective de votre équipe.
          </p>
        </header>
        <div className="grid gap-3">
          <Link
            href="/membre/login"
            className="flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Espace membre
          </Link>
          <Link
            href="/login"
            className="flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Espace administrateur
          </Link>
        </div>
      </div>
    </main>
  );
}
