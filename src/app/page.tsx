import { MapView } from "../components/map/MapView";
import { Button } from "../components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-violet-500/25">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Χάρτης Συνεργατών
            </span>

            {/* Heading */}
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
              Βρες τα{" "}
              <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 bg-clip-text text-transparent">
                καταστήματα
              </span>{" "}
              που δέχονται Up Hellas
            </h1>

            {/* Subheading */}
            <p className="mt-5 max-w-2xl text-lg text-slate-600 md:text-xl">
              Πάνω από 50.000 συνεργαζόμενα σημεία σε όλη την Ελλάδα. 
              Σίτιση, ευεξία, αγορές — όλα σε μία κάρτα.
            </p>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-8 md:gap-12">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 md:text-4xl">50K+</p>
                <p className="mt-1 text-sm font-medium text-slate-500">Καταστήματα</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 md:text-4xl">300K+</p>
                <p className="mt-1 text-sm font-medium text-slate-500">Δικαιούχοι</p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900 md:text-4xl">6K+</p>
                <p className="mt-1 text-sm font-medium text-slate-500">Πελάτες</p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="https://uphellas.gr" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="lg">
                  Μάθε περισσότερα →
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6 md:pb-24">
        <MapView />
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-400 shadow-lg shadow-orange-500/25">
                <span className="text-lg font-bold text-white">U</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Up Hellas</p>
                <p className="text-xs text-slate-500">Εταιρικές Παροχές</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://uphellas.gr" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-orange-500 transition-colors">
                uphellas.gr
              </a>
              <a href="https://uphellas.gr/epikoinonia" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-orange-500 transition-colors">
                Επικοινωνία
              </a>
              <a href="https://uphellas.gr/faq" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-orange-500 transition-colors">
                FAQ
              </a>
            </div>
            <p className="text-xs text-slate-400">
              © 2026 Up Hellas. Όλα τα δικαιώματα διατηρούνται.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

