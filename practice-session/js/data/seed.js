/**
 * seed.js — Session seed data for the Practice Session prototype.
 *
 * SESSION_DATA is built dynamically when a `classbank_session_config` key
 * is present in sessionStorage (written by practice-setup). When no config
 * is found the hardcoded FALLBACK_DATA below is used instead, which keeps
 * the direct file:// open of practice-session working unchanged.
 *
 * Pre-seeded FALLBACK states:
 *   Q1 (single_best)   — fresh / unanswered
 *   Q2 (multi_select)  — bookmarked, fresh
 *   Q3 (short_answer)  — skipped
 *   Q4 (true_false)    — flagged, pre-revealed as correct
 *   Q5 (single_best)   — pre-revealed as incorrect
 */

import { COURSE_DATA } from './course-data.js';

const FALLBACK_DATA = {
  sessionId:   'session-proto-001',
  courseLabel: 'ECE 420 — Parallel & Distributed Programming',
  topicLabel:  'Processes & Threads · Race Conditions',
  modeLabel:   'Free Practice',

  questions: [
    // -----------------------------------------------------------------------
    // Q1 — Single Best Answer  (unanswered on load)
    // -----------------------------------------------------------------------
    {
      questionId:   'q-race-001',
      questionType: 'single_best',
      stem: `<p>Which statement <strong>best</strong> describes a <strong>race condition</strong>?</p>`,
      choices: [
        {
          choiceId: 'q-race-001-a',
          label:    'A',
          html:     `<p>A race condition occurs when two threads execute in parallel, regardless of whether they access shared memory.</p>`,
          isCorrect: false,
          explanationHtml: `<p>Parallel execution alone is not sufficient. A race condition requires <em>timing-sensitive access to shared mutable state</em>. Threads can run in parallel without ever producing a race.</p>`,
        },
        {
          choiceId: 'q-race-001-b',
          label:    'B',
          html:     `<p>A race condition occurs when program output depends on the non-deterministic ordering of concurrent accesses to shared state.</p>`,
          isCorrect: true,
          explanationHtml: `<p>This is the canonical definition. The key elements are: <strong>non-determinism</strong> (ordering is not guaranteed), <strong>concurrency</strong>, and <strong>shared mutable state</strong>.</p>`,
        },
        {
          choiceId: 'q-race-001-c',
          label:    'C',
          html:     `<p>A race condition occurs only when a deadlock is present in the program.</p>`,
          isCorrect: false,
          explanationHtml: `<p>Deadlock and race conditions are distinct failure modes. A deadlock involves threads waiting on each other indefinitely; a race involves indeterminate execution order on shared state. Neither implies the other.</p>`,
        },
        {
          choiceId: 'q-race-001-d',
          label:    'D',
          html:     `<p>A race condition is limited to distributed systems where network latency introduces reordering.</p>`,
          isCorrect: false,
          explanationHtml: `<p>Race conditions occur in any concurrent setting — including multi-threaded programs on a single machine. Network latency can <em>exacerbate</em> them but is not a prerequisite.</p>`,
        },
      ],
      mainExplanationHtml: `<p>A <strong>race condition</strong> exists when the correctness of a program depends on the relative timing or interleaving of operations across two or more concurrent threads or processes accessing shared mutable state.</p>
<p>The term "race" captures the idea that threads are competing to perform reads and writes, and whichever "wins" the race determines the program's outcome — making the result non-deterministic.</p>
<p>Classic examples include a shared counter incremented by two threads without synchronization, and a check-then-act sequence (e.g., <code>if exists: delete</code>) that is not atomic.</p>`,
      referenceText: 'Lecture notes: Week 3 — Concurrency Fundamentals',
      modelAnswerHtml: null,
    },

    // -----------------------------------------------------------------------
    // Q2 — Multi-Select  (bookmarked on load, fresh)
    // -----------------------------------------------------------------------
    {
      questionId:   'q-race-002',
      questionType: 'multi_select',
      stem: `<p>Which of the following techniques can <strong>reduce or eliminate</strong> race conditions? <em>Select all that apply.</em></p>`,
      choices: [
        {
          choiceId: 'q-race-002-a',
          label:    'A',
          html:     `<p>Protect critical sections with a mutex.</p>`,
          isCorrect: true,
          explanationHtml: `<p>A mutex (mutual exclusion lock) ensures only one thread executes a critical section at a time, preventing conflicting concurrent accesses.</p>`,
        },
        {
          choiceId: 'q-race-002-b',
          label:    'B',
          html:     `<p>Prefer immutable data structures where practical.</p>`,
          isCorrect: true,
          explanationHtml: `<p>Immutable data cannot be modified after creation, so concurrent reads are safe by definition. Functional data structures lean heavily on this property.</p>`,
        },
        {
          choiceId: 'q-race-002-c',
          label:    'C',
          html:     `<p>Increase CPU clock speed to reduce the window for interleaving.</p>`,
          isCorrect: false,
          explanationHtml: `<p>Clock speed does not eliminate timing windows — it may narrow them, but concurrency hazards remain regardless of hardware speed. This is not a valid synchronization strategy.</p>`,
        },
        {
          choiceId: 'q-race-002-d',
          label:    'D',
          html:     `<p>Use atomic operations for single-variable shared state where appropriate.</p>`,
          isCorrect: true,
          explanationHtml: `<p>Atomic operations (e.g., <code>std::atomic</code> in C++, <code>sync/atomic</code> in Go) provide indivisible read-modify-write sequences, eliminating races on individual variables without a full mutex.</p>`,
        },
      ],
      mainExplanationHtml: `<p>Race conditions arise when multiple threads access shared mutable state without coordination. The primary mitigations are:</p>
<ul>
<li><strong>Mutual exclusion</strong> — serialize access to shared state via mutexes, semaphores, or critical section primitives.</li>
<li><strong>Immutability</strong> — eliminate shared mutable state by using data that cannot change after construction.</li>
<li><strong>Atomic operations</strong> — use CPU-level atomic instructions for simple shared variables to avoid the overhead of a full lock.</li>
</ul>
<p>Hardware speed (choice C) has no bearing on correctness: a race window of nanoseconds is still a race.</p>`,
      referenceText: 'Lecture notes: Week 4 — Locks and Synchronization Primitives',
      modelAnswerHtml: null,
    },

    // -----------------------------------------------------------------------
    // Q3 — Short Answer  (skipped on load)
    // -----------------------------------------------------------------------
    {
      questionId:   'q-race-003',
      questionType: 'short_answer',
      stem: `<p>Define a <strong>critical section</strong> in the context of concurrent programming. Include what property it must enforce and why.</p>`,
      choices: [],
      mainExplanationHtml: `<p>A <strong>critical section</strong> is a segment of code that accesses one or more shared resources (typically shared memory) and which must not be executed by more than one thread simultaneously.</p>
<p>The property it enforces is <strong>mutual exclusion</strong>: at most one thread may be executing inside the critical section at any given instant. This prevents data corruption from concurrent, unsynchronized reads and writes.</p>
<p>Additional desired properties for a well-designed critical section protocol:</p>
<ul>
<li><strong>Progress</strong> — if no thread is in the critical section, a thread that wishes to enter must eventually be allowed to do so.</li>
<li><strong>Bounded waiting</strong> — there is an upper bound on how many times other threads can enter the critical section before a waiting thread gets its turn (prevents starvation).</li>
</ul>`,
      referenceText: 'Lecture notes: Week 3 — Critical Sections and Mutual Exclusion',
      modelAnswerHtml: `<p>A critical section is a portion of code that accesses shared state and must not be executed by more than one thread or process concurrently. It must enforce <strong>mutual exclusion</strong> to prevent data races. A proper implementation also ensures <strong>progress</strong> (a willing thread eventually enters) and <strong>bounded waiting</strong> (no thread waits indefinitely).</p>`,
    },

    // -----------------------------------------------------------------------
    // Q4 — True/False  (flagged, pre-revealed as correct)
    // -----------------------------------------------------------------------
    {
      questionId:   'q-thread-001',
      questionType: 'true_false',
      stem: `<p><strong>True or False:</strong> Threads within the same process generally share the same virtual address space, including heap and global variables, while maintaining separate stacks and register sets.</p>`,
      choices: [
        {
          choiceId: 'q-thread-001-a',
          label:    'A',
          html:     `<p>True</p>`,
          isCorrect: true,
          explanationHtml: `<p>Correct. The OS creates one virtual address space per process. All threads in that process see the same heap, code segment, and globals. Each thread maintains its own stack (for local variables and the call chain) and register set (for CPU state during a context switch).</p>`,
        },
        {
          choiceId: 'q-thread-001-b',
          label:    'B',
          html:     `<p>False</p>`,
          isCorrect: false,
          explanationHtml: `<p>Incorrect. Separate address spaces are a process-level boundary, not a thread-level one. Threads are specifically designed as lightweight units of execution that share memory, which is both their advantage (cheap communication) and their hazard (race conditions).</p>`,
        },
      ],
      mainExplanationHtml: `<p>A thread is the minimum unit of CPU scheduling. The OS associates one <em>virtual address space</em> with each process; every thread in that process shares that space.</p>
<p><strong>Shared between threads:</strong> heap, code (text) segment, global/static variables, file descriptors, and signal handlers.</p>
<p><strong>Private per thread:</strong> stack, stack pointer, program counter, general-purpose registers, and thread-local storage (TLS).</p>
<p>This design makes inter-thread communication cheap (no IPC needed) but requires explicit synchronization to avoid races on shared data.</p>`,
      referenceText: 'Lecture notes: Week 2 — Processes vs. Threads',
      modelAnswerHtml: null,
    },

    // -----------------------------------------------------------------------
    // Q5 — Single Best Answer  (pre-revealed as incorrect)
    // -----------------------------------------------------------------------
    {
      questionId:   'q-lock-001',
      questionType: 'single_best',
      stem: `<p>A <strong>mutex</strong> is acquired by Thread A. Thread B attempts to acquire the same mutex. Which of the following best describes what happens to Thread B?</p>`,
      choices: [
        {
          choiceId: 'q-lock-001-a',
          label:    'A',
          html:     `<p>Thread B raises an exception and terminates immediately.</p>`,
          isCorrect: false,
          explanationHtml: `<p>Attempting to acquire a held mutex does not cause an exception in standard usage. Exceptions are associated with error conditions such as acquiring a non-existent mutex or attempting to lock a mutex you already own (in non-recursive implementations).</p>`,
        },
        {
          choiceId: 'q-lock-001-b',
          label:    'B',
          html:     `<p>Thread B is blocked and placed in the mutex's wait queue until Thread A releases it.</p>`,
          isCorrect: true,
          explanationHtml: `<p>This is the standard behavior. When a mutex is contended, the requesting thread is de-scheduled and placed in a wait queue associated with that mutex. The OS scheduler will unpark it once the mutex becomes available.</p>`,
        },
        {
          choiceId: 'q-lock-001-c',
          label:    'C',
          html:     `<p>Thread B acquires a second, distinct copy of the mutex and proceeds independently.</p>`,
          isCorrect: false,
          explanationHtml: `<p>A mutex is a single shared object. There is no concept of acquiring a "copy." If copies existed, mutual exclusion would be broken — both threads would be executing the critical section simultaneously.</p>`,
        },
        {
          choiceId: 'q-lock-001-d',
          label:    'D',
          html:     `<p>Thread B skips the critical section and continues execution without acquiring the mutex.</p>`,
          isCorrect: false,
          explanationHtml: `<p>A properly implemented lock acquisition does not skip. The locking call blocks until the mutex is available. Skipping the lock would break mutual exclusion entirely.</p>`,
        },
      ],
      mainExplanationHtml: `<p>When a thread calls <code>mutex.lock()</code> on an already-held mutex, the standard behavior is to <strong>block</strong> — the calling thread is suspended and placed in a wait queue.</p>
<p>Once the owning thread calls <code>mutex.unlock()</code>, the OS selects a waiting thread from the queue and grants it ownership of the mutex.</p>
<p>This blocking behavior is what distinguishes a mutex from a spinlock, where Thread B would loop repeatedly checking the mutex state (burning CPU) instead of blocking.</p>`,
      referenceText: 'Lecture notes: Week 4 — Mutex Semantics and Blocking',
      modelAnswerHtml: null,
    },
  ],

  /**
   * Initial item overrides applied on top of default state.
   * Keys match questionId. Values are merged into the default item state
   * during initState() in session-state.js.
   */
  initialOverrides: {
    'q-race-001': {},
    'q-race-002': { isBookmarked: true },
    'q-race-003': { isSkipped: true, hasBeenVisited: true },
    'q-thread-001': {
      isFlagged:        true,
      hasBeenVisited:   true,
      isAnswered:       true,
      isRevealed:       true,
      selectedChoiceIds: ['q-thread-001-a'],
      result:           'correct',
    },
    'q-lock-001': {
      hasBeenVisited:   true,
      isAnswered:       true,
      isRevealed:       true,
      selectedChoiceIds: ['q-lock-001-a'],
      result:           'incorrect',
    },
  },
};

