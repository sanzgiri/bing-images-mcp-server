import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const QUESTION_KINDS = [
  'trivia',          // a factual but interesting fact
  'guess',           // estimate / "which is closest"
  'lateral',         // lateral thinking, surprising connection
  'whatif',          // imaginative "what would happen if…"
  'culture',         // folklore, art, history, mythology tied to the subject
  'sensory',         // what you'd see / hear / smell / feel there
  'thisorthat',      // pick which of two real things is true
  'mystery',         // a riddle or unusual claim about the subject
] as const;

const QuestionSchema = z.object({
  kind: z
    .enum(QUESTION_KINDS)
    .describe('The flavor of this question. Mix kinds across the quiz.'),
  question: z
    .string()
    .describe(
      'A vivid, engaging question. Avoid bland "what is X" phrasing. Use story, hook, scenario, or surprise.'
    ),
  choices: z
    .array(z.string())
    .length(4)
    .describe('Four answer choices. All plausible; only one true/best.'),
  answerIndex: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe('Index (0-3) of the correct or best choice.'),
  explanation: z
    .string()
    .describe(
      'One or two sentences: why the answer is right AND a small surprising tidbit.'
    ),
  funFact: z
    .string()
    .optional()
    .describe('Optional extra "did you know" snippet shown after reveal.'),
});

const QuizSchema = z.object({
  questions: z.array(QuestionSchema).length(5),
});

export type Quiz = z.infer<typeof QuizSchema>;

interface ImageContext {
  title?: string;
  description?: string | null;
  full_description?: string | null;
  image_url?: string | null;
  page_url?: string | null;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('Missing OPENAI_API_KEY', { status: 401 });
  }

  let body: { imageContext?: ImageContext } = {};
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const image = body.imageContext;
  if (!image || !image.title) {
    return new Response('imageContext.title is required', { status: 400 });
  }

  const grounding = [
    `Title: ${image.title}`,
    image.description ? `Description: ${image.description}` : null,
    image.full_description ? `Background: ${image.full_description}` : null,
    image.page_url ? `Source page: ${image.page_url}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt = `You are a witty quizmaster making a 5-question quiz inspired by the Bing Image of the Day below.

GOAL: Engaging > exhaustive. Make the user think "huh, interesting!" not "okay, next."

Question variety (use AT LEAST 4 different kinds across the 5 questions):
- trivia: a genuinely surprising fact (avoid generic textbook facts)
- guess: "which of these is closest to…" (size, age, distance, depth, temperature, speed, population, etc.)
- lateral: an unexpected connection — pop culture, another country, a famous person, a movie, a song, a sport
- whatif: imaginative scenario ("if you stood here at midnight in winter, what would you most likely…")
- culture: myth, folklore, art, literature, cuisine, ritual, or history tied to the subject
- sensory: what you'd actually see, hear, smell, taste, or feel there — make it cinematic
- thisorthat: present two real-sounding claims; the user picks the true one
- mystery: a riddle, an unsolved question, a contested theory, or a "scientists still don't know why…"

STYLE RULES:
- Hook the reader. Use a short scene-setter when it helps ("You're standing at the rim at dusk…").
- Prefer concrete numbers, named people, vivid verbs over abstract description.
- Never ask the user to identify the title or location verbatim — they already see it.
- Distractors must be plausible and roughly the same length/specificity as the correct answer. No joke options.
- Vary the correct-answer index across the 5 questions (not all 0, not all 1).
- Explanations should teach something the user probably didn't know. Add a funFact when you have one.
- Avoid repeating facts between questions.
- It's OK — encouraged — for one question to be playful or speculative as long as the "correct" answer is defensible.

Image context:
${grounding}`;

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: QuizSchema,
      system: systemPrompt,
      prompt:
        'Write the 5-question quiz now. Make sure the kinds are varied and at least one question is a guess/estimate, one is lateral or cultural, and one is sensory or what-if.',
      temperature: 0.9,
    });
    return Response.json(object);
  } catch (error) {
    console.error('Quiz generation failed:', error);
    const message = error instanceof Error ? error.message : 'Quiz generation failed.';
    return new Response(message, { status: 502 });
  }
}
