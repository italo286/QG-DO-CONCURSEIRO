
import { Handler } from '@netlify/functions';

/**
 * @deprecated This function is deprecated and has been replaced by 'generateStudentChallenge-on-demand'.
 * It was timing out due to trying to generate all challenges in a single execution.
 * The new approach uses separate, on-demand calls from the client for each challenge type.
 */
const handler: Handler = async () => {
  return {
    statusCode: 410, // Gone
    body: JSON.stringify({ 
      error: "This function is deprecated. Please use the 'generateStudentChallenge-on-demand' function instead." 
    }),
  };
};

export { handler };
