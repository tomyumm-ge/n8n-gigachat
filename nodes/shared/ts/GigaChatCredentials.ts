export type GigaCredential = {
	authorizationKey: string;
	scope: 'GIGACHAT_API_PERS' | 'GIGACHAT_API_B2B' | 'GIGACHAT_API_CORP';
	base_url: string;
	base_back_url: string;
	debug: boolean;
};
