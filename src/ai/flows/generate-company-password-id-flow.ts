'use server';
/**
 * @fileOverview A Genkit flow for generating a unique 8-character alphanumeric ID for company passwords.
 *
 * - generateCompanyPasswordId - A function that handles the generation of the unique password ID.
 * - GenerateCompanyPasswordIdInput - The input type for the generateCompanyPasswordId function.
 * - GenerateCompanyPasswordIdOutput - The return type for the generateCompanyPasswordId function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCompanyPasswordIdInputSchema = z.object({}).describe('Input schema for generating a unique password ID.');
export type GenerateCompanyPasswordIdInput = z.infer<typeof GenerateCompanyPasswordIdInputSchema>;

const GenerateCompanyPasswordIdOutputSchema = z.object({
  uniqueId: z.string().length(8).regex(/^[a-zA-Z0-9]{8}$/).describe('An 8-character alphanumeric unique ID.'),
});
export type GenerateCompanyPasswordIdOutput = z.infer<typeof GenerateCompanyPasswordIdOutputSchema>;

export async function generateCompanyPasswordId(input: GenerateCompanyPasswordIdInput): Promise<GenerateCompanyPasswordIdOutput> {
  return generateCompanyPasswordIdFlow(input);
}

const generateCompanyPasswordIdPrompt = ai.definePrompt({
  name: 'generateCompanyPasswordIdPrompt',
  input: {schema: GenerateCompanyPasswordIdInputSchema},
  output: {schema: GenerateCompanyPasswordIdOutputSchema},
  prompt: `Generate a unique 8-character alphanumeric string for a password ID.\nThe string must contain only letters (uppercase and lowercase) and numbers.\nDo not include any special characters or spaces.\nReturn the result in JSON format with a single key named 'uniqueId'.`,
});

const generateCompanyPasswordIdFlow = ai.defineFlow(
  {
    name: 'generateCompanyPasswordIdFlow',
    inputSchema: GenerateCompanyPasswordIdInputSchema,
    outputSchema: GenerateCompanyPasswordIdOutputSchema,
  },
  async input => {
    const {output} = await generateCompanyPasswordIdPrompt(input);
    if (!output) {
      throw new Error('Failed to generate unique password ID.');
    }
    return output;
  }
);
