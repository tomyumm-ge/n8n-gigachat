import { Agent } from 'https';

export const HttpsAgent = new Agent({
	rejectUnauthorized: false,
});
