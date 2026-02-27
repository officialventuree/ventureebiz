'use server';
/**
 * @fileOverview This flow generates a unique, 8-character AI-generated ID for viewer passwords.
 *
 * - generateViewerPasswordId - A function that handles the generation of an 8-character unique ID.
 * - GenerateViewerPasswordIdInput - The input type for the generateViewerPasswordId function.
 * - GenerateViewerPasswordIdOutput - The return type for the generateViewerPasswordId function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateViewerPasswordIdInputSchema = z
  .object({})
  .describe('No specific input is required for generating a unique password ID.');
export type GenerateViewerPasswordIdInput = z.infer<
  typeof GenerateViewerPasswordIdInputSchema
>;

const GenerateViewerPasswordIdOutputSchema = z
  .string()
  .length(8)
  .describe('An 8-character unique alphanumeric ID for a viewer password.');
export type GenerateViewerPasswordIdOutput = z.infer<
  typeof GenerateViewerPasswordIdOutputSchema
>;

export async function generateViewerPasswordId(
  input: GenerateViewerPasswordIdInput
): Promise<GenerateViewerPasswordIdOutput> {
  return generateViewerPasswordIdFlow(input);
}

const generateViewerPasswordIdPrompt = ai.definePrompt({
  name: 'generateViewerPasswordIdPrompt',
  input: {schema: GenerateViewerPasswordIdInputSchema},
  output: {schema: GenerateViewerPasswordIdOutputSchema},
  prompt: 'Generate a unique 8-character alphanumeric ID. The ID should only contain letters and numbers, with no special characters. Example: A1B2C3D4',
});

const generateViewerPasswordIdFlow = ai.defineFlow(
  {
    name: 'generateViewerPasswordIdFlow',
    inputSchema: GenerateViewerPasswordIdInputSchema,
    outputSchema: GenerateViewerPasswordIdOutputSchema,
  },
  async input => {
    const {output} = await generateViewerPasswordIdPrompt(input);
    return output!;
  }
);
