import styles from './admin.module.css';

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className={styles.center}>
      <div className={styles.spinner} aria-hidden />
      <p className={styles.muted}>Inhalte werden geladen …</p>
    </div>
  );
}
