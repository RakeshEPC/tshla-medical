/**
 * Azure OpenAI Service
 * Wrapper for Azure OpenAI API calls
 * HIPAA-compliant
 *
 * Created: 2026-01-23
 */

const { AzureOpenAI } = require('openai');
const logger = require('../logger');

// Initialize Azure OpenAI client
const azureClient = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01'
});

/**
 * Generate completion using Azure OpenAI
 * @param {Object} options - OpenAI completion options
 * @param {string} options.model - Model deployment name
 * @param {Array} options.messages - Chat messages
 * @param {number} options.temperature - Temperature (0-2)
 * @param {number} options.maxTokens - Max tokens to generate
 * @returns {Promise<Object>} Completion response
 */
async function generateCompletion({ model, messages, temperature = 0.7, maxTokens = 2000 }) {
  try {
    const response = await azureClient.chat.completions.create({
      model: model || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages,
      temperature,
      max_tokens: maxTokens
    });

    return {
      success: true,
      content: response.choices[0].message.content,
      usage: response.usage
    };
  } catch (error) {
    logger.error('AzureOpenAI', 'Completion error', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateCompletion,
  azureClient
};