// ---------------------------------------------------------------------------
// Dynamic session building from practice-setup config
// ---------------------------------------------------------------------------

/**
 * Read and parse the session config written by practice-setup.
 * Returns null if the key is absent or the JSON is invalid.
 */
function readSessionConfig() {
  try {
    const raw = sessionStorage.getItem('classbank_session_config');
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    // Basic sanity — must have a courseId
    if (!cfg || typeof cfg.courseId !== 'string') return null;
    return cfg;
  } catch {
    return null;
  }
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Derive a human-readable topic label from the selected topic names
 * relative to the total number of topics in the course.
 */
function deriveTopicLabel(course, unitIdSet, topicIdSet) {
  const allTopicNames = [];
  const selectedTopicNames = [];

  for (const unit of course.units) {
    for (const topic of unit.topics) {
      allTopicNames.push(topic.topic_name);
      const unitOk  = !unitIdSet  || unitIdSet.has(unit.unit_id);
      const topicOk = !topicIdSet || topicIdSet.has(topic.topic_id);
      if (unitOk && topicOk) selectedTopicNames.push(topic.topic_name);
    }
  }

  if (selectedTopicNames.length === 0)       return 'No Topics Selected';
  if (selectedTopicNames.length === allTopicNames.length) return 'All Topics';
  if (selectedTopicNames.length === 1)       return selectedTopicNames[0];
  return selectedTopicNames.join(' · ');
}

/**
 * Build a SESSION_DATA object from a validated config.
 * Returns null if the course is not found or yields 0 questions.
 */
function buildFromConfig(config) {
  const course = COURSE_DATA.courses.find(c => c.course_id === config.courseId);
  if (!course) return null;

  const unitIdSet  = config.unitIds        ? new Set(config.unitIds)        : null;
  const topicIdSet = config.topicIds       ? new Set(config.topicIds)       : null;
  const typeSet    = config.questionTypes  ? new Set(config.questionTypes)  : null;
  const diffSet    = config.difficulties   ? new Set(config.difficulties)   : null;

  // Collect matching questions
  let collected = [];
  for (const unit of course.units) {
    if (unitIdSet && !unitIdSet.has(unit.unit_id)) continue;
    for (const topic of unit.topics) {
      if (topicIdSet && !topicIdSet.has(topic.topic_id)) continue;
      for (const q of topic.questions) {
        if (typeSet && !typeSet.has(q.question_type)) continue;
        if (diffSet) {
          const d = typeof q.difficulty === 'number' ? q.difficulty : 2;
          if (!diffSet.has(d)) continue;
        }
        if (config.bookmarkedOnly && !q.is_bookmarked) continue;
        if (config.flaggedOnly    && !q.is_flagged)    continue;
        collected.push(q);
      }
    }
  }

  if (collected.length === 0) return null;

  // Shuffle questions before slicing
  if (config.shuffleQuestions) {
    collected = fisherYates(collected);
  }

  // Clamp questionCount to available pool
  const count = Math.min(Math.max(1, config.questionCount || collected.length), collected.length);
  collected = collected.slice(0, count);

  // Map snake_case fixture fields → camelCase session format
  const questions = collected.map(q => {
    let choices = (q.choices || []).map(c => ({
      choiceId:        c.choice_id,
      label:           c.label,
      html:            c.choice_rich_text,
      isCorrect:       c.is_correct,
      explanationHtml: c.choice_explanation_rich_text || '',
    }));

    if (config.shuffleChoices) {
      choices = fisherYates(choices);
    }

    return {
      questionId:          q.question_id,
      questionType:        q.question_type,
      stem:                q.stem_rich_text,
      choices,
      mainExplanationHtml: q.main_explanation_rich_text || '',
      referenceText:       q.reference_text || '',
      modelAnswerHtml:     q.model_answer_rich_text || null,
    };
  });

  // Build empty initialOverrides (no pre-seeded demo states)
  const initialOverrides = {};
  for (const q of questions) {
    initialOverrides[q.questionId] = {};
  }

  const courseLabel = `${course.course_code} — ${course.course_name}`;
  const topicLabel  = deriveTopicLabel(course, unitIdSet, topicIdSet);
  const modeLabel   = 'Free Practice';

  return {
    sessionId: `session-${Date.now()}`,
    courseLabel,
    topicLabel,
    modeLabel,
    questions,
    initialOverrides,
  };
}

// ---------------------------------------------------------------------------
// Resolve SESSION_DATA: config-driven or fallback
// ---------------------------------------------------------------------------

const _config = readSessionConfig();
const _built  = _config ? buildFromConfig(_config) : null;

/**
 * SESSION_DATA resolution:
 *   - Config present + built OK          → use built session
 *   - Config present + build failed      → error sentinel (session.js will redirect to setup)
 *   - No config (direct file:// open)    → use FALLBACK_DATA
 */
export const SESSION_DATA = (_config && _built === null)
  ? { _configError: true, sessionId: null, courseLabel: '', topicLabel: '',
      modeLabel: 'Error', questions: [], initialOverrides: {} }
  : (_built ?? FALLBACK_DATA);
