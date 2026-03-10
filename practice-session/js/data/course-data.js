/**
 * course-data.js — Inline fixture data for ClassBank MVP.
 *
 * Mirrors fixtures/sample-course-data.json as a JS module so both
 * practice-setup and practice-session can import it without a fetch().
 * Field names are snake_case to match the fixture schema.
 *
 * Only question data is included (flashcards are not yet in session scope).
 */

export const COURSE_DATA = {
  courses: [
    {
      course_id:   'course-ece420',
      course_name: 'Parallel & Distributed Programming',
      course_code: 'ECE 420',
      units: [
        {
          unit_id:   'unit-processes-threads',
          unit_name: 'Processes and Threads',
          sort_order: 1,
          topics: [
            {
              topic_id:   'topic-race-conditions',
              topic_name: 'Race Conditions',
              sort_order: 1,
              questions: [
                {
                  question_id:   'q-race-001',
                  question_type: 'single_best',
                  difficulty:    2,
                  is_bookmarked: false,
                  is_flagged:    false,
                  stem_rich_text: '<p>Which statement <strong>best</strong> describes a <strong>race condition</strong>?</p>',
                  main_explanation_rich_text: '<p>A <strong>race condition</strong> exists when the correctness of a program depends on the relative timing or interleaving of operations across two or more concurrent threads or processes accessing shared mutable state.</p><p>The term "race" captures the idea that threads are competing to perform reads and writes, and whichever "wins" the race determines the program\'s outcome — making the result non-deterministic.</p>',
                  reference_text: 'Lecture notes: Week 3 — Concurrency Fundamentals',
                  model_answer_rich_text: null,
                  choices: [
                    {
                      choice_id:                    'q-race-001-a',
                      label:                        'A',
                      choice_rich_text:             '<p>A race condition occurs when two threads execute in parallel, regardless of whether they access shared memory.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Parallel execution alone is not sufficient. A race condition requires <em>timing-sensitive access to shared mutable state</em>. Threads can run in parallel without ever producing a race.</p>',
                      sort_order: 1,
                    },
                    {
                      choice_id:                    'q-race-001-b',
                      label:                        'B',
                      choice_rich_text:             '<p>A race condition occurs when program output depends on the non-deterministic ordering of concurrent accesses to shared state.</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>This is the canonical definition. The key elements are: <strong>non-determinism</strong> (ordering is not guaranteed), <strong>concurrency</strong>, and <strong>shared mutable state</strong>.</p>',
                      sort_order: 2,
                    },
                    {
                      choice_id:                    'q-race-001-c',
                      label:                        'C',
                      choice_rich_text:             '<p>A race condition occurs only when a deadlock is present in the program.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Deadlock and race conditions are distinct failure modes. A deadlock involves threads waiting on each other indefinitely; a race involves indeterminate execution order on shared state.</p>',
                      sort_order: 3,
                    },
                    {
                      choice_id:                    'q-race-001-d',
                      label:                        'D',
                      choice_rich_text:             '<p>A race condition is limited to distributed systems where network latency introduces reordering.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Race conditions occur in any concurrent setting — including multi-threaded programs on a single machine. Network latency can <em>exacerbate</em> them but is not a prerequisite.</p>',
                      sort_order: 4,
                    },
                  ],
                },
                {
                  question_id:   'q-race-002',
                  question_type: 'multi_select',
                  difficulty:    3,
                  is_bookmarked: true,
                  is_flagged:    false,
                  stem_rich_text: '<p>Which of the following techniques can <strong>reduce or eliminate</strong> race conditions? <em>Select all that apply.</em></p>',
                  main_explanation_rich_text: '<p>Race conditions arise when multiple threads access shared mutable state without coordination. The primary mitigations are:</p><ul><li><strong>Mutual exclusion</strong> — serialize access via mutexes, semaphores, or critical section primitives.</li><li><strong>Immutability</strong> — eliminate shared mutable state by using data that cannot change after construction.</li><li><strong>Atomic operations</strong> — use CPU-level atomic instructions for simple shared variables.</li></ul>',
                  reference_text: 'Lecture notes: Week 4 — Locks and Synchronization Primitives',
                  model_answer_rich_text: null,
                  choices: [
                    {
                      choice_id:                    'q-race-002-a',
                      label:                        'A',
                      choice_rich_text:             '<p>Protect critical sections with a mutex.</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>A mutex (mutual exclusion lock) ensures only one thread executes a critical section at a time, preventing conflicting concurrent accesses.</p>',
                      sort_order: 1,
                    },
                    {
                      choice_id:                    'q-race-002-b',
                      label:                        'B',
                      choice_rich_text:             '<p>Prefer immutable data structures where practical.</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>Immutable data cannot be modified after creation, so concurrent reads are safe by definition.</p>',
                      sort_order: 2,
                    },
                    {
                      choice_id:                    'q-race-002-c',
                      label:                        'C',
                      choice_rich_text:             '<p>Increase CPU clock speed to reduce the window for interleaving.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Clock speed does not eliminate timing windows — it may narrow them, but concurrency hazards remain regardless of hardware speed.</p>',
                      sort_order: 3,
                    },
                    {
                      choice_id:                    'q-race-002-d',
                      label:                        'D',
                      choice_rich_text:             '<p>Use atomic operations for single-variable shared state where appropriate.</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>Atomic operations provide indivisible read-modify-write sequences, eliminating races on individual variables without a full mutex.</p>',
                      sort_order: 4,
                    },
                  ],
                },
                {
                  question_id:   'q-race-003',
                  question_type: 'short_answer',
                  difficulty:    2,
                  is_bookmarked: false,
                  is_flagged:    false,
                  stem_rich_text: '<p>Define a <strong>critical section</strong> in the context of concurrent programming. Include what property it must enforce and why.</p>',
                  main_explanation_rich_text: '<p>A <strong>critical section</strong> is a segment of code that accesses one or more shared resources and which must not be executed by more than one thread simultaneously.</p><p>The property it enforces is <strong>mutual exclusion</strong>. Additional desired properties: <strong>progress</strong> and <strong>bounded waiting</strong>.</p>',
                  reference_text: 'Lecture notes: Week 3 — Critical Sections and Mutual Exclusion',
                  model_answer_rich_text: '<p>A critical section is a portion of code that accesses shared state and must not be executed by more than one thread or process concurrently. It must enforce <strong>mutual exclusion</strong> to prevent data races. A proper implementation also ensures <strong>progress</strong> (a willing thread eventually enters) and <strong>bounded waiting</strong> (no thread waits indefinitely).</p>',
                  choices: [],
                },
              ],
            },
            {
              topic_id:   'topic-thread-basics',
              topic_name: 'Thread Basics',
              sort_order: 2,
              questions: [
                {
                  question_id:   'q-thread-001',
                  question_type: 'true_false',
                  difficulty:    1,
                  is_bookmarked: false,
                  is_flagged:    true,
                  stem_rich_text: '<p><strong>True or False:</strong> Threads within the same process generally share the same virtual address space, including heap and global variables, while maintaining separate stacks and register sets.</p>',
                  main_explanation_rich_text: '<p>A thread is the minimum unit of CPU scheduling. The OS associates one <em>virtual address space</em> with each process; every thread in that process shares that space.</p><p><strong>Shared between threads:</strong> heap, code segment, global/static variables, file descriptors.</p><p><strong>Private per thread:</strong> stack, stack pointer, program counter, general-purpose registers, and thread-local storage.</p>',
                  reference_text: 'Lecture notes: Week 2 — Processes vs. Threads',
                  model_answer_rich_text: null,
                  choices: [
                    {
                      choice_id:                    'q-thread-001-a',
                      label:                        'A',
                      choice_rich_text:             '<p>True</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>Correct. The OS creates one virtual address space per process. All threads see the same heap and globals; each thread maintains its own stack and register set.</p>',
                      sort_order: 1,
                    },
                    {
                      choice_id:                    'q-thread-001-b',
                      label:                        'B',
                      choice_rich_text:             '<p>False</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Incorrect. Separate address spaces are a process-level boundary, not a thread-level one. Threads are specifically designed to share memory.</p>',
                      sort_order: 2,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          unit_id:   'unit-parallel-patterns',
          unit_name: 'Parallel Patterns',
          sort_order: 2,
          topics: [
            {
              topic_id:   'topic-map-reduce',
              topic_name: 'MapReduce',
              sort_order: 1,
              questions: [
                {
                  question_id:   'q-mapreduce-001',
                  question_type: 'single_best',
                  difficulty:    2,
                  is_bookmarked: false,
                  is_flagged:    false,
                  stem_rich_text: '<p>In MapReduce, what is the primary role of the <strong>reduce</strong> phase?</p>',
                  main_explanation_rich_text: '<p>The reduce phase aggregates or combines grouped intermediate results generated by the map phase.</p>',
                  reference_text: 'Lecture notes: Parallel Patterns',
                  model_answer_rich_text: null,
                  choices: [
                    {
                      choice_id:                    'q-mapreduce-001-a',
                      label:                        'A',
                      choice_rich_text:             '<p>It launches worker nodes.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>That is infrastructure/orchestration, not the logical reduce role.</p>',
                      sort_order: 1,
                    },
                    {
                      choice_id:                    'q-mapreduce-001-b',
                      label:                        'B',
                      choice_rich_text:             '<p>It partitions raw data into shards.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Input partitioning is not the core reduce responsibility.</p>',
                      sort_order: 2,
                    },
                    {
                      choice_id:                    'q-mapreduce-001-c',
                      label:                        'C',
                      choice_rich_text:             '<p>It aggregates grouped intermediate key-value results.</p>',
                      is_correct:                   true,
                      choice_explanation_rich_text: '<p>Correct. The reduce function receives sorted, grouped key-value pairs from the map phase and merges them into a final result.</p>',
                      sort_order: 3,
                    },
                    {
                      choice_id:                    'q-mapreduce-001-d',
                      label:                        'D',
                      choice_rich_text:             '<p>It serializes thread-local memory to disk.</p>',
                      is_correct:                   false,
                      choice_explanation_rich_text: '<p>Not the main logical role of reduce.</p>',
                      sort_order: 4,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
