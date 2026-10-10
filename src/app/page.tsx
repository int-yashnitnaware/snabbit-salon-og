import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Snabbit Salon OG</h1>
        <p className="text-gray-500 text-sm">Pick a view to preview</p>
        <div className="space-y-3">
          <Link
            href="/staff"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Staff View
          </Link>
          <Link
            href="/staff/team"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Team Lead View
          </Link>
          <Link
            href="/admin"
            className="block bg-brand text-white rounded-xl py-3 font-semibold hover:bg-brand-dark"
          >
            Manager Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
