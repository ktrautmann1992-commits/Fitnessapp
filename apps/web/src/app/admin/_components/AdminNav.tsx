import Link from 'next/link';

import styles from '../admin.module.css';

export type AdminSection =
  'training' | 'rezepte' | 'lebensmittel' | 'meal-prep' | 'ratgeber' | 'austausch';

const SECTIONS: readonly { id: AdminSection; href: string; label: string }[] = [
  { id: 'training', href: '/admin', label: 'Training' },
  { id: 'rezepte', href: '/admin/rezepte', label: 'Rezepte' },
  { id: 'lebensmittel', href: '/admin/lebensmittel', label: 'Lebensmittel' },
  { id: 'meal-prep', href: '/admin/meal-prep', label: 'Meal-Prep' },
  { id: 'ratgeber', href: '/admin/ratgeber', label: 'Ratgeber' },
  { id: 'austausch', href: '/admin/austausch', label: 'Austausch' },
];

/** Bereiche des Redaktionsbereichs (Training: Übungen/Vorlagen; Ernährung seit Etappe N2d). */
export function AdminNav({ current }: { current: AdminSection }) {
  return (
    <nav className={styles.nav} aria-label="Bereiche">
      {SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          className={section.id === current ? styles.navLinkActive : styles.navLink}
          aria-current={section.id === current ? 'page' : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
