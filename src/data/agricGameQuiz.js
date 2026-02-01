// src/data/agricGameQuiz.js
import { agricLessons } from './agricLessons';

/**
 * Build a flattened question bank from agricLessons.
 * Each question: { question, options: [..], answer }
 */

const questionBank = [];

// gather all quizzes
agricLessons.forEach((lesson) => {
  if (lesson.quiz && Array.isArray(lesson.quiz)) {
    lesson.quiz.forEach((q) => {
      // sanitize: ensure options is an array
      if (q && q.question && Array.isArray(q.options) && q.options.length >= 2) {
        questionBank.push({
          question: q.question,
          options: [...q.options],
          answer: q.answer,
        });
      }
    });
  }
});

// fallback if none found
if (questionBank.length === 0) {
  questionBank.push({
    question: 'Agriculture contributes to the economy through:',
    options: ['Tax evasion', 'Foreign exchange', 'Pollution'],
    answer: 'Foreign exchange',
  });
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default {
  // return a random question with exactly 3 options (pads or slices as needed)
  getRandomQuestion() {
    const rand = Math.floor(Math.random() * questionBank.length);
    const src = questionBank[rand];
    let opts = [...src.options];

    // ensure we have 3 options: try to fill by picking other distinct options from bank
    if (opts.length < 3) {
      const extras = [];
      for (let i = 0; i < questionBank.length && extras.length < 3 - opts.length; i++) {
        const cand = questionBank[(rand + 1 + i) % questionBank.length].options?.[0];
        if (cand && !opts.includes(cand)) extras.push(cand);
      }
      opts = [...opts, ...extras];
    }

    // choose exactly 3 and shuffle
    opts = shuffle(opts).slice(0, 3);
    // ensure answer is in opts (if not, replace a random one)
    if (!opts.includes(src.answer)) {
      opts[Math.floor(Math.random() * opts.length)] = src.answer;
    }

    return {
      question: src.question,
      options: shuffle(opts),
      answer: src.answer,
    };
  },

  // helper to get question for particular "level" (not required but kept for extensibility)
  getQuestionForLevel(level) {
    return this.getRandomQuestion();
  },
};
