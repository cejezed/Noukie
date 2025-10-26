import { pgTable, uuid, text, boolean, timestamp, integer, numeric, jsonb } from 'drizzle-orm/pg-core';


export const studyQuizzes = pgTable('study_quizzes', {
id: uuid('id').primaryKey().defaultRandom(),
userId: uuid('user_id'),
subject: text('subject').notNull(),
chapter: text('chapter').notNull(),
title: text('title').notNull(),
description: text('description'),
isPublished: boolean('is_published').notNull().default(false),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});


export const studyQuestions = pgTable('study_questions', {
id: uuid('id').primaryKey().defaultRandom(),
quizId: uuid('quiz_id').notNull(),
qtype: text('qtype').notNull().default('mc'),
prompt: text('prompt').notNull(),
choices: jsonb('choices'),
answer: text('answer'),
explanation: text('explanation'),
sortOrder: integer('sort_order').notNull().default(0),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});


export const studyResults = pgTable('study_results', {
id: uuid('id').primaryKey().defaultRandom(),
quizId: uuid('quiz_id').notNull(),
userId: uuid('user_id'),
startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
finishedAt: timestamp('finished_at', { withTimezone: true }),
total: integer('total').default(0),
correct: integer('correct').default(0),
percent: numeric('percent', { precision: 5, scale: 2 }),
});


export const studyAnswers = pgTable('study_answers', {
id: uuid('id').primaryKey().defaultRandom(),
resultId: uuid('result_id').notNull(),
questionId: uuid('question_id').notNull(),
givenAnswer: text('given_answer'),
isCorrect: boolean('is_correct'),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});


export type StudyQuiz = typeof studyQuizzes.$inferSelect;
export type NewStudyQuiz = typeof studyQuizzes.$inferInsert;
export type StudyQuestion = typeof studyQuestions.$inferSelect;
export type NewStudyQuestion = typeof studyQuestions.$inferInsert;
export type StudyResult = typeof studyResults.$inferSelect;
export type NewStudyResult = typeof studyResults.$inferInsert;
export type StudyAnswer = typeof studyAnswers.$inferSelect;
export type NewStudyAnswer = typeof studyAnswers.$inferInsert;