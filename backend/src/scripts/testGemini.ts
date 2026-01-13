import 'dotenv/config';
import { evaluateSubjectiveAnswer } from '../services/llmService.js';

async function main() {
  const question = 'What is the capital of France?';
  const correctAnswer = 'Paris';
  const userAnswer = 'Paris';

  const result = await evaluateSubjectiveAnswer(question, correctAnswer, userAnswer);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
