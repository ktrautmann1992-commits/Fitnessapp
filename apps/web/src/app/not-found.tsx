import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: 24, textAlign: 'center' }}>
      <h1>Diese Seite gibt es nicht.</h1>
      <Link href="/">Zur Startseite</Link>
    </main>
  );
}
