import type {
  SkillLockReason,
  SkillPathId,
  SkillStageRole,
  SuspensionPosition,
} from '@fitnessapp/core';

/**
 * Texte zu Calisthenics (Skill-Pfade), Schlingentrainer und Lauf-Kraft (docs/PLAN-CALISTHENICS-SCHLINGE.md).
 * Regeln: neutral und privat – keine Abzeichen, keine Ranglisten, kein Teilen, keine Heilversprechen; „freigeschaltet“
 * ist ein Vorschlag, nie ein Zwang.
 */
export const deCalisthenics = {
  skills: {
    title: 'Skill-Pfade',
    intro:
      'Calisthenics in Stufen: Gelingt das Ziel einer Stufe in zwei Einheiten hintereinander sauber, ist die nächste Stufe freigeschaltet. Wann du wechselst, entscheidest du.',
    clean:
      '„Sauber“ heißt: alle Ziel-Sätze geschafft und – wenn du die Anstrengung einträgst – höchstens RPE 8, also mindestens 2 Wiederholungen Reserve.',
    privacy: 'Nur für dich: keine Abzeichen, keine Ranglisten, nichts wird geteilt.',
    groups: {
      basics: 'Grundlagen',
      skills: 'Skills für Fortgeschrittene',
    },
    paths: {
      klimmzug: 'Klimmzug',
      rudern: 'Rudern',
      dips: 'Dips',
      liegestuetz: 'Liegestütz',
      kniebeuge: 'Kniebeuge',
      rumpf: 'Rumpf: Hollow Body bis L-Sitz',
      handstand: 'Handstand',
      muscle_up: 'Muscle-up',
      front_lever: 'Front Lever',
      back_lever: 'Back Lever',
    } satisfies Record<SkillPathId, string>,
    roles: {
      done: 'geübt',
      current: 'aktuelle Stufe',
      next: 'nächste Stufe',
      later: 'später',
    } satisfies Record<SkillStageRole, string>,
    stageOf: (n: number, total: number) => `Stufe ${n} von ${total}`,
    target: (sets: number, reps: number | null, seconds: number | null) =>
      seconds !== null
        ? `Ziel: ${sets} × ${seconds} s halten`
        : `Ziel: ${sets} × ${reps ?? 0} sauber`,
    current: (name: string) => `Aktuell: ${name}`,
    notStarted: 'Noch nicht begonnen – fang mit der ersten Stufe an.',
    currentLocked: 'Dieser Pfad ist für dich noch gesperrt – die Gründe stehen bei der Stufe.',
    toGo: (n: number) =>
      n === 1
        ? 'Noch 1 saubere Einheit bis zur nächsten Stufe.'
        : `Noch ${n} saubere Einheiten bis zur nächsten Stufe.`,
    suggestion: {
      advance: (name: string) => `Nächste Stufe freigeschaltet: ${name}`,
      blocked: 'Ziel erreicht. Die nächste Stufe ist für dich noch gesperrt – Gründe stehen dabei.',
      mastered: 'Letzte Stufe dieses Pfads sauber geschafft.',
      regress: (name: string) =>
        `Tipp: Übe eine Weile die vorige Stufe (${name}) und komm dann zurück.`,
    },
    locks: {
      missing_content: 'Übung noch nicht verfügbar',
      safety_rules: 'Nach deinen Plan-Regeln nicht vorgesehen',
      age: 'Ab 65 Jahren bzw. beim Ziel „Fit im Alter“ nicht vorgesehen',
      experience: 'Erst für Fortgeschrittene',
      health_check: 'Nach deinem Gesundheits-Check nicht vorgesehen',
      pain: 'Gerade im Schon-Modus gesperrt',
      requirement: 'Voraussetzungen fehlen noch',
      equipment: 'Gerät fehlt (z. B. Stange, Barren oder Ringe)',
    } satisfies Record<SkillLockReason, string>,
    requirement: (name: string, best: number, reps: number) =>
      `${name}: ${best} von ${reps} sauberen Wiederholungen in einem Satz`,
    lockedA11y: (name: string, reasons: string) => `${name}, gesperrt: ${reasons}`,
    stageA11y: (n: number, total: number, name: string, role: string) =>
      `Stufe ${n} von ${total}: ${name}, ${role}`,
    guide: 'Anleitung',
    empty: 'Für die Skill-Pfade fehlen noch Calisthenics-Übungen. Sie kommen bald.',
    loadError: 'Die Übungen konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
    entry: 'Skill-Pfade',
    entryDetail: 'Calisthenics-Stufen: aktuelle Stufe und nächstes Ziel',
  },
  /** Hinweis im Training (neutral, keine Abzeichen). */
  hint: {
    unlocked: (name: string) => `Nächste Stufe freigeschaltet: ${name}`,
    unlockedDetail:
      'Wenn du magst, wählst du sie beim nächsten Training über „Tauschen“. Alle Stufen findest du unter „Skill-Pfade“.',
    stepBack: (name: string) => `Tipp: Übe eine Weile die vorige Stufe – ${name}.`,
    open: 'Skill-Pfade ansehen',
  },
  runStrength: {
    title: (minutes: number) => `Lauf-Kraft danach (${minutes} min)`,
    intro: 'Direkt nach dem lockeren Lauf, solange die Muskeln warm sind.',
    gentle: 'Sanfte Fassung ohne Sprünge (Einstiegs- oder Erholungswoche).',
    dropped: 'Einige Übungen entfallen heute (Schon-Modus oder Plan-Regeln).',
    item: (name: string, dose: string) => `${name} – ${dose}`,
    reps: (n: number) => `${n} Wdh.`,
    seconds: (n: number) => `${n} s`,
    rounds: (n: number) => `${n} Runden`,
    open: 'Einheit mit Timer öffnen',
  },
  sling: {
    title: 'Schwierigkeit über den Körperwinkel',
    positions: {
      facing_anchor:
        'Gesicht zum Anker: Füße weiter nach vorn (unter den Anker) = schwerer, weiter zurück = leichter.',
      facing_away:
        'Rücken zum Anker: Füße weiter nach hinten (Körper flacher) = schwerer, näher zum Anker = leichter.',
      feet_in_straps:
        'Füße in den Schlaufen: Hände weiter vom Ankerpunkt weg = schwerer; Schlaufen etwa 30 cm über dem Boden.',
      supine_heels: 'Rückenlage: Beine gestreckter oder einbeinig = schwerer.',
      assisted: 'Weniger mit den Armen ziehen = schwerer.',
    } satisfies Record<SuspensionPosition, string>,
    angle: (easy: number, hard: number) =>
      `Körperneigung etwa ${easy}° (leicht) bis ${hard}° (schwer) gegen die Senkrechte.`,
    anchor:
      'Anker sicher befestigen: an der Tür nur auf der Seite, zu der sich die Tür schließt, und die Tür abschließen. Belastung vor dem ersten Satz vorsichtig testen.',
  },
  travel: {
    suspensionReady:
      'Die App stellt deine Einheiten auf Schlingentrainer-Übungen um. Anker sicher befestigen (an der Tür auf der Seite, zu der sie sich schließt) und Belastung vorher testen.',
    parkNote:
      'Im Calisthenics-Park nutzt die App Klimmzugstange und Barren; was dort nicht geht, wird gegen Übungen ohne Geräte getauscht.',
  },
} as const;
